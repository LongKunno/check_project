import hashlib
import json
import logging
import math
import re
import uuid
from datetime import UTC, datetime
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from psycopg2.extras import RealDictCursor

from src.engine.database import AuditDatabase

logger = logging.getLogger(__name__)


class AiBudgetExceededError(RuntimeError):
    """Raised when a new AI request is blocked by the active budget policy."""


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _json_loads(value: Any, default: Any):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


class AiTelemetry:
    DEFAULT_BUDGET_POLICY = {
        "policy_key": "global",
        "daily_budget_usd": None,
        "monthly_budget_usd": None,
        "hard_stop_enabled": False,
        "retention_days": 30,
        "raw_payload_retention_enabled": False,
    }

    PREVIEW_LIMIT = 480
    EMPTY_SUMMARY = {
        "total_requests": 0,
        "blocked_requests": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cached_tokens": 0,
        "cost_usd": 0.0,
        "reported_requests": 0,
        "estimated_requests": 0,
        "by_source": {},
    }
    DEFAULT_REQUEST_STATUSES = (
        "completed",
        "failed",
        "blocked_budget",
        "submitted",
        "running",
    )
    DEFAULT_REQUEST_MODES = ("realtime", "openai_batch")
    DEFAULT_PROVIDERS = ("openai", "anthropic", "google", "proxy")

    def __init__(self):
        self._pending_batches: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._memory_request_logs: Dict[str, Dict[str, Any]] = {}
        self._memory_pricing_catalog: List[Dict[str, Any]] = []
        self._memory_budget_policy: Dict[str, Any] = dict(self.DEFAULT_BUDGET_POLICY)

    def detect_provider(self, base_url: Optional[str], mode: str = "realtime") -> str:
        if mode == "openai_batch":
            return "openai"
        if not base_url:
            return "proxy"
        try:
            host = urlparse(base_url).netloc.lower()
        except Exception:
            host = str(base_url).lower()
        if "openai" in host:
            return "openai"
        if "google" in host or "gemini" in host:
            return "google"
        if "anthropic" in host or "claude" in host:
            return "anthropic"
        return "proxy"

    def _db_ready(self) -> bool:
        return bool(getattr(AuditDatabase, "_pool", None))

    def normalize_context(self, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        ctx = dict(context or {})
        source = (ctx.get("source") or "unknown").strip() or "unknown"
        feature = source.split(".", 1)[0]
        normalized = {
            "source": source,
            "feature": ctx.get("feature") or feature,
            "job_id": ctx.get("job_id"),
            "target": ctx.get("target"),
            "project": ctx.get("project"),
            "metadata": dict(ctx.get("metadata") or {}),
        }
        if ctx.get("audit_id") is not None:
            normalized["metadata"]["audit_id"] = ctx["audit_id"]
        return normalized

    def _stringify_payload(self, payload: Any) -> str:
        if payload is None:
            return ""
        if isinstance(payload, str):
            return payload
        if isinstance(payload, list):
            rendered: List[str] = []
            for item in payload:
                if isinstance(item, dict):
                    role = item.get("role")
                    content = item.get("content")
                    rendered.append(
                        f"[{role or 'item'}] {self._stringify_payload(content)}"
                    )
                else:
                    rendered.append(self._stringify_payload(item))
            return "\n".join(part for part in rendered if part)
        if isinstance(payload, dict):
            if payload.get("type") == "text":
                return str(payload.get("text", ""))
            if "content" in payload:
                return self._stringify_payload(payload["content"])
            return _json_dumps(payload)
        return str(payload)

    def _redact_text(self, text: str) -> str:
        if not text:
            return ""
        redacted = text
        patterns = [
            (
                re.compile(r"(?i)\bauthorization\b\s*[:=]\s*bearer\s+[A-Za-z0-9._\-]+"),
                "authorization=[REDACTED]",
            ),
            (
                re.compile(
                    r"(?i)\b(api[_-]?key|token|password|secret|authorization)\b\s*[:=]\s*([\"']?)[^\s,\"'}\]]+\2"
                ),
                lambda m: f"{m.group(1)}=[REDACTED]",
            ),
            (
                re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]+"),
                "Bearer [REDACTED]",
            ),
            (
                re.compile(r"sk-[A-Za-z0-9]{12,}"),
                "sk-[REDACTED]",
            ),
        ]
        for pattern, replacement in patterns:
            redacted = pattern.sub(replacement, redacted)
        return redacted

    def _build_preview_bundle(self, payload: Any, allow_raw: bool) -> Dict[str, Any]:
        raw_text = self._stringify_payload(payload)
        redacted = self._redact_text(raw_text)
        preview = redacted[: self.PREVIEW_LIMIT]
        if len(redacted) > self.PREVIEW_LIMIT:
            preview += "..."
        return {
            "hash": hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
            if raw_text
            else "",
            "preview": preview,
            "chars": len(raw_text),
            "raw_payload": _json_dumps(payload) if allow_raw and payload is not None else None,
        }

    def _estimate_tokens_from_text(self, text: str) -> int:
        if not text:
            return 0
        return max(1, math.ceil(len(text) / 4))

    def _extract_usage(self, usage: Any) -> Dict[str, int]:
        if usage is None:
            return {
                "input_tokens": 0,
                "output_tokens": 0,
                "cached_tokens": 0,
            }
        if hasattr(usage, "model_dump"):
            usage = usage.model_dump()
        elif not isinstance(usage, dict):
            usage = {
                "prompt_tokens": getattr(usage, "prompt_tokens", 0),
                "completion_tokens": getattr(usage, "completion_tokens", 0),
                "total_tokens": getattr(usage, "total_tokens", 0),
                "prompt_tokens_details": getattr(usage, "prompt_tokens_details", None),
            }

        prompt_details = usage.get("prompt_tokens_details") or {}
        if hasattr(prompt_details, "model_dump"):
            prompt_details = prompt_details.model_dump()
        cached_tokens = int(prompt_details.get("cached_tokens") or 0)

        return {
            "input_tokens": int(
                usage.get("prompt_tokens")
                or usage.get("input_tokens")
                or usage.get("prompt_token_count")
                or 0
            ),
            "output_tokens": int(
                usage.get("completion_tokens")
                or usage.get("output_tokens")
                or usage.get("candidates_token_count")
                or 0
            ),
            "cached_tokens": cached_tokens,
        }

    def get_budget_policy(self) -> Dict[str, Any]:
        if not self._db_ready():
            return dict(self._memory_budget_policy)
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(
                    """
                    SELECT policy_key, daily_budget_usd, monthly_budget_usd,
                           hard_stop_enabled, retention_days, raw_payload_retention_enabled
                    FROM ai_budget_policy
                    WHERE policy_key = 'global'
                    """
                )
                row = cursor.fetchone()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            return dict(self._memory_budget_policy)

        if not row:
            return dict(self._memory_budget_policy)

        data = dict(row)
        return {
            "policy_key": data.get("policy_key") or "global",
            "daily_budget_usd": data.get("daily_budget_usd"),
            "monthly_budget_usd": data.get("monthly_budget_usd"),
            "hard_stop_enabled": bool(data.get("hard_stop_enabled")),
            "retention_days": int(data.get("retention_days") or 30),
            "raw_payload_retention_enabled": bool(
                data.get("raw_payload_retention_enabled")
            ),
        }

    def save_budget_policy(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get_budget_policy()
        merged = {
            **current,
            **{
                key: payload[key]
                for key in (
                    "daily_budget_usd",
                    "monthly_budget_usd",
                    "hard_stop_enabled",
                    "retention_days",
                    "raw_payload_retention_enabled",
                )
                if key in payload
            },
        }
        self._memory_budget_policy = {
            "policy_key": "global",
            "daily_budget_usd": merged.get("daily_budget_usd"),
            "monthly_budget_usd": merged.get("monthly_budget_usd"),
            "hard_stop_enabled": bool(merged.get("hard_stop_enabled")),
            "retention_days": int(merged.get("retention_days") or 30),
            "raw_payload_retention_enabled": bool(
                merged.get("raw_payload_retention_enabled")
            ),
        }
        if not self._db_ready():
            return self.get_budget_policy()
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO ai_budget_policy (
                        policy_key, daily_budget_usd, monthly_budget_usd,
                        hard_stop_enabled, retention_days, raw_payload_retention_enabled, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (policy_key) DO UPDATE SET
                        daily_budget_usd = EXCLUDED.daily_budget_usd,
                        monthly_budget_usd = EXCLUDED.monthly_budget_usd,
                        hard_stop_enabled = EXCLUDED.hard_stop_enabled,
                        retention_days = EXCLUDED.retention_days,
                        raw_payload_retention_enabled = EXCLUDED.raw_payload_retention_enabled,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        "global",
                        self._memory_budget_policy.get("daily_budget_usd"),
                        self._memory_budget_policy.get("monthly_budget_usd"),
                        self._memory_budget_policy.get("hard_stop_enabled"),
                        self._memory_budget_policy.get("retention_days"),
                        self._memory_budget_policy.get(
                            "raw_payload_retention_enabled"
                        ),
                    ),
                )
                conn.commit()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            pass
        return self.get_budget_policy()

    def get_pricing_catalog(self) -> List[Dict[str, Any]]:
        if not self._db_ready():
            return list(self._memory_pricing_catalog)
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(
                    """
                    SELECT provider, mode, model,
                           input_cost_per_million, output_cost_per_million,
                           cached_input_cost_per_million, currency, is_active,
                           created_at, updated_at
                    FROM ai_pricing_catalog
                    ORDER BY provider, mode, model
                    """
                )
                rows = cursor.fetchall()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            return list(self._memory_pricing_catalog)

        result = []
        for row in rows:
            item = dict(row)
            for key in ("created_at", "updated_at"):
                if isinstance(item.get(key), datetime):
                    item[key] = item[key].isoformat()
            result.append(item)
        return result

    def save_pricing_catalog(self, entries: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        for entry in entries:
            provider = (entry.get("provider") or "").strip()
            mode = (entry.get("mode") or "").strip()
            model = (entry.get("model") or "").strip()
            if not provider or not mode or not model:
                raise ValueError(
                    "Pricing rows must include non-empty provider, mode, and model."
                )
            normalized.append(
                {
                    "provider": provider,
                    "mode": mode,
                    "model": model,
                    "input_cost_per_million": float(
                        entry.get("input_cost_per_million") or 0
                    ),
                    "output_cost_per_million": float(
                        entry.get("output_cost_per_million") or 0
                    ),
                    "cached_input_cost_per_million": float(
                        entry.get("cached_input_cost_per_million") or 0
                    ),
                    "currency": ((entry.get("currency") or "USD").strip() or "USD").upper(),
                    "is_active": bool(entry.get("is_active", True)),
                }
            )

        self._memory_pricing_catalog = list(normalized)
        if not self._db_ready():
            return self.get_pricing_catalog()
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM ai_pricing_catalog")
                for entry in normalized:
                    cursor.execute(
                        """
                        INSERT INTO ai_pricing_catalog (
                            provider, mode, model,
                            input_cost_per_million, output_cost_per_million,
                            cached_input_cost_per_million, currency, is_active, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                        """,
                        (
                            entry["provider"],
                            entry["mode"],
                            entry["model"],
                            entry["input_cost_per_million"],
                            entry["output_cost_per_million"],
                            entry["cached_input_cost_per_million"],
                            entry["currency"],
                            entry["is_active"],
                        ),
                    )
                conn.commit()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            pass
        return self.get_pricing_catalog()

    def _get_price_entry(self, provider: str, mode: str, model: str) -> Optional[Dict[str, Any]]:
        if not self._db_ready():
            for item in self._memory_pricing_catalog:
                if (
                    item.get("provider") == provider
                    and item.get("mode") == mode
                    and item.get("model") == model
                    and item.get("is_active", True)
                ):
                    return dict(item)
            return None
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(
                    """
                    SELECT provider, mode, model,
                           input_cost_per_million, output_cost_per_million,
                           cached_input_cost_per_million, currency
                    FROM ai_pricing_catalog
                    WHERE provider = %s AND mode = %s AND model = %s AND is_active = TRUE
                    LIMIT 1
                    """,
                    (provider, mode, model),
                )
                row = cursor.fetchone()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
            return dict(row) if row else None
        except Exception:
            for item in self._memory_pricing_catalog:
                if (
                    item.get("provider") == provider
                    and item.get("mode") == mode
                    and item.get("model") == model
                    and item.get("is_active", True)
                ):
                    return dict(item)
            return None

    def _calculate_cost(
        self,
        *,
        provider: str,
        mode: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int,
    ) -> float:
        price = self._get_price_entry(provider, mode, model)
        if not price:
            return 0.0

        uncached_input = max(int(input_tokens) - int(cached_tokens), 0)
        return round(
            (uncached_input * float(price.get("input_cost_per_million") or 0) / 1_000_000)
            + (int(output_tokens) * float(price.get("output_cost_per_million") or 0) / 1_000_000)
            + (int(cached_tokens) * float(price.get("cached_input_cost_per_million") or 0) / 1_000_000),
            8,
        )

    def get_budget_usage(self) -> Dict[str, float]:
        now = _utc_now()
        day_start = datetime(now.year, now.month, now.day)
        month_start = datetime(now.year, now.month, 1)
        if not self._db_ready():
            daily = 0.0
            monthly = 0.0
            for item in self._memory_request_logs.values():
                created_at = item.get("created_at")
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at)
                    except Exception:
                        created_at = None
                if not isinstance(created_at, datetime):
                    continue
                if item.get("status") == "blocked_budget":
                    continue
                if created_at >= day_start:
                    daily += float(item.get("estimated_cost") or 0)
                if created_at >= month_start:
                    monthly += float(item.get("estimated_cost") or 0)
            return {
                "today_spend": round(daily, 8),
                "month_spend": round(monthly, 8),
            }
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT COALESCE(SUM(estimated_cost), 0)
                    FROM ai_request_logs
                    WHERE created_at >= %s
                      AND status NOT IN ('blocked_budget')
                    """,
                    (day_start,),
                )
                daily = float(cursor.fetchone()[0] or 0)
                cursor.execute(
                    """
                    SELECT COALESCE(SUM(estimated_cost), 0)
                    FROM ai_request_logs
                    WHERE created_at >= %s
                      AND status NOT IN ('blocked_budget')
                    """,
                    (month_start,),
                )
                monthly = float(cursor.fetchone()[0] or 0)
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            daily = 0.0
            monthly = 0.0
            for item in self._memory_request_logs.values():
                created_at = item.get("created_at")
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at)
                    except Exception:
                        created_at = None
                if not isinstance(created_at, datetime):
                    continue
                if item.get("status") == "blocked_budget":
                    continue
                if created_at >= day_start:
                    daily += float(item.get("estimated_cost") or 0)
                if created_at >= month_start:
                    monthly += float(item.get("estimated_cost") or 0)
        return {
            "today_spend": round(daily, 8),
            "month_spend": round(monthly, 8),
        }

    def get_filter_metadata(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        project: Optional[str] = None,
    ) -> Dict[str, Any]:
        projects = set([project] if project else [])
        sources = set()
        providers = set(self.DEFAULT_PROVIDERS)
        models = set()
        statuses = set(self.DEFAULT_REQUEST_STATUSES)
        modes = set(self.DEFAULT_REQUEST_MODES)
        models_by_provider: Dict[str, set] = {}

        if not self._db_ready():
            rows = self._filter_memory_rows(
                date_from=date_from,
                date_to=date_to,
                project=project,
            )
        else:
            where = []
            params: List[Any] = []
            if date_from:
                where.append("created_at >= %s")
                params.append(date_from)
            if date_to:
                where.append("created_at < %s")
                params.append(date_to)
            if project:
                where.append("project = %s")
                params.append(project)
            clause = f"WHERE {' AND '.join(where)}" if where else ""
            try:
                conn = AuditDatabase.get_connection()
                try:
                    cursor = conn.cursor(cursor_factory=RealDictCursor)
                    cursor.execute(
                        f"""
                        SELECT project, source, provider, model, status, mode
                        FROM ai_request_logs
                        {clause}
                        """,
                        tuple(params),
                    )
                    rows = [dict(row) for row in cursor.fetchall()]
                    cursor.close()
                finally:
                    AuditDatabase.release_connection(conn)
            except Exception:
                rows = self._filter_memory_rows(
                    date_from=date_from,
                    date_to=date_to,
                    project=project,
                )

        for row in rows:
            row_project = (row.get("project") or "").strip()
            row_source = (row.get("source") or "").strip()
            row_provider = (row.get("provider") or "").strip()
            row_model = (row.get("model") or "").strip()
            row_status = (row.get("status") or "").strip()
            row_mode = (row.get("mode") or "").strip()

            if row_project:
                projects.add(row_project)
            if row_source:
                sources.add(row_source)
            if row_provider:
                providers.add(row_provider)
            if row_model:
                models.add(row_model)
            if row_status:
                statuses.add(row_status)
            if row_mode:
                modes.add(row_mode)
            if row_provider and row_model:
                models_by_provider.setdefault(row_provider, set()).add(row_model)

        for item in self.get_pricing_catalog():
            provider_value = (item.get("provider") or "").strip()
            model_value = (item.get("model") or "").strip()
            mode_value = (item.get("mode") or "").strip()
            if provider_value:
                providers.add(provider_value)
            if model_value:
                models.add(model_value)
            if mode_value:
                modes.add(mode_value)
            if provider_value and model_value:
                models_by_provider.setdefault(provider_value, set()).add(model_value)

        default_providers = list(self.DEFAULT_PROVIDERS)
        ordered_providers = [
            value for value in default_providers if value in providers
        ] + sorted(value for value in providers if value not in default_providers)
        default_statuses = list(self.DEFAULT_REQUEST_STATUSES)
        ordered_statuses = [
            value for value in default_statuses if value in statuses
        ] + sorted(value for value in statuses if value not in default_statuses)
        default_modes = list(self.DEFAULT_REQUEST_MODES)
        ordered_modes = [
            value for value in default_modes if value in modes
        ] + sorted(value for value in modes if value not in default_modes)

        return {
            "projects": sorted(projects),
            "sources": sorted(sources),
            "providers": ordered_providers,
            "models": sorted(models),
            "statuses": ordered_statuses,
            "modes": ordered_modes,
            "models_by_provider": {
                provider_key: sorted(model_values)
                for provider_key, model_values in sorted(models_by_provider.items())
            },
        }

    def _budget_error_message(self, policy: Dict[str, Any], usage: Dict[str, float]) -> str:
        daily = policy.get("daily_budget_usd")
        monthly = policy.get("monthly_budget_usd")
        return (
            "AI budget exceeded. "
            f"today={usage['today_spend']:.4f}/{daily if daily is not None else 'inf'} USD, "
            f"month={usage['month_spend']:.4f}/{monthly if monthly is not None else 'inf'} USD."
        )

    def _check_budget_status(self) -> Optional[str]:
        policy = self.get_budget_policy()
        if not policy.get("hard_stop_enabled"):
            return None
        usage = self.get_budget_usage()
        daily_limit = policy.get("daily_budget_usd")
        monthly_limit = policy.get("monthly_budget_usd")
        if daily_limit is not None and usage["today_spend"] >= float(daily_limit):
            return self._budget_error_message(policy, usage)
        if monthly_limit is not None and usage["month_spend"] >= float(monthly_limit):
            return self._budget_error_message(policy, usage)
        return None

    def _insert_request_log(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        memory_payload = dict(payload)
        memory_payload.setdefault("created_at", _utc_now())
        self._memory_request_logs[payload["request_id"]] = memory_payload
        if not self._db_ready():
            return payload
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO ai_request_logs (
                        request_id, external_request_id, batch_envelope_id,
                        source, feature, provider, mode, model,
                        job_id, target, project, status, error_reason,
                        input_chars, output_chars, input_tokens, output_tokens, cached_tokens,
                        estimated_cost, usage_source,
                        input_preview, output_preview, input_hash, output_hash,
                        metadata, raw_input_payload, raw_output_payload,
                        started_at, ended_at, created_at
                    )
                    VALUES (
                        %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, CURRENT_TIMESTAMP
                    )
                    """,
                    (
                        payload["request_id"],
                        payload.get("external_request_id"),
                        payload.get("batch_envelope_id"),
                        payload["source"],
                        payload["feature"],
                        payload["provider"],
                        payload["mode"],
                        payload["model"],
                        payload.get("job_id"),
                        payload.get("target"),
                        payload.get("project"),
                        payload["status"],
                        payload.get("error_reason"),
                        int(payload.get("input_chars") or 0),
                        int(payload.get("output_chars") or 0),
                        int(payload.get("input_tokens") or 0),
                        int(payload.get("output_tokens") or 0),
                        int(payload.get("cached_tokens") or 0),
                        float(payload.get("estimated_cost") or 0),
                        payload.get("usage_source"),
                        payload.get("input_preview"),
                        payload.get("output_preview"),
                        payload.get("input_hash"),
                        payload.get("output_hash"),
                        _json_dumps(payload.get("metadata") or {}),
                        payload.get("raw_input_payload"),
                        payload.get("raw_output_payload"),
                        payload.get("started_at"),
                        payload.get("ended_at"),
                    ),
                )
                conn.commit()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            pass
        return payload

    def _update_request_log(self, request_id: str, payload: Dict[str, Any]) -> None:
        self._memory_request_logs[request_id] = dict(payload)
        if not self._db_ready():
            return
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE ai_request_logs
                    SET batch_envelope_id = %s,
                        status = %s,
                        error_reason = %s,
                        output_chars = %s,
                        input_tokens = %s,
                        output_tokens = %s,
                        cached_tokens = %s,
                        estimated_cost = %s,
                        usage_source = %s,
                        output_preview = %s,
                        output_hash = %s,
                        metadata = %s,
                        raw_output_payload = %s,
                        ended_at = %s
                    WHERE request_id = %s
                    """,
                    (
                        payload.get("batch_envelope_id"),
                        payload["status"],
                        payload.get("error_reason"),
                        int(payload.get("output_chars") or 0),
                        int(payload.get("input_tokens") or 0),
                        int(payload.get("output_tokens") or 0),
                        int(payload.get("cached_tokens") or 0),
                        float(payload.get("estimated_cost") or 0),
                        payload.get("usage_source"),
                        payload.get("output_preview"),
                        payload.get("output_hash"),
                        _json_dumps(payload.get("metadata") or {}),
                        payload.get("raw_output_payload"),
                        payload.get("ended_at"),
                        request_id,
                    ),
                )
                conn.commit()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            pass

    def _get_request_log(
        self,
        *,
        request_id: Optional[str] = None,
        batch_envelope_id: Optional[str] = None,
        external_request_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if request_id and request_id in self._memory_request_logs:
            return self._normalize_log_row(dict(self._memory_request_logs[request_id]))
        if batch_envelope_id and external_request_id:
            for item in self._memory_request_logs.values():
                if (
                    item.get("batch_envelope_id") == batch_envelope_id
                    and item.get("external_request_id") == external_request_id
                ):
                    return self._normalize_log_row(dict(item))
        if not self._db_ready():
            return None

        clauses = []
        params: List[Any] = []
        if request_id:
            clauses.append("request_id = %s")
            params.append(request_id)
        if batch_envelope_id:
            clauses.append("batch_envelope_id = %s")
            params.append(batch_envelope_id)
        if external_request_id:
            clauses.append("external_request_id = %s")
            params.append(external_request_id)
        if not clauses:
            return None

        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(
                    f"""
                    SELECT request_id, external_request_id, batch_envelope_id,
                           source, feature, provider, mode, model,
                           job_id, target, project, status, error_reason,
                           input_chars, output_chars, input_tokens, output_tokens, cached_tokens,
                           estimated_cost, usage_source,
                           input_preview, output_preview, input_hash, output_hash,
                           metadata, raw_input_payload, raw_output_payload,
                           started_at, ended_at, created_at
                    FROM ai_request_logs
                    WHERE {' AND '.join(clauses)}
                    LIMIT 1
                    """,
                    tuple(params),
                )
                row = cursor.fetchone()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            return None
        if not row:
            return None
        return self._normalize_log_row(dict(row))

    def _memory_rows(self) -> List[Dict[str, Any]]:
        return [dict(item) for item in self._memory_request_logs.values()]

    def _filter_memory_rows(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        project: Optional[str] = None,
        source: Optional[str] = None,
        status: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        mode: Optional[str] = None,
        job_id: Optional[str] = None,
        source_prefix: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        rows = []
        parsed_from = datetime.fromisoformat(date_from) if date_from else None
        parsed_to = datetime.fromisoformat(date_to) if date_to else None
        for row in self._memory_rows():
            created_at = row.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except Exception:
                    created_at = None
            if parsed_from and created_at and created_at < parsed_from:
                continue
            if parsed_to and created_at and created_at >= parsed_to:
                continue
            if project and row.get("project") != project:
                continue
            if source and row.get("source") != source:
                continue
            if status and row.get("status") != status:
                continue
            if provider and row.get("provider") != provider:
                continue
            if model and row.get("model") != model:
                continue
            if mode and row.get("mode") != mode:
                continue
            if job_id and row.get("job_id") != job_id:
                continue
            if source_prefix and not str(row.get("source") or "").startswith(source_prefix):
                continue
            rows.append(row)
        rows.sort(
            key=lambda item: item.get("created_at") or datetime.min,
            reverse=True,
        )
        return rows

    def begin_request(
        self,
        *,
        payload: Any,
        provider: str,
        mode: str,
        model: str,
        context: Optional[Dict[str, Any]] = None,
        external_request_id: Optional[str] = None,
        batch_envelope_id: Optional[str] = None,
        status: str = "running",
    ) -> Dict[str, Any]:
        ctx = self.normalize_context(context)
        policy = self.get_budget_policy()
        preview = self._build_preview_bundle(
            payload, allow_raw=bool(policy.get("raw_payload_retention_enabled"))
        )
        request_id = str(uuid.uuid4())
        error_message = self._check_budget_status()
        if error_message:
            blocked = {
                "request_id": request_id,
                "external_request_id": external_request_id,
                "batch_envelope_id": batch_envelope_id,
                **ctx,
                "provider": provider,
                "mode": mode,
                "model": model,
                "status": "blocked_budget",
                "error_reason": error_message,
                "input_chars": preview["chars"],
                "output_chars": 0,
                "input_tokens": self._estimate_tokens_from_text(
                    self._stringify_payload(payload)
                ),
                "output_tokens": 0,
                "cached_tokens": 0,
                "estimated_cost": 0.0,
                "usage_source": "estimated",
                "input_preview": preview["preview"],
                "output_preview": "",
                "input_hash": preview["hash"],
                "output_hash": "",
                "raw_input_payload": preview["raw_payload"],
                "raw_output_payload": None,
                "started_at": _utc_now(),
                "ended_at": _utc_now(),
            }
            self._insert_request_log(blocked)
            raise AiBudgetExceededError(error_message)

        record = {
            "request_id": request_id,
            "external_request_id": external_request_id,
            "batch_envelope_id": batch_envelope_id,
            **ctx,
            "provider": provider,
            "mode": mode,
            "model": model,
            "status": status,
            "error_reason": None,
            "input_chars": preview["chars"],
            "output_chars": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "cached_tokens": 0,
            "estimated_cost": 0.0,
            "usage_source": None,
            "input_preview": preview["preview"],
            "output_preview": "",
            "input_hash": preview["hash"],
            "output_hash": "",
            "raw_input_payload": preview["raw_payload"],
            "raw_output_payload": None,
            "started_at": _utc_now(),
            "ended_at": None,
        }
        self._insert_request_log(record)
        return record

    def complete_request(
        self,
        request_id: str,
        *,
        provider: str,
        mode: str,
        model: str,
        output_payload: Any,
        usage: Any = None,
        status: str = "completed",
        error_reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        batch_envelope_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = self._get_request_log(request_id=request_id)
        if not existing:
            raise RuntimeError(f"AI request log not found: {request_id}")

        policy = self.get_budget_policy()
        output_preview = self._build_preview_bundle(
            output_payload, allow_raw=bool(policy.get("raw_payload_retention_enabled"))
        )
        usage_values = self._extract_usage(usage)
        usage_source = "reported"
        if not usage_values["input_tokens"] and existing["input_chars"]:
            usage_values["input_tokens"] = self._estimate_tokens_from_text(
                self._stringify_payload(existing.get("raw_input_payload") or existing["input_preview"])
            )
            usage_source = "estimated"
        if not usage_values["output_tokens"] and output_preview["chars"]:
            usage_values["output_tokens"] = self._estimate_tokens_from_text(
                self._stringify_payload(output_payload)
            )
            usage_source = "estimated"
        estimated_cost = self._calculate_cost(
            provider=provider,
            mode=mode,
            model=model,
            input_tokens=usage_values["input_tokens"],
            output_tokens=usage_values["output_tokens"],
            cached_tokens=usage_values["cached_tokens"],
        )
        merged_metadata = dict(existing.get("metadata") or {})
        if metadata:
            merged_metadata.update(metadata)

        updated = {
            **existing,
            "batch_envelope_id": batch_envelope_id or existing.get("batch_envelope_id"),
            "status": status,
            "error_reason": error_reason,
            "input_tokens": usage_values["input_tokens"],
            "output_tokens": usage_values["output_tokens"],
            "cached_tokens": usage_values["cached_tokens"],
            "output_chars": output_preview["chars"],
            "estimated_cost": estimated_cost,
            "usage_source": usage_source,
            "output_preview": output_preview["preview"],
            "output_hash": output_preview["hash"],
            "raw_output_payload": output_preview["raw_payload"],
            "metadata": merged_metadata,
            "ended_at": _utc_now(),
        }
        self._update_request_log(request_id, updated)
        return updated

    def fail_request(
        self,
        request_id: str,
        *,
        provider: str,
        mode: str,
        model: str,
        error_reason: str,
        output_payload: Any = None,
        usage: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
        batch_envelope_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.complete_request(
            request_id,
            provider=provider,
            mode=mode,
            model=model,
            output_payload=output_payload,
            usage=usage,
            status="failed",
            error_reason=error_reason,
            metadata=metadata,
            batch_envelope_id=batch_envelope_id,
        )

    def prepare_batch_requests(
        self,
        requests: Iterable[Dict[str, Any]],
        *,
        provider: str,
        mode: str,
        default_model: str,
        default_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        request_list = list(requests)
        if not request_list:
            return {}

        error_message = self._check_budget_status()
        if error_message:
            for item in request_list:
                payload = item.get("messages") or []
                ctx = {
                    **self.normalize_context(default_context),
                    **self.normalize_context(item.get("telemetry")),
                }
                preview = self._build_preview_bundle(
                    payload,
                    allow_raw=bool(
                        self.get_budget_policy().get("raw_payload_retention_enabled")
                    ),
                )
                self._insert_request_log(
                    {
                        "request_id": str(uuid.uuid4()),
                        "external_request_id": item.get("custom_id"),
                        "batch_envelope_id": None,
                        **ctx,
                        "provider": provider,
                        "mode": mode,
                        "model": item.get("model") or default_model,
                        "status": "blocked_budget",
                        "error_reason": error_message,
                        "input_chars": preview["chars"],
                        "output_chars": 0,
                        "input_tokens": self._estimate_tokens_from_text(
                            self._stringify_payload(payload)
                        ),
                        "output_tokens": 0,
                        "cached_tokens": 0,
                        "estimated_cost": 0.0,
                        "usage_source": "estimated",
                        "input_preview": preview["preview"],
                        "output_preview": "",
                        "input_hash": preview["hash"],
                        "output_hash": "",
                        "metadata": ctx.get("metadata") or {},
                        "raw_input_payload": preview["raw_payload"],
                        "raw_output_payload": None,
                        "started_at": _utc_now(),
                        "ended_at": _utc_now(),
                    }
                )
            raise AiBudgetExceededError(error_message)

        pending: Dict[str, Dict[str, Any]] = {}
        for item in request_list:
            record = self.begin_request(
                payload=item.get("messages") or [],
                provider=provider,
                mode=mode,
                model=item.get("model") or default_model,
                context={**(default_context or {}), **(item.get("telemetry") or {})},
                external_request_id=item.get("custom_id"),
                status="submitted",
            )
            pending[item["custom_id"]] = record
        return pending

    def bind_batch_envelope(
        self, batch_id: str, pending_requests: Dict[str, Dict[str, Any]]
    ) -> None:
        if not pending_requests:
            return
        self._pending_batches[batch_id] = pending_requests
        for item in pending_requests.values():
            item["batch_envelope_id"] = batch_id
            self._memory_request_logs[item["request_id"]] = dict(item)
        if not self._db_ready():
            return
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE ai_request_logs
                    SET batch_envelope_id = %s
                    WHERE request_id = ANY(%s)
                    """,
                    (
                        batch_id,
                        [item["request_id"] for item in pending_requests.values()],
                    ),
                )
                conn.commit()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            pass

    def resolve_batch_request(
        self,
        *,
        batch_id: str,
        custom_id: str,
        provider: str,
        mode: str,
        model: str,
        output_payload: Any = None,
        usage: Any = None,
        error_reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        pending = self._pending_batches.get(batch_id, {})
        record = pending.get(custom_id)
        if not record:
            record = self._get_request_log(
                batch_envelope_id=batch_id, external_request_id=custom_id
            )
        if not record:
            raise RuntimeError(
                f"AI batch request log not found for batch_id={batch_id}, custom_id={custom_id}"
            )
        if error_reason:
            return self.fail_request(
                record["request_id"],
                provider=provider,
                mode=mode,
                model=model,
                error_reason=error_reason,
                output_payload=output_payload,
                usage=usage,
                metadata=metadata,
                batch_envelope_id=batch_id,
            )
        return self.complete_request(
            record["request_id"],
            provider=provider,
            mode=mode,
            model=model,
            output_payload=output_payload,
            usage=usage,
            metadata=metadata,
            batch_envelope_id=batch_id,
        )

    def finalize_batch_tracking(self, batch_id: str) -> None:
        self._pending_batches.pop(batch_id, None)

    def _normalize_log_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        item = dict(row)
        item["metadata"] = _json_loads(item.get("metadata"), {})
        for key in ("created_at", "started_at", "ended_at"):
            if isinstance(item.get(key), datetime):
                item[key] = item[key].isoformat()
        return item

    def annotate_scope(
        self,
        *,
        job_id: Optional[str],
        metadata: Dict[str, Any],
        source_prefix: Optional[str] = None,
    ) -> None:
        if not job_id or not metadata:
            return
        merged_updates = dict(metadata)
        rows = self._filter_memory_rows(job_id=job_id, source_prefix=source_prefix)
        for row in rows:
            current = dict(row.get("metadata") or {})
            current.update(merged_updates)
            row["metadata"] = current
            self._memory_request_logs[row["request_id"]] = dict(row)

        if not self._db_ready():
            return

        where = ["job_id = %s"]
        params: List[Any] = [job_id]
        if source_prefix:
            where.append("source LIKE %s")
            params.append(f"{source_prefix}%")
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(
                    f"""
                    SELECT request_id, metadata
                    FROM ai_request_logs
                    WHERE {' AND '.join(where)}
                    """,
                    tuple(params),
                )
                rows = cursor.fetchall()
                for row in rows:
                    current = _json_loads(row.get("metadata"), {})
                    current.update(merged_updates)
                    cursor.execute(
                        """
                        UPDATE ai_request_logs
                        SET metadata = %s
                        WHERE request_id = %s
                        """,
                        (_json_dumps(current), row["request_id"]),
                    )
                conn.commit()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
        except Exception:
            logger.debug("Failed to annotate AI telemetry scope.", exc_info=True)

    def list_requests(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        project: Optional[str] = None,
        source: Optional[str] = None,
        status: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        mode: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> Dict[str, Any]:
        where = []
        params: List[Any] = []
        if date_from:
            where.append("created_at >= %s")
            params.append(date_from)
        if date_to:
            where.append("created_at < %s")
            params.append(date_to)
        if project:
            where.append("project = %s")
            params.append(project)
        if source:
            where.append("source = %s")
            params.append(source)
        if status:
            where.append("status = %s")
            params.append(status)
        if provider:
            where.append("provider = %s")
            params.append(provider)
        if model:
            where.append("model = %s")
            params.append(model)
        if mode:
            where.append("mode = %s")
            params.append(mode)

        clause = f"WHERE {' AND '.join(where)}" if where else ""
        limit = max(1, min(int(page_size), 100))
        offset = max(int(page) - 1, 0) * limit

        if not self._db_ready():
            filtered = self._filter_memory_rows(
                date_from=date_from,
                date_to=date_to,
                project=project,
                source=source,
                status=status,
                provider=provider,
                model=model,
                mode=mode,
            )
            total = len(filtered)
            items = [
                self._normalize_log_row(dict(row))
                for row in filtered[offset : offset + limit]
            ]
            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": limit,
            }

        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(
                    f"SELECT COUNT(*) AS count FROM ai_request_logs {clause}",
                    tuple(params),
                )
                total = int(cursor.fetchone()["count"])
                cursor.execute(
                    f"""
                    SELECT request_id, external_request_id, batch_envelope_id,
                           source, feature, provider, mode, model,
                           job_id, target, project, status, error_reason,
                           input_chars, output_chars, input_tokens, output_tokens, cached_tokens,
                           estimated_cost, usage_source,
                           input_preview, output_preview, input_hash, output_hash,
                           metadata, started_at, ended_at, created_at
                    FROM ai_request_logs
                    {clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    tuple(params + [limit, offset]),
                )
                rows = cursor.fetchall()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
            items = [self._normalize_log_row(dict(row)) for row in rows]
        except Exception:
            filtered = self._filter_memory_rows(
                date_from=date_from,
                date_to=date_to,
                project=project,
                source=source,
                status=status,
                provider=provider,
                model=model,
                mode=mode,
            )
            total = len(filtered)
            items = [
                self._normalize_log_row(dict(row))
                for row in filtered[offset : offset + limit]
            ]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": limit,
        }

    def get_request_detail(self, request_id: str) -> Optional[Dict[str, Any]]:
        return self._get_request_log(request_id=request_id)

    def _fetch_aggregate_rows(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        where = []
        params: List[Any] = []
        if date_from:
            where.append("created_at >= %s")
            params.append(date_from)
        if date_to:
            where.append("created_at < %s")
            params.append(date_to)
        clause = f"WHERE {' AND '.join(where)}" if where else ""
        if not self._db_ready():
            return self._filter_memory_rows(date_from=date_from, date_to=date_to)
        try:
            conn = AuditDatabase.get_connection()
            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(
                    f"""
                    SELECT created_at, source, feature, provider, mode, model, project, status,
                           input_tokens, output_tokens, cached_tokens,
                           estimated_cost, usage_source
                    FROM ai_request_logs
                    {clause}
                    ORDER BY created_at ASC
                    """,
                    tuple(params),
                )
                rows = cursor.fetchall()
                cursor.close()
            finally:
                AuditDatabase.release_connection(conn)
            return [dict(row) for row in rows]
        except Exception:
            filtered = self._filter_memory_rows(date_from=date_from, date_to=date_to)
            return filtered

    def get_overview(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = self._fetch_aggregate_rows(date_from=date_from, date_to=date_to)
        now = _utc_now()
        today_start = datetime(now.year, now.month, now.day)
        month_start = datetime(now.year, now.month, 1)

        def cost_sum(items: Iterable[Dict[str, Any]]) -> float:
            return round(
                sum(float(item.get("estimated_cost") or 0) for item in items),
                8,
            )

        today_rows = [
            row
            for row in rows
            if isinstance(row.get("created_at"), datetime)
            and row["created_at"] >= today_start
        ]
        month_rows = [
            row
            for row in rows
            if isinstance(row.get("created_at"), datetime)
            and row["created_at"] >= month_start
        ]
        top_models: Dict[str, float] = {}
        top_projects: Dict[str, float] = {}
        top_features: Dict[str, float] = {}
        by_source: Dict[str, Dict[str, Any]] = {}
        by_provider: Dict[str, Dict[str, Any]] = {}
        by_model: Dict[str, Dict[str, Any]] = {}
        by_mode: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            amount = float(row.get("estimated_cost") or 0)
            top_models[row.get("model") or "unknown"] = (
                top_models.get(row.get("model") or "unknown", 0.0) + amount
            )
            top_projects[row.get("project") or "unknown"] = (
                top_projects.get(row.get("project") or "unknown", 0.0) + amount
            )
            top_features[row.get("feature") or "unknown"] = (
                top_features.get(row.get("feature") or "unknown", 0.0) + amount
            )
            for bucket_map, key in (
                (by_source, row.get("source") or "unknown"),
                (by_provider, row.get("provider") or "unknown"),
                (by_model, row.get("model") or "unknown"),
                (by_mode, row.get("mode") or "unknown"),
            ):
                bucket = bucket_map.setdefault(
                    key,
                    {
                        "label": key,
                        "requests": 0,
                        "cost_usd": 0.0,
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "blocked_requests": 0,
                    },
                )
                bucket["requests"] += 1
                bucket["cost_usd"] = round(bucket["cost_usd"] + amount, 8)
                bucket["input_tokens"] += int(row.get("input_tokens") or 0)
                bucket["output_tokens"] += int(row.get("output_tokens") or 0)
                if row.get("status") == "blocked_budget":
                    bucket["blocked_requests"] += 1

        def _sorted_breakdown(source: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
            return sorted(
                source.values(),
                key=lambda item: (item["cost_usd"], item["requests"]),
                reverse=True,
            )

        total_requests = len(rows)
        blocked_requests = sum(1 for row in rows if row.get("status") == "blocked_budget")
        health_requests = [row for row in rows if row.get("source") == "health.ai"]
        realtime_requests = sum(1 for row in rows if row.get("mode") == "realtime")
        batch_requests = sum(1 for row in rows if row.get("mode") == "openai_batch")
        reported_requests = sum(1 for row in rows if row.get("usage_source") == "reported")
        estimated_requests = sum(1 for row in rows if row.get("usage_source") == "estimated")

        return {
            "spend_today_usd": cost_sum(today_rows),
            "spend_month_usd": cost_sum(month_rows),
            "total_requests": total_requests,
            "blocked_requests": blocked_requests,
            "input_tokens": int(sum(int(row.get("input_tokens") or 0) for row in rows)),
            "output_tokens": int(sum(int(row.get("output_tokens") or 0) for row in rows)),
            "cached_tokens": int(sum(int(row.get("cached_tokens") or 0) for row in rows)),
            "health_check_share": {
                "requests": len(health_requests),
                "cost_usd": cost_sum(health_requests),
            },
            "mode_split": {
                "realtime": realtime_requests,
                "openai_batch": batch_requests,
            },
            "usage_split": {
                "reported": reported_requests,
                "estimated": estimated_requests,
            },
            "breakdowns": {
                "source": _sorted_breakdown(by_source),
                "provider": _sorted_breakdown(by_provider),
                "model": _sorted_breakdown(by_model),
                "mode": _sorted_breakdown(by_mode),
            },
            "top_models": sorted(
                (
                    {"model": key, "cost_usd": round(value, 8)}
                    for key, value in top_models.items()
                ),
                key=lambda item: item["cost_usd"],
                reverse=True,
            )[:5],
            "top_projects": sorted(
                (
                    {"project": key, "cost_usd": round(value, 8)}
                    for key, value in top_projects.items()
                ),
                key=lambda item: item["cost_usd"],
                reverse=True,
            )[:5],
            "top_features": sorted(
                (
                    {"feature": key, "cost_usd": round(value, 8)}
                    for key, value in top_features.items()
                ),
                key=lambda item: item["cost_usd"],
                reverse=True,
            )[:5],
        }

    def get_usage_series(
        self,
        *,
        granularity: str = "day",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        rows = self._fetch_aggregate_rows(date_from=date_from, date_to=date_to)
        buckets: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            created_at = row.get("created_at")
            if not isinstance(created_at, datetime):
                continue
            if granularity == "hour":
                bucket = created_at.replace(minute=0, second=0, microsecond=0).isoformat()
            else:
                bucket = created_at.date().isoformat()
            entry = buckets.setdefault(
                bucket,
                {
                    "bucket": bucket,
                    "request_count": 0,
                    "cost_usd": 0.0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "reported_requests": 0,
                    "estimated_requests": 0,
                    "blocked_requests": 0,
                },
            )
            entry["request_count"] += 1
            entry["cost_usd"] = round(
                entry["cost_usd"] + float(row.get("estimated_cost") or 0),
                8,
            )
            entry["input_tokens"] += int(row.get("input_tokens") or 0)
            entry["output_tokens"] += int(row.get("output_tokens") or 0)
            if row.get("usage_source") == "reported":
                entry["reported_requests"] += 1
            elif row.get("usage_source") == "estimated":
                entry["estimated_requests"] += 1
            if row.get("status") == "blocked_budget":
                entry["blocked_requests"] += 1
        return [buckets[key] for key in sorted(buckets.keys())]

    def summarize_scope(
        self,
        *,
        job_id: Optional[str],
        source_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not job_id:
            return dict(self.EMPTY_SUMMARY)
        if not self._db_ready():
            rows = self._filter_memory_rows(job_id=job_id, source_prefix=source_prefix)
        else:
            rows = None

        where = ["job_id = %s"]
        params: List[Any] = [job_id]
        if source_prefix:
            where.append("source LIKE %s")
            params.append(f"{source_prefix}%")

        if rows is None:
            try:
                conn = AuditDatabase.get_connection()
                try:
                    cursor = conn.cursor(cursor_factory=RealDictCursor)
                    cursor.execute(
                        f"""
                        SELECT source, status, usage_source,
                               input_tokens, output_tokens, cached_tokens, estimated_cost
                        FROM ai_request_logs
                        WHERE {' AND '.join(where)}
                        """,
                        tuple(params),
                    )
                    rows = cursor.fetchall()
                    cursor.close()
                finally:
                    AuditDatabase.release_connection(conn)
            except Exception:
                rows = self._filter_memory_rows(
                    job_id=job_id,
                    source_prefix=source_prefix,
                )

        by_source: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            source = row.get("source") or "unknown"
            item = by_source.setdefault(
                source,
                {
                    "requests": 0,
                    "blocked_requests": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cached_tokens": 0,
                    "cost_usd": 0.0,
                },
            )
            item["requests"] += 1
            if row.get("status") == "blocked_budget":
                item["blocked_requests"] += 1
            item["input_tokens"] += int(row.get("input_tokens") or 0)
            item["output_tokens"] += int(row.get("output_tokens") or 0)
            item["cached_tokens"] += int(row.get("cached_tokens") or 0)
            item["cost_usd"] = round(
                item["cost_usd"] + float(row.get("estimated_cost") or 0),
                8,
            )

        return {
            "total_requests": len(rows),
            "blocked_requests": sum(
                1 for row in rows if row.get("status") == "blocked_budget"
            ),
            "input_tokens": sum(int(row.get("input_tokens") or 0) for row in rows),
            "output_tokens": sum(int(row.get("output_tokens") or 0) for row in rows),
            "cached_tokens": sum(int(row.get("cached_tokens") or 0) for row in rows),
            "cost_usd": round(
                sum(float(row.get("estimated_cost") or 0) for row in rows),
                8,
            ),
            "reported_requests": sum(
                1 for row in rows if row.get("usage_source") == "reported"
            ),
            "estimated_requests": sum(
                1 for row in rows if row.get("usage_source") == "estimated"
            ),
            "by_source": by_source,
        }


ai_telemetry = AiTelemetry()
