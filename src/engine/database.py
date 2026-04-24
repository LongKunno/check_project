"""
Database Layer (V2.0.0 - PostgreSQL Migration)
Handles persistence of audit sessions using PostgreSQL.
"""

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
import os
import json
import logging
from datetime import datetime, timedelta, timezone

from src.config import (
    REGRESSION_GATE_ENABLED,
    REGRESSION_NEW_CRITICAL_THRESHOLD,
    REGRESSION_PILLAR_DROP_THRESHOLD,
    REGRESSION_SCORE_DROP_THRESHOLD,
    REGRESSION_VIOLATIONS_INCREASE_THRESHOLD,
)

logger = logging.getLogger(__name__)

# Database URL: PHẢI được cấu hình qua biến môi trường DATABASE_URL hoặc docker-compose.yml
# Không còn hardcoded DSN fallback; nếu thiếu DB thì hệ thống chạy ở chế độ non-persistent.
DB_URL = (os.environ.get("DATABASE_URL") or "").strip()
DB_URL_FROM_ENV = bool(DB_URL)
if not DB_URL:
    logger.warning(
        "DATABASE_URL not set. Running without DB-backed persistence; repository management falls back to in-memory config and audit/history/settings persistence are disabled."
    )


class AuditDatabase:
    """
    Manages the PostgreSQL database for audit history.
    """

    _pool = None
    _memory_repositories = None
    _memory_repo_mode_logged = False
    PILLAR_KEYS = ("Performance", "Maintainability", "Reliability", "Security")
    REGRESSION_STATUSES = {"pass", "warning", "unavailable"}

    @staticmethod
    def _log_memory_repo_mode():
        if AuditDatabase._memory_repo_mode_logged:
            return
        logger.warning(
            "Database persistence is unavailable. Using in-memory repositories only; history, review snapshots, rules, and runtime settings are not persisted."
        )
        AuditDatabase._memory_repo_mode_logged = True

    @staticmethod
    def _memory_timestamp():
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _ensure_memory_repositories():
        AuditDatabase._log_memory_repo_mode()
        if AuditDatabase._memory_repositories is not None:
            return AuditDatabase._memory_repositories

        from src.config import CONFIGURED_REPOSITORIES

        now = AuditDatabase._memory_timestamp()
        AuditDatabase._memory_repositories = {}
        for repo in CONFIGURED_REPOSITORIES:
            repo_id = str(repo.get("id") or "").strip()
            if not repo_id:
                continue
            AuditDatabase._memory_repositories[repo_id] = {
                "id": repo_id,
                "name": str(repo.get("name") or "").strip(),
                "url": str(repo.get("url") or "").strip(),
                "username": str(repo.get("username") or ""),
                "token": str(repo.get("token") or ""),
                "branch": str(repo.get("branch") or "main"),
                "is_active": bool(repo.get("is_active", True)),
                "created_at": now,
                "updated_at": now,
            }
        return AuditDatabase._memory_repositories

    @staticmethod
    def _list_memory_repositories(include_credentials=False):
        repositories = sorted(
            AuditDatabase._ensure_memory_repositories().values(),
            key=lambda item: item.get("name") or "",
        )
        results = []
        for row in repositories:
            if not row.get("is_active", True):
                continue
            item = dict(row)
            if not include_credentials:
                item.pop("token", None)
                item.pop("username", None)
            results.append(item)
        return results

    @staticmethod
    def _coerce_bool(value, default=False):
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"true", "1", "yes", "on"}

    @staticmethod
    def _coerce_int(value, default=0, minimum=None, maximum=None):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return default
        if minimum is not None and parsed < minimum:
            return default
        if maximum is not None and parsed > maximum:
            return default
        return parsed

    @staticmethod
    def _coerce_float(value, default=0.0, minimum=None, maximum=None):
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return default
        if minimum is not None and parsed < minimum:
            return default
        if maximum is not None and parsed > maximum:
            return default
        return parsed

    @staticmethod
    def _parse_json_blob(raw_value, default=None):
        if raw_value is None:
            return default
        if isinstance(raw_value, (dict, list)):
            return raw_value
        try:
            return json.loads(raw_value)
        except Exception:
            return default

    @staticmethod
    def _normalize_timestamp(value):
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    @staticmethod
    def _empty_regression_summary():
        return {
            "baseline_audit_id": None,
            "baseline_timestamp": None,
            "baseline_score": None,
            "baseline_violations_count": None,
            "current_score": None,
            "current_violations_count": None,
            "score_delta": None,
            "violations_delta": None,
            "new_violation_count": 0,
            "resolved_violation_count": 0,
            "new_high_severity_count": 0,
            "pillar_deltas": {},
            "triggered_signals": [],
            "is_partial": False,
            "gate_enabled": REGRESSION_GATE_ENABLED,
        }

    @staticmethod
    def get_regression_settings():
        return {
            "gate_enabled": AuditDatabase._coerce_bool(
                AuditDatabase.get_config(
                    "regression_gate_enabled", str(REGRESSION_GATE_ENABLED).lower()
                ),
                default=REGRESSION_GATE_ENABLED,
            ),
            "score_drop_threshold": AuditDatabase._coerce_float(
                AuditDatabase.get_config(
                    "regression_score_drop_threshold",
                    REGRESSION_SCORE_DROP_THRESHOLD,
                ),
                default=REGRESSION_SCORE_DROP_THRESHOLD,
                minimum=0.0,
                maximum=100.0,
            ),
            "violations_increase_threshold": AuditDatabase._coerce_int(
                AuditDatabase.get_config(
                    "regression_violations_increase_threshold",
                    REGRESSION_VIOLATIONS_INCREASE_THRESHOLD,
                ),
                default=REGRESSION_VIOLATIONS_INCREASE_THRESHOLD,
                minimum=0,
                maximum=100000,
            ),
            "pillar_drop_threshold": AuditDatabase._coerce_float(
                AuditDatabase.get_config(
                    "regression_pillar_drop_threshold",
                    REGRESSION_PILLAR_DROP_THRESHOLD,
                ),
                default=REGRESSION_PILLAR_DROP_THRESHOLD,
                minimum=0.0,
                maximum=10.0,
            ),
            "new_critical_threshold": AuditDatabase._coerce_int(
                AuditDatabase.get_config(
                    "regression_new_critical_threshold",
                    REGRESSION_NEW_CRITICAL_THRESHOLD,
                ),
                default=REGRESSION_NEW_CRITICAL_THRESHOLD,
                minimum=0,
                maximum=100000,
            ),
        }

    @staticmethod
    def _normalize_violation_reason_for_signature(reason):
        normalized = str(reason or "").strip()
        if ". AI Note:" in normalized:
            normalized = normalized.split(". AI Note:", 1)[0].strip()
        if ". AI " in normalized:
            normalized = normalized.split(". AI ", 1)[0].strip()
        return normalized

    @staticmethod
    def _build_violation_signature(violation):
        return (
            str((violation or {}).get("file") or ""),
            str((violation or {}).get("rule_id") or ""),
            AuditDatabase._coerce_int((violation or {}).get("line"), default=0),
            AuditDatabase._normalize_violation_reason_for_signature(
                (violation or {}).get("reason", "")
            ),
        )

    @staticmethod
    def _infer_violation_severity(violation):
        severity = str((violation or {}).get("severity") or "").strip()
        if severity in {"Blocker", "Critical", "Major", "Minor", "Info"}:
            return severity
        weight = abs(AuditDatabase._coerce_float((violation or {}).get("weight"), 0.0))
        if weight >= 8:
            return "Critical"
        if weight >= 4:
            return "Major"
        if weight >= 1:
            return "Minor"
        return "Info"

    @staticmethod
    def compute_regression_snapshot(current_audit, baseline_audit=None, settings=None):
        settings = settings or AuditDatabase.get_regression_settings()
        summary = AuditDatabase._empty_regression_summary()
        summary["gate_enabled"] = bool(settings.get("gate_enabled", True))

        if not baseline_audit:
            summary["is_partial"] = True
            return {
                "baseline_audit_id": None,
                "regression_status": "unavailable",
                "regression_summary": summary,
            }

        current_full_json = AuditDatabase._parse_json_blob(
            (current_audit or {}).get("full_json"), default=None
        )
        baseline_full_json = AuditDatabase._parse_json_blob(
            (baseline_audit or {}).get("full_json"), default=None
        )

        baseline_id = (baseline_audit or {}).get("id")
        baseline_timestamp = AuditDatabase._normalize_timestamp(
            (baseline_audit or {}).get("timestamp")
        )
        current_score = AuditDatabase._coerce_float(
            (current_audit or {}).get("score"), default=None
        )
        baseline_score = AuditDatabase._coerce_float(
            (baseline_audit or {}).get("score"), default=None
        )
        current_violations_count = AuditDatabase._coerce_int(
            (current_audit or {}).get("violations_count"), default=0
        )
        baseline_violations_count = AuditDatabase._coerce_int(
            (baseline_audit or {}).get("violations_count"), default=0
        )

        summary.update(
            {
                "baseline_audit_id": baseline_id,
                "baseline_timestamp": baseline_timestamp,
                "baseline_score": baseline_score,
                "baseline_violations_count": baseline_violations_count,
                "current_score": current_score,
                "current_violations_count": current_violations_count,
            }
        )

        if not isinstance(current_full_json, dict) or not isinstance(baseline_full_json, dict):
            summary["is_partial"] = True
            return {
                "baseline_audit_id": baseline_id,
                "regression_status": "unavailable",
                "regression_summary": summary,
            }

        score_delta = None
        if current_score is not None and baseline_score is not None:
            score_delta = round(current_score - baseline_score, 2)

        violations_delta = current_violations_count - baseline_violations_count

        current_pillars = AuditDatabase._parse_json_blob(
            (current_audit or {}).get("pillar_scores"), default=None
        ) or (
            ((current_full_json.get("scores") or {}).get("project_pillars")) or {}
        )
        baseline_pillars = AuditDatabase._parse_json_blob(
            (baseline_audit or {}).get("pillar_scores"), default=None
        ) or (
            ((baseline_full_json.get("scores") or {}).get("project_pillars")) or {}
        )

        pillar_deltas = {}
        for pillar in AuditDatabase.PILLAR_KEYS:
            current_value = current_pillars.get(pillar)
            baseline_value = baseline_pillars.get(pillar)
            if current_value is None or baseline_value is None:
                continue
            pillar_deltas[pillar] = round(float(current_value) - float(baseline_value), 2)

        current_violations = current_full_json.get("violations") or []
        baseline_violations = baseline_full_json.get("violations") or []
        current_signatures = {
            AuditDatabase._build_violation_signature(violation): violation
            for violation in current_violations
            if isinstance(violation, dict)
        }
        baseline_signatures = {
            AuditDatabase._build_violation_signature(violation): violation
            for violation in baseline_violations
            if isinstance(violation, dict)
        }

        new_signatures = set(current_signatures) - set(baseline_signatures)
        resolved_signatures = set(baseline_signatures) - set(current_signatures)
        new_high_severity_count = sum(
            1
            for signature in new_signatures
            if AuditDatabase._infer_violation_severity(current_signatures[signature])
            in {"Critical", "Blocker"}
        )

        triggered_signals = []
        if settings.get("gate_enabled", True):
            if (
                score_delta is not None
                and score_delta < 0
                and abs(score_delta) >= abs(settings.get("score_drop_threshold", 0.0))
            ):
                triggered_signals.append("score_drop")
            if (
                violations_delta > 0
                and violations_delta >= settings.get("violations_increase_threshold", 0)
            ):
                triggered_signals.append("violations_increase")
            if any(
                delta < 0
                and abs(delta) >= abs(settings.get("pillar_drop_threshold", 0.0))
                for delta in pillar_deltas.values()
            ):
                triggered_signals.append("pillar_drop")
            if (
                new_high_severity_count > 0
                and new_high_severity_count >= settings.get("new_critical_threshold", 0)
            ):
                triggered_signals.append("new_high_severity")

        summary.update(
            {
                "score_delta": score_delta,
                "violations_delta": violations_delta,
                "new_violation_count": len(new_signatures),
                "resolved_violation_count": len(resolved_signatures),
                "new_high_severity_count": new_high_severity_count,
                "pillar_deltas": pillar_deltas,
                "triggered_signals": triggered_signals,
                "is_partial": False,
            }
        )

        return {
            "baseline_audit_id": baseline_id,
            "regression_status": "warning" if triggered_signals else "pass",
            "regression_summary": summary,
        }

    @staticmethod
    def _attach_regression_metadata(full_json, regression_status, regression_summary):
        if not isinstance(full_json, dict):
            return
        metadata = dict(full_json.get("metadata") or {})
        metadata["regression"] = {
            "status": regression_status,
            **(regression_summary or {}),
        }
        full_json["metadata"] = metadata

    @staticmethod
    def _load_previous_audit_row(conn, target, before_timestamp=None, before_id=None):
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            if before_timestamp is not None and before_id is not None:
                cursor.execute(
                    """
                    SELECT
                        id, timestamp, target, score, rating, total_loc,
                        violations_count, pillar_scores, full_json,
                        baseline_audit_id, regression_status, regression_summary, scan_mode
                    FROM audit_history
                    WHERE target = %s
                      AND (
                        timestamp < %s
                        OR (timestamp = %s AND id < %s)
                      )
                    ORDER BY timestamp DESC, id DESC
                    LIMIT 1
                    """,
                    (target, before_timestamp, before_timestamp, before_id),
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        id, timestamp, target, score, rating, total_loc,
                        violations_count, pillar_scores, full_json,
                        baseline_audit_id, regression_status, regression_summary, scan_mode
                    FROM audit_history
                    WHERE target = %s
                    ORDER BY timestamp DESC, id DESC
                    LIMIT 1
                    """,
                    (target,),
                )
            row = cursor.fetchone()
        finally:
            cursor.close()

        if not row:
            return None

        parsed = dict(row)
        parsed["timestamp"] = AuditDatabase._normalize_timestamp(parsed.get("timestamp"))
        parsed["pillar_scores"] = AuditDatabase._parse_json_blob(
            parsed.get("pillar_scores"), default={}
        ) or {}
        parsed["full_json"] = AuditDatabase._parse_json_blob(
            parsed.get("full_json"), default=None
        )
        parsed["regression_summary"] = AuditDatabase._parse_json_blob(
            parsed.get("regression_summary"), default=None
        )
        return parsed

    @staticmethod
    def _apply_regression_payload(data, full_json=None, fallback_baseline=None, settings=None):
        settings = settings or AuditDatabase.get_regression_settings()
        summary = AuditDatabase._parse_json_blob(
            data.get("regression_summary"), default=None
        )
        if not isinstance(summary, dict) and isinstance(full_json, dict):
            summary = AuditDatabase._parse_json_blob(
                ((full_json.get("metadata") or {}).get("regression")),
                default=None,
            )

        baseline_audit_id = data.get("baseline_audit_id")
        regression_status = data.get("regression_status")
        if isinstance(summary, dict):
            baseline_audit_id = baseline_audit_id or summary.get("baseline_audit_id")
            if regression_status not in AuditDatabase.REGRESSION_STATUSES:
                regression_status = summary.get("status")
            summary = {
                **AuditDatabase._empty_regression_summary(),
                **{k: v for k, v in summary.items() if k != "status"},
            }

        if regression_status not in AuditDatabase.REGRESSION_STATUSES or not isinstance(summary, dict):
            if isinstance(full_json, dict) and fallback_baseline:
                computed = AuditDatabase.compute_regression_snapshot(
                    {
                        "id": data.get("id"),
                        "score": data.get("score"),
                        "violations_count": data.get("violations_count"),
                        "pillar_scores": data.get("pillar_scores"),
                        "full_json": full_json,
                    },
                    baseline_audit=fallback_baseline,
                    settings=settings,
                )
                baseline_audit_id = computed["baseline_audit_id"]
                regression_status = computed["regression_status"]
                summary = computed["regression_summary"]
            else:
                regression_status = "unavailable"
                summary = AuditDatabase._empty_regression_summary()
                summary["gate_enabled"] = bool(settings.get("gate_enabled", True))
                summary["baseline_audit_id"] = baseline_audit_id
                if fallback_baseline:
                    summary["baseline_audit_id"] = fallback_baseline.get("id")
                    summary["baseline_timestamp"] = fallback_baseline.get("timestamp")
                summary["is_partial"] = True

        data["baseline_audit_id"] = baseline_audit_id
        data["regression_status"] = regression_status
        data["regression_summary"] = summary
        return data

    @staticmethod
    def _parse_history_row(row, include_full_json=False, fallback_baseline=None, settings=None):
        if not row:
            return None

        data = dict(row)
        data["timestamp"] = AuditDatabase._normalize_timestamp(data.get("timestamp"))
        try:
            data["pillar_scores"] = AuditDatabase._parse_json_blob(
                data.get("pillar_scores"), default={}
            ) or {}
        except Exception as exc:
            logger.warning("Error parsing pillar_scores: %s", exc)
            data["pillar_scores"] = {}

        full_json = AuditDatabase._parse_json_blob(data.get("full_json"), default=None)
        data["ai_summary"] = AuditDatabase._extract_ai_summary(full_json)
        data = AuditDatabase._apply_regression_payload(
            data,
            full_json=full_json,
            fallback_baseline=fallback_baseline,
            settings=settings,
        )

        if include_full_json:
            data["full_json"] = full_json
        else:
            data.pop("full_json", None)
        return data

    @staticmethod
    def get_connection():
        # Lazy initialization
        if not AuditDatabase._pool:
            AuditDatabase.initialize()
        if not AuditDatabase._pool:
            raise RuntimeError(
                "Database-backed persistence is unavailable because DATABASE_URL is not configured or Postgres could not be reached."
            )
        return AuditDatabase._pool.getconn()

    @staticmethod
    def release_connection(conn):
        if AuditDatabase._pool and conn:
            AuditDatabase._pool.putconn(conn)

    @staticmethod
    def initialize():
        """Creates the necessary tables if they don't exist, retries connection on startup."""
        import time

        if not DB_URL_FROM_ENV:
            AuditDatabase._log_memory_repo_mode()
            return

        max_retries = 10
        conn = None
        cursor = None
        schema_ready = False
        for i in range(max_retries):
            try:
                if not AuditDatabase._pool:
                    AuditDatabase._pool = pool.ThreadedConnectionPool(1, 20, DB_URL)
                conn = AuditDatabase._pool.getconn()
                break
            except psycopg2.OperationalError as e:
                logger.info(
                    f"Waiting for Postgres to start (Attempt {i+1}/{max_retries})..."
                )
                time.sleep(2)

        if not conn:
            logger.error(
                "Failed to connect to Postgres after multiple retries. Running without DB-backed persistence."
            )
            AuditDatabase._log_memory_repo_mode()
            return

        try:
            conn.autocommit = True
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_history (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    target TEXT NOT NULL,
                    score REAL NOT NULL,
                    rating TEXT NOT NULL,
                    total_loc INTEGER NOT NULL,
                    violations_count INTEGER NOT NULL,
                    pillar_scores TEXT NOT NULL,
                    full_json TEXT,
                    scan_mode TEXT DEFAULT 'full_ai',
                    baseline_audit_id INTEGER,
                    regression_status TEXT DEFAULT 'unavailable',
                    regression_summary TEXT DEFAULT '{}'
                )
            """)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_history_target_timestamp ON audit_history(target, timestamp DESC, id DESC)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_history_timestamp ON audit_history(timestamp DESC, id DESC)"
            )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS project_rules (
                    id SERIAL PRIMARY KEY,
                    target_id TEXT NOT NULL UNIQUE,
                    natural_text TEXT NOT NULL,
                    compiled_json TEXT,
                    disabled_core_rules TEXT DEFAULT '[]',
                    enabled_core_rules TEXT DEFAULT '[]',
                    custom_weights TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Check for existing columns to support older schema updates
            cursor.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_history'"
            )
            columns_history = [row[0] for row in cursor.fetchall()]
            if "full_json" not in columns_history:
                cursor.execute("ALTER TABLE audit_history ADD COLUMN full_json TEXT")
            if "scan_mode" not in columns_history:
                cursor.execute(
                    "ALTER TABLE audit_history ADD COLUMN scan_mode TEXT DEFAULT 'full_ai'"
                )
            if "baseline_audit_id" not in columns_history:
                cursor.execute(
                    "ALTER TABLE audit_history ADD COLUMN baseline_audit_id INTEGER"
                )
            if "regression_status" not in columns_history:
                cursor.execute(
                    "ALTER TABLE audit_history ADD COLUMN regression_status TEXT DEFAULT 'unavailable'"
                )
            if "regression_summary" not in columns_history:
                cursor.execute(
                    "ALTER TABLE audit_history ADD COLUMN regression_summary TEXT DEFAULT '{}'"
                )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS configured_repositories (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    url TEXT NOT NULL,
                    username TEXT DEFAULT '',
                    token TEXT DEFAULT '',
                    branch TEXT DEFAULT 'main',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'project_rules'"
            )
            columns_rules = [row[0] for row in cursor.fetchall()]
            if "disabled_core_rules" not in columns_rules:
                cursor.execute(
                    "ALTER TABLE project_rules ADD COLUMN disabled_core_rules TEXT DEFAULT '[]'"
                )
            if "enabled_core_rules" not in columns_rules:
                cursor.execute(
                    "ALTER TABLE project_rules ADD COLUMN enabled_core_rules TEXT DEFAULT '[]'"
                )
            if "custom_weights" not in columns_rules:
                cursor.execute(
                    "ALTER TABLE project_rules ADD COLUMN custom_weights TEXT DEFAULT '{}'"
                )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_config (
                    key        VARCHAR(64) PRIMARY KEY,
                    value      TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS runtime_jobs (
                    job_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    message TEXT DEFAULT '',
                    result TEXT,
                    started_at DOUBLE PRECISION NOT NULL,
                    ended_at DOUBLE PRECISION,
                    target TEXT DEFAULT '',
                    job_type TEXT DEFAULT 'single',
                    progress TEXT,
                    cancel_requested BOOLEAN DEFAULT FALSE,
                    ai_mode TEXT DEFAULT 'realtime',
                    workspace_path TEXT DEFAULT '',
                    orchestration_state TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS runtime_job_logs (
                    id SERIAL PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    line_number INTEGER NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(job_id, line_number)
                )
            """)

            cursor.execute(
                """
                DELETE FROM runtime_job_logs
                WHERE job_id IN (
                    SELECT job_id
                    FROM runtime_jobs
                    WHERE job_type IN ('change_review', 'pr_review')
                )
                """
            )
            cursor.execute(
                """
                DELETE FROM runtime_jobs
                WHERE job_type IN ('change_review', 'pr_review')
                """
            )
            cursor.execute("DROP TABLE IF EXISTS change_reviews CASCADE")
            cursor.execute("DROP TABLE IF EXISTS pr_reviews CASCADE")

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_request_logs (
                    request_id TEXT PRIMARY KEY,
                    external_request_id TEXT,
                    batch_envelope_id TEXT,
                    source TEXT NOT NULL,
                    feature TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    model TEXT NOT NULL,
                    job_id TEXT,
                    target TEXT,
                    project TEXT,
                    status TEXT NOT NULL,
                    error_reason TEXT,
                    input_chars INTEGER DEFAULT 0,
                    output_chars INTEGER DEFAULT 0,
                    input_tokens INTEGER DEFAULT 0,
                    output_tokens INTEGER DEFAULT 0,
                    cached_tokens INTEGER DEFAULT 0,
                    estimated_cost DOUBLE PRECISION DEFAULT 0,
                    usage_source TEXT,
                    input_preview TEXT,
                    output_preview TEXT,
                    input_hash TEXT,
                    output_hash TEXT,
                    metadata TEXT DEFAULT '{}',
                    raw_input_payload TEXT,
                    raw_output_payload TEXT,
                    started_at TIMESTAMP,
                    ended_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_created_at ON ai_request_logs(created_at DESC)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_source ON ai_request_logs(source)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_target ON ai_request_logs(target)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_model ON ai_request_logs(model)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_provider ON ai_request_logs(provider)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_status ON ai_request_logs(status)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_job_id ON ai_request_logs(job_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_request_logs_batch ON ai_request_logs(batch_envelope_id, external_request_id)"
            )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_pricing_catalog (
                    id SERIAL PRIMARY KEY,
                    provider TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    model TEXT NOT NULL,
                    input_cost_per_million DOUBLE PRECISION DEFAULT 0,
                    output_cost_per_million DOUBLE PRECISION DEFAULT 0,
                    cached_input_cost_per_million DOUBLE PRECISION DEFAULT 0,
                    currency TEXT DEFAULT 'USD',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(provider, mode, model)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_budget_policy (
                    policy_key TEXT PRIMARY KEY,
                    daily_budget_usd DOUBLE PRECISION,
                    monthly_budget_usd DOUBLE PRECISION,
                    hard_stop_enabled BOOLEAN DEFAULT FALSE,
                    retention_days INTEGER DEFAULT 30,
                    raw_payload_retention_enabled BOOLEAN DEFAULT FALSE,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute(
                """
                INSERT INTO ai_budget_policy (
                    policy_key, daily_budget_usd, monthly_budget_usd,
                    hard_stop_enabled, retention_days, raw_payload_retention_enabled, updated_at
                )
                VALUES ('global', NULL, NULL, FALSE, 30, FALSE, CURRENT_TIMESTAMP)
                ON CONFLICT (policy_key) DO NOTHING
                """
            )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_cache_entries (
                    cache_key_hash TEXT PRIMARY KEY,
                    entry_type TEXT NOT NULL,
                    target_id TEXT,
                    mode TEXT NOT NULL,
                    model TEXT NOT NULL,
                    prompt_version TEXT NOT NULL,
                    rules_version TEXT NOT NULL,
                    custom_rules_hash TEXT NOT NULL,
                    input_meta JSONB NOT NULL,
                    result_json JSONB NOT NULL,
                    source_input_tokens INTEGER DEFAULT 0,
                    source_output_tokens INTEGER DEFAULT 0,
                    source_estimated_cost DOUBLE PRECISION DEFAULT 0,
                    hit_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_hit_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_target_id ON ai_cache_entries(target_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_entry_type ON ai_cache_entries(entry_type)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_last_hit_at ON ai_cache_entries(last_hit_at DESC)"
            )

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_cache_runs (
                    job_id TEXT PRIMARY KEY,
                    target_id TEXT,
                    hits INTEGER DEFAULT 0,
                    misses INTEGER DEFAULT 0,
                    writes INTEGER DEFAULT 0,
                    saved_input_tokens INTEGER DEFAULT 0,
                    saved_output_tokens INTEGER DEFAULT 0,
                    saved_cost_usd DOUBLE PRECISION DEFAULT 0,
                    by_stage JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_cache_runs_created_at ON ai_cache_runs(created_at DESC)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_ai_cache_runs_target_id ON ai_cache_runs(target_id)"
            )
            schema_ready = True
        except Exception as e:
            logger.error(f"Database Initialization Error: {e}")
        finally:
            if cursor:
                cursor.close()
            AuditDatabase.release_connection(conn)

        # Auto-seed repositories từ config.py nếu bảng trống (Option A)
        if schema_ready:
            AuditDatabase.seed_default_repositories()

    # ── System Config (Key-Value Store) ───────────────────────────────────────

    @staticmethod
    def get_config(key, default=None):
        """Đọc 1 giá trị config từ bảng system_config."""
        if not AuditDatabase._pool:
            return default
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM system_config WHERE key = %s", (key,))
            row = cursor.fetchone()
            cursor.close()
            return row[0] if row else default
        except Exception:
            return default
        finally:
            AuditDatabase.release_connection(conn)

    @staticmethod
    def set_config(key, value):
        """Upsert 1 giá trị config vào bảng system_config."""
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO system_config (key, value, updated_at)
                VALUES (%s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
            """, (key, str(value)))
            conn.commit()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

    # ── Runtime Jobs & Logs ──────────────────────────────────────────────────

    @staticmethod
    def upsert_runtime_job(job_data):
        """Lưu hoặc cập nhật trạng thái runtime job để có thể khôi phục sau restart."""
        if not AuditDatabase._pool:
            return
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO runtime_jobs (
                    job_id, status, message, result, started_at, ended_at,
                    target, job_type, progress, cancel_requested, ai_mode,
                    workspace_path, orchestration_state, updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, CURRENT_TIMESTAMP
                )
                ON CONFLICT (job_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    message = EXCLUDED.message,
                    result = EXCLUDED.result,
                    started_at = EXCLUDED.started_at,
                    ended_at = EXCLUDED.ended_at,
                    target = EXCLUDED.target,
                    job_type = EXCLUDED.job_type,
                    progress = EXCLUDED.progress,
                    cancel_requested = EXCLUDED.cancel_requested,
                    ai_mode = EXCLUDED.ai_mode,
                    workspace_path = EXCLUDED.workspace_path,
                    orchestration_state = EXCLUDED.orchestration_state,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    job_data["job_id"],
                    job_data["status"],
                    job_data.get("message", ""),
                    json.dumps(job_data["result"]) if job_data.get("result") is not None else None,
                    float(job_data["started_at"]),
                    float(job_data["ended_at"]) if job_data.get("ended_at") is not None else None,
                    job_data.get("target", ""),
                    job_data.get("job_type", "single"),
                    json.dumps(job_data["progress"]) if job_data.get("progress") is not None else None,
                    bool(job_data.get("cancel_requested", False)),
                    job_data.get("ai_mode", "realtime"),
                    job_data.get("workspace_path", ""),
                    json.dumps(job_data.get("orchestration_state", {})),
                ),
            )
            conn.commit()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

    @staticmethod
    def get_runtime_job(job_id):
        if not AuditDatabase._pool:
            return None
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT job_id, status, message, result, started_at, ended_at,
                       target, job_type, progress, cancel_requested, ai_mode,
                       workspace_path, orchestration_state
                FROM runtime_jobs
                WHERE job_id = %s
                """,
                (job_id,),
            )
            row = cursor.fetchone()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

        if not row:
            return None

        data = dict(row)
        for field in ("result", "progress", "orchestration_state"):
            raw = data.get(field)
            if raw:
                try:
                    data[field] = json.loads(raw)
                except Exception:
                    data[field] = None if field != "orchestration_state" else {}
            elif field == "orchestration_state":
                data[field] = {}
            else:
                data[field] = None
        return data

    @staticmethod
    def get_active_runtime_jobs():
        if not AuditDatabase._pool:
            return []
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT job_id, status, message, result, started_at, ended_at,
                       target, job_type, progress, cancel_requested, ai_mode,
                       workspace_path, orchestration_state
                FROM runtime_jobs
                WHERE status IN ('PENDING', 'RUNNING')
                ORDER BY started_at ASC
                """
            )
            rows = cursor.fetchall()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

        results = []
        for row in rows:
            data = dict(row)
            for field in ("result", "progress", "orchestration_state"):
                raw = data.get(field)
                if raw:
                    try:
                        data[field] = json.loads(raw)
                    except Exception:
                        data[field] = None if field != "orchestration_state" else {}
                elif field == "orchestration_state":
                    data[field] = {}
                else:
                    data[field] = None
            results.append(data)
        return results

    @staticmethod
    def append_runtime_job_log(job_id, line_number, message):
        if not AuditDatabase._pool:
            return
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO runtime_job_logs (job_id, line_number, message)
                VALUES (%s, %s, %s)
                ON CONFLICT (job_id, line_number) DO NOTHING
                """,
                (job_id, int(line_number), message),
            )
            conn.commit()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

    @staticmethod
    def get_runtime_job_logs(job_id):
        if not AuditDatabase._pool:
            return []
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT line_number, message
                FROM runtime_job_logs
                WHERE job_id = %s
                ORDER BY line_number ASC
                """,
                (job_id,),
            )
            rows = cursor.fetchall()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

        return [row["message"] for row in rows]

    @staticmethod
    def save_audit(
        target,
        score,
        rating,
        loc,
        violations_count,
        pillar_scores,
        full_json=None,
        scan_mode="full_ai",
    ):
        """Saves a new audit session to the database."""
        if not AuditDatabase._pool:
            AuditDatabase._log_memory_repo_mode()
            logger.warning(
                "Skipping audit persistence for target '%s' because database-backed storage is unavailable.",
                target,
            )
            return None
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        try:
            regression_settings = AuditDatabase.get_regression_settings()
            previous_audit = AuditDatabase._load_previous_audit_row(conn, target)
            regression_snapshot = AuditDatabase.compute_regression_snapshot(
                {
                    "score": score,
                    "violations_count": violations_count,
                    "pillar_scores": pillar_scores,
                    "full_json": full_json,
                },
                baseline_audit=previous_audit,
                settings=regression_settings,
            )

            baseline_audit_id = regression_snapshot["baseline_audit_id"]
            regression_status = regression_snapshot["regression_status"]
            regression_summary = regression_snapshot["regression_summary"]

            if isinstance(full_json, dict):
                AuditDatabase._attach_regression_metadata(
                    full_json, regression_status, regression_summary
                )
                metadata = dict(full_json.get("metadata") or {})
                metadata["audit_id"] = None
                full_json["metadata"] = metadata

            serialized_full_json = json.dumps(full_json) if full_json else None
            cursor.execute(
                """
                INSERT INTO audit_history (
                    target, score, rating, total_loc, violations_count,
                    pillar_scores, full_json, scan_mode, baseline_audit_id,
                    regression_status, regression_summary
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """,
                (
                    target,
                    score,
                    rating,
                    loc,
                    violations_count,
                    json.dumps(pillar_scores),
                    serialized_full_json,
                    scan_mode,
                    baseline_audit_id,
                    regression_status,
                    json.dumps(regression_summary),
                ),
            )
            audit_id = cursor.fetchone()[0]
            if isinstance(full_json, dict):
                metadata = dict(full_json.get("metadata") or {})
                metadata["audit_id"] = audit_id
                full_json["metadata"] = metadata
                cursor.execute(
                    "UPDATE audit_history SET full_json = %s WHERE id = %s",
                    (json.dumps(full_json), audit_id),
                )
            conn.commit()
            return audit_id
        finally:
            cursor.close()
            AuditDatabase.release_connection(conn)

    @staticmethod
    def _empty_ai_summary():
        return {
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

    @staticmethod
    def _extract_ai_summary(full_json):
        if not isinstance(full_json, dict):
            return AuditDatabase._empty_ai_summary()
        summary = full_json.get("ai_summary")
        if not isinstance(summary, dict):
            summary = full_json.get("metadata", {}).get("ai_summary")
        if not isinstance(summary, dict):
            return AuditDatabase._empty_ai_summary()
        normalized = {**AuditDatabase._empty_ai_summary(), **summary}
        if not isinstance(normalized.get("by_source"), dict):
            normalized["by_source"] = {}
        return normalized

    @staticmethod
    def get_history(target_path=None):
        """Retrieves lightweight history, optionally filtered by target path."""
        if not AuditDatabase._pool:
            return []
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        regression_settings = AuditDatabase.get_regression_settings()

        if target_path:
            cursor.execute(
                """
                SELECT
                    id, timestamp, target, score, rating, total_loc,
                    violations_count, pillar_scores, full_json, scan_mode,
                    baseline_audit_id, regression_status, regression_summary
                FROM audit_history
                WHERE target = %s
                ORDER BY timestamp DESC, id DESC
                """,
                (target_path,),
            )
        else:
            cursor.execute(
                """
                SELECT
                    id, timestamp, target, score, rating, total_loc,
                    violations_count, pillar_scores, full_json, scan_mode,
                    baseline_audit_id, regression_status, regression_summary
                FROM audit_history
                ORDER BY timestamp DESC, id DESC
                LIMIT 50
                """
            )

        rows = cursor.fetchall()
        cursor.close()
        AuditDatabase.release_connection(conn)

        if target_path:
            hydrated_rows = []
            previous_row = None
            for row in reversed(rows):
                parsed_row = AuditDatabase._parse_history_row(
                    row,
                    include_full_json=True,
                    fallback_baseline=previous_row,
                    settings=regression_settings,
                )
                previous_row = parsed_row
                public_row = dict(parsed_row)
                public_row.pop("full_json", None)
                hydrated_rows.append(public_row)
            return list(reversed(hydrated_rows))

        return [
            AuditDatabase._parse_history_row(
                row,
                include_full_json=False,
                settings=regression_settings,
            )
            for row in rows
        ]

    @staticmethod
    def get_latest_audits_for_targets(targets, include_full_json=False):
        """Lấy bản audit mới nhất cho mỗi target trong một lần query."""
        cleaned_targets = [str(target).strip() for target in (targets or []) if str(target).strip()]
        if not cleaned_targets:
            return {}
        if not AuditDatabase._pool:
            return {}

        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        columns = (
            "id, timestamp, target, score, rating, total_loc, violations_count, "
            "pillar_scores, scan_mode, baseline_audit_id, regression_status, "
            "regression_summary, full_json"
        )
        regression_settings = AuditDatabase.get_regression_settings()

        cursor.execute(
            f"""
            SELECT DISTINCT ON (target) {columns}
            FROM audit_history
            WHERE target = ANY(%s)
            ORDER BY target, timestamp DESC, id DESC
            """,
            (cleaned_targets,),
        )
        rows = cursor.fetchall()
        cursor.close()

        results = {}
        try:
            for row in rows:
                fallback_baseline = AuditDatabase._load_previous_audit_row(
                    conn,
                    row["target"],
                    before_timestamp=row["timestamp"],
                    before_id=row["id"],
                )
                parsed_row = AuditDatabase._parse_history_row(
                    row,
                    include_full_json=include_full_json,
                    fallback_baseline=fallback_baseline,
                    settings=regression_settings,
                )
                results[parsed_row["target"]] = parsed_row
        finally:
            AuditDatabase.release_connection(conn)
        return results

    @staticmethod
    def get_audit_by_id(audit_id):
        """Retrieves details of a single audit including the full JSON payload by ID."""
        if not AuditDatabase._pool:
            return None
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            """
            SELECT
                id, timestamp, target, score, rating, total_loc,
                violations_count, pillar_scores, full_json, scan_mode,
                baseline_audit_id, regression_status, regression_summary
            FROM audit_history
            WHERE id = %s
            """,
            (audit_id,),
        )
        row = cursor.fetchone()
        cursor.close()

        if not row:
            AuditDatabase.release_connection(conn)
            return None

        regression_settings = AuditDatabase.get_regression_settings()
        fallback_baseline = AuditDatabase._load_previous_audit_row(
            conn,
            row["target"],
            before_timestamp=row["timestamp"],
            before_id=row["id"],
        )
        parsed_row = AuditDatabase._parse_history_row(
            row,
            include_full_json=True,
            fallback_baseline=fallback_baseline,
            settings=regression_settings,
        )
        AuditDatabase.release_connection(conn)
        return parsed_row

    @staticmethod
    def _empty_repository_trends(target, days):
        return {
            "target": target,
            "range_days": days,
            "summary": {
                "total_scans": 0,
                "latest_score": None,
                "latest_rating": None,
                "latest_timestamp": None,
                "warnings_count": 0,
            },
            "audit_points": [],
            "score_series": [],
            "violations_series": [],
            "pillar_series": [],
            "regression_events": [],
        }

    @staticmethod
    def _empty_portfolio_trends(days):
        return {
            "range_days": days,
            "summary": {
                "scanned_repos": 0,
                "avg_latest_score": None,
                "regressing_repos": 0,
                "scans_in_range": 0,
            },
            "score_series": [],
            "scan_volume_series": [],
            "regression_series": [],
            "latest_portfolio_pillars": {},
            "top_regressing_repos": [],
        }

    @staticmethod
    def get_repository_trends(target, days=30):
        target = str(target or "").strip()
        range_days = AuditDatabase._coerce_int(days, default=30, minimum=1, maximum=365)
        if not target:
            return AuditDatabase._empty_repository_trends(target, range_days)
        if not AuditDatabase._pool:
            return AuditDatabase._empty_repository_trends(target, range_days)

        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT
                    id, timestamp, target, score, rating, total_loc,
                    violations_count, pillar_scores, full_json, scan_mode,
                    baseline_audit_id, regression_status, regression_summary
                FROM audit_history
                WHERE target = %s
                ORDER BY timestamp ASC, id ASC
                """,
                (target,),
            )
            rows = cursor.fetchall()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

        if not rows:
            return AuditDatabase._empty_repository_trends(target, range_days)

        regression_settings = AuditDatabase.get_regression_settings()
        previous_row = None
        hydrated_rows = []
        for row in rows:
            parsed_row = AuditDatabase._parse_history_row(
                row,
                include_full_json=True,
                fallback_baseline=previous_row,
                settings=regression_settings,
            )
            parsed_row["_timestamp_dt"] = row["timestamp"]
            hydrated_rows.append(parsed_row)
            previous_row = parsed_row

        since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=range_days)
        filtered_rows = [
            row for row in hydrated_rows if row["_timestamp_dt"] >= since
        ]
        if not filtered_rows:
            return AuditDatabase._empty_repository_trends(target, range_days)

        latest_row = filtered_rows[-1]
        score_series = [
            {"timestamp": row["timestamp"], "score": row["score"]}
            for row in filtered_rows
        ]
        violations_series = [
            {
                "timestamp": row["timestamp"],
                "violations_count": row["violations_count"],
            }
            for row in filtered_rows
        ]
        pillar_series = [
            {
                "timestamp": row["timestamp"],
                **{
                    pillar: row["pillar_scores"].get(pillar)
                    for pillar in AuditDatabase.PILLAR_KEYS
                },
            }
            for row in filtered_rows
        ]

        audit_points = []
        regression_events = []
        warnings_count = 0
        for row in filtered_rows:
            public_row = dict(row)
            public_row.pop("full_json", None)
            public_row.pop("_timestamp_dt", None)
            audit_points.append(public_row)
            if row["regression_status"] == "warning":
                warnings_count += 1
                regression_events.append(
                    {
                        "id": row["id"],
                        "timestamp": row["timestamp"],
                        "regression_status": row["regression_status"],
                        "regression_summary": row["regression_summary"],
                    }
                )

        return {
            "target": target,
            "range_days": range_days,
            "summary": {
                "total_scans": len(filtered_rows),
                "latest_score": latest_row["score"],
                "latest_rating": latest_row["rating"],
                "latest_timestamp": latest_row["timestamp"],
                "warnings_count": warnings_count,
            },
            "audit_points": audit_points,
            "score_series": score_series,
            "violations_series": violations_series,
            "pillar_series": pillar_series,
            "regression_events": regression_events,
        }

    @staticmethod
    def get_portfolio_trends(days=30):
        range_days = AuditDatabase._coerce_int(days, default=30, minimum=1, maximum=365)
        if not AuditDatabase._pool:
            return AuditDatabase._empty_portfolio_trends(range_days)

        since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=range_days)
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT
                    id, timestamp, target, score, rating, total_loc,
                    violations_count, pillar_scores, full_json, scan_mode,
                    baseline_audit_id, regression_status, regression_summary
                FROM audit_history
                WHERE timestamp >= %s
                ORDER BY timestamp ASC, id ASC
                """,
                (since,),
            )
            rows = cursor.fetchall()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

        if not rows:
            return AuditDatabase._empty_portfolio_trends(range_days)

        regression_settings = AuditDatabase.get_regression_settings()
        previous_by_target = {}
        hydrated_rows = []
        for row in rows:
            target = row["target"]
            parsed_row = AuditDatabase._parse_history_row(
                row,
                include_full_json=True,
                fallback_baseline=previous_by_target.get(target),
                settings=regression_settings,
            )
            parsed_row["_timestamp_dt"] = row["timestamp"]
            hydrated_rows.append(parsed_row)
            previous_by_target[target] = parsed_row

        latest_by_target = {}
        per_day_latest = {}
        scan_counts = {}
        warning_counts = {}

        for row in hydrated_rows:
            latest_by_target[row["target"]] = row
            day_key = row["_timestamp_dt"].date().isoformat()
            per_day_latest.setdefault(day_key, {})
            per_day_latest[day_key][row["target"]] = row
            scan_counts[day_key] = scan_counts.get(day_key, 0) + 1
            if row["regression_status"] == "warning":
                warning_counts[day_key] = warning_counts.get(day_key, 0) + 1

        score_series = []
        scan_volume_series = []
        regression_series = []
        for day_key in sorted(per_day_latest):
            day_rows = list(per_day_latest[day_key].values())
            avg_score = round(
                sum(float(row["score"]) for row in day_rows) / len(day_rows),
                2,
            )
            score_series.append({"date": day_key, "avg_score": avg_score})
            scan_volume_series.append(
                {"date": day_key, "scans": scan_counts.get(day_key, 0)}
            )
            regression_series.append(
                {"date": day_key, "warnings": warning_counts.get(day_key, 0)}
            )

        latest_scores = [row["score"] for row in latest_by_target.values()]
        avg_latest_score = round(sum(float(score) for score in latest_scores) / len(latest_scores), 2)

        pillar_buckets = {pillar: [] for pillar in AuditDatabase.PILLAR_KEYS}
        for row in latest_by_target.values():
            for pillar in AuditDatabase.PILLAR_KEYS:
                value = row["pillar_scores"].get(pillar)
                if value is not None:
                    pillar_buckets[pillar].append(float(value))
        latest_portfolio_pillars = {
            pillar: round(sum(values) / len(values), 2)
            for pillar, values in pillar_buckets.items()
            if values
        }

        top_regressing_repos = []
        for row in latest_by_target.values():
            if row["regression_status"] != "warning":
                continue
            public_row = dict(row)
            public_row.pop("full_json", None)
            public_row.pop("_timestamp_dt", None)
            top_regressing_repos.append(public_row)

        top_regressing_repos.sort(
            key=lambda row: (
                -len((row["regression_summary"] or {}).get("triggered_signals") or []),
                -AuditDatabase._coerce_int(
                    (row["regression_summary"] or {}).get("new_high_severity_count"),
                    default=0,
                ),
                AuditDatabase._coerce_float(
                    (row["regression_summary"] or {}).get("score_delta"),
                    default=0.0,
                ),
                -AuditDatabase._coerce_int(
                    (row["regression_summary"] or {}).get("violations_delta"),
                    default=0,
                ),
            )
        )

        return {
            "range_days": range_days,
            "summary": {
                "scanned_repos": len(latest_by_target),
                "avg_latest_score": avg_latest_score,
                "regressing_repos": sum(
                    1
                    for row in latest_by_target.values()
                    if row["regression_status"] == "warning"
                ),
                "scans_in_range": len(hydrated_rows),
            },
            "score_series": score_series,
            "scan_volume_series": scan_volume_series,
            "regression_series": regression_series,
            "latest_portfolio_pillars": latest_portfolio_pillars,
            "top_regressing_repos": top_regressing_repos[:5],
        }

    @staticmethod
    def save_project_rules(
        target_id, natural_text, compiled_json, disabled_core_rules="[]"
    ):
        """Saves or updates project rules."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, disabled_core_rules, custom_weights FROM project_rules WHERE target_id = %s",
            (target_id,),
        )
        row = cursor.fetchone()

        compiled_str = json.dumps(compiled_json) if compiled_json is not None else None

        if row:
            final_disabled = (
                disabled_core_rules if disabled_core_rules != "[]" else row[1]
            )
            cursor.execute(
                """
                UPDATE project_rules 
                SET natural_text = %s, compiled_json = %s, disabled_core_rules = %s, updated_at = CURRENT_TIMESTAMP
                WHERE target_id = %s
            """,
                (natural_text, compiled_str, final_disabled, target_id),
            )
        else:
            cursor.execute(
                """
                INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, custom_weights)
                VALUES (%s, %s, %s, %s, '{}')
            """,
                (target_id, natural_text, compiled_str, disabled_core_rules),
            )

        conn.commit()
        cursor.close()
        AuditDatabase.release_connection(conn)

    @staticmethod
    def toggle_core_rule(target_id, rule_id, is_disabled, is_override_reset=False):
        """Toggles a specific core rule for a target.
        If is_override_reset is True, it removes the override, meaning it falls back to GLOBAL."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        try:
            # SELECT ... FOR UPDATE: Lock row để đảm bảo atomic read-modify-write
            cursor.execute(
                "SELECT id, disabled_core_rules, enabled_core_rules, custom_weights FROM project_rules WHERE target_id = %s FOR UPDATE",
                (target_id,),
            )
            row = cursor.fetchone()

            if not row:
                cursor.execute(
                    "INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, enabled_core_rules, custom_weights) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (target_id) DO NOTHING",
                    (target_id, "", None, "[]", "[]", "{}"),
                )
                cursor.execute(
                    "SELECT id, disabled_core_rules, enabled_core_rules, custom_weights FROM project_rules WHERE target_id = %s FOR UPDATE",
                    (target_id,),
                )
                row = cursor.fetchone()

            disabled_rules = []
            enabled_rules = []
            custom_weights = {}
            if row:
                if row[1]:
                    try:
                        disabled_rules = json.loads(row[1])
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning(f"Error parsing disabled_core_rules: {e}")
                if len(row) > 2 and row[2]:
                    try:
                        enabled_rules = json.loads(row[2])
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning(f"Error parsing enabled_core_rules: {e}")
                if len(row) > 3 and row[3]:
                    try:
                        custom_weights = json.loads(row[3])
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning(f"Error parsing custom_weights: {e}")

            if is_override_reset:
                # Remove from both so it falls back to global
                if rule_id in disabled_rules:
                    disabled_rules.remove(rule_id)
                if rule_id in enabled_rules:
                    enabled_rules.remove(rule_id)
                if rule_id in custom_weights:
                    del custom_weights[rule_id]
            elif is_disabled:
                if rule_id not in disabled_rules:
                    disabled_rules.append(rule_id)
                if rule_id in enabled_rules:
                    enabled_rules.remove(rule_id)
            else:
                if rule_id in disabled_rules:
                    disabled_rules.remove(rule_id)
                # Only add to enabled_core_rules for project scope
                # (meaning: "override a global-level disable").
                # At GLOBAL scope, enabled_core_rules has no semantic meaning.
                if target_id != "GLOBAL":
                    if rule_id not in enabled_rules:
                        enabled_rules.append(rule_id)

            disabled_str = json.dumps(disabled_rules)
            enabled_str = json.dumps(enabled_rules)
            weights_str = json.dumps(custom_weights)

            if row:
                cursor.execute(
                    "UPDATE project_rules SET disabled_core_rules = %s, enabled_core_rules = %s, custom_weights = %s, updated_at = CURRENT_TIMESTAMP WHERE target_id = %s",
                    (disabled_str, enabled_str, weights_str, target_id),
                )
            else:
                cursor.execute(
                    "INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, enabled_core_rules, custom_weights) VALUES (%s, %s, %s, %s, %s, %s)",
                    (target_id, "", None, disabled_str, enabled_str, weights_str),
                )

            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            if cursor:
                cursor.close()
            if conn:
                AuditDatabase.release_connection(conn)

    @staticmethod
    def save_custom_weights(target_id, custom_weights):
        """Lưu lại điểm phạt tùy chỉnh của các rules cho dự án."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()

        weights_str = json.dumps(custom_weights) if custom_weights is not None else "{}"

        cursor.execute(
            "SELECT id FROM project_rules WHERE target_id = %s", (target_id,)
        )
        if cursor.fetchone():
            cursor.execute(
                """
                UPDATE project_rules 
                SET custom_weights = %s, updated_at = CURRENT_TIMESTAMP
                WHERE target_id = %s
            """,
                (weights_str, target_id),
            )
        else:
            cursor.execute(
                """
                INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, enabled_core_rules, custom_weights)
                VALUES (%s, '', NULL, '[]', '[]', %s)
            """,
                (target_id, weights_str),
            )

        conn.commit()
        cursor.close()
        AuditDatabase.release_connection(conn)

    @staticmethod
    def get_project_rules(target_id):
        """Retrieves saved rules for a target."""
        if not AuditDatabase._pool:
            return None
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT natural_text, compiled_json, disabled_core_rules, enabled_core_rules, custom_weights FROM project_rules WHERE target_id = %s",
            (target_id,),
        )
        row = cursor.fetchone()
        cursor.close()
        AuditDatabase.release_connection(conn)

        if row:
            compiled = None
            if row["compiled_json"]:
                try:
                    compiled = json.loads(row["compiled_json"])
                except Exception as e:
                    logger.warning(f"Error parsing compiled_json: {e}")

            disabled = []
            if row.get("disabled_core_rules"):
                try:
                    disabled = json.loads(row["disabled_core_rules"])
                except Exception as e:
                    logger.warning(f"Error parsing disabled_core_rules: {e}")

            enabled = []
            if row.get("enabled_core_rules"):
                try:
                    enabled = json.loads(row["enabled_core_rules"])
                except Exception as e:
                    logger.warning(f"Error parsing enabled_core_rules: {e}")

            weights = {}
            if row.get("custom_weights"):
                try:
                    weights = json.loads(row["custom_weights"])
                except Exception as e:
                    logger.warning(f"Error parsing custom_weights: {e}")

            return {
                "natural_text": row["natural_text"],
                "compiled_json": compiled,
                "disabled_core_rules": disabled,
                "enabled_core_rules": enabled,
                "custom_weights": weights,
            }
        return None

    @staticmethod
    def delete_project_rules(target_id):
        """Deletes project rules for a specific target."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM project_rules WHERE target_id = %s", (target_id,))
        conn.commit()
        cursor.close()
        AuditDatabase.release_connection(conn)

    @staticmethod
    def partial_reset_project_rules(target_id, level):
        """Reset specific parts of project rules based on level.
        
        Levels:
        - toggles: Reset disabled_core_rules + enabled_core_rules only
        - weights: Reset custom_weights only  
        - custom: Reset compiled_json + natural_text only
        - all: Delete entire row (same as delete_project_rules)
        """
        if level == "all":
            AuditDatabase.delete_project_rules(target_id)
            return
        
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id FROM project_rules WHERE target_id = %s", (target_id,)
        )
        row = cursor.fetchone()
        if not row:
            cursor.close()
            AuditDatabase.release_connection(conn)
            return  # Nothing to reset
        
        if level == "toggles":
            cursor.execute(
                """UPDATE project_rules 
                SET disabled_core_rules = '[]', enabled_core_rules = '[]', updated_at = CURRENT_TIMESTAMP
                WHERE target_id = %s""",
                (target_id,),
            )
        elif level == "weights":
            cursor.execute(
                """UPDATE project_rules 
                SET custom_weights = '{}', updated_at = CURRENT_TIMESTAMP
                WHERE target_id = %s""",
                (target_id,),
            )
        elif level == "custom":
            cursor.execute(
                """UPDATE project_rules 
                SET compiled_json = NULL, natural_text = '', updated_at = CURRENT_TIMESTAMP
                WHERE target_id = %s""",
                (target_id,),
            )
        
        conn.commit()
        cursor.close()
        AuditDatabase.release_connection(conn)


    # ── Repository Management ─────────────────────────────────────────────────

    @staticmethod
    def seed_default_repositories():
        """Import repositories từ CONFIGURED_REPOSITORIES (config.py) nếu bảng trống.
        Chỉ chạy 1 lần khi lần đầu khởi động với bảng mới."""
        conn = None
        cursor = None
        try:
            conn = AuditDatabase.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM configured_repositories")
            count = cursor.fetchone()[0]
            if count > 0:
                logger.info(f"configured_repositories already has {count} entries, skipping seed.")
                return

            from src.config import CONFIGURED_REPOSITORIES
            for repo in CONFIGURED_REPOSITORIES:
                cursor.execute(
                    """
                    INSERT INTO configured_repositories (id, name, url, username, token, branch)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        repo["id"],
                        repo["name"],
                        repo["url"],
                        repo.get("username", ""),
                        repo.get("token", ""),
                        repo.get("branch", "main"),
                    ),
                )
            conn.commit()
            logger.info(f"Seeded {len(CONFIGURED_REPOSITORIES)} default repositories from config.py.")
        except Exception as e:
            logger.warning(f"Error seeding default repositories: {e}")
            if conn:
                conn.rollback()
        finally:
            if cursor:
                cursor.close()
            AuditDatabase.release_connection(conn)

    @staticmethod
    def get_all_repositories(include_credentials=False):
        """Lấy danh sách tất cả repositories đang active."""
        if not AuditDatabase._pool:
            return AuditDatabase._list_memory_repositories(
                include_credentials=include_credentials
            )
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT id, name, url, username, token, branch, is_active, created_at, updated_at "
            "FROM configured_repositories WHERE is_active = TRUE ORDER BY name"
        )
        rows = cursor.fetchall()
        cursor.close()
        AuditDatabase.release_connection(conn)

        results = []
        for row in rows:
            d = dict(row)
            for ts_field in ("created_at", "updated_at"):
                if ts_field in d and isinstance(d[ts_field], datetime):
                    d[ts_field] = d[ts_field].isoformat()
            if not include_credentials:
                d.pop("token", None)
                d.pop("username", None)
            results.append(d)
        return results

    @staticmethod
    def get_repository(repo_id):
        """Lấy thông tin 1 repository (bao gồm credentials) để dùng cho clone."""
        if not AuditDatabase._pool:
            row = AuditDatabase._ensure_memory_repositories().get(repo_id)
            if not row or not row.get("is_active", True):
                return None
            return dict(row)
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT id, name, url, username, token, branch FROM configured_repositories WHERE id = %s AND is_active = TRUE",
            (repo_id,),
        )
        row = cursor.fetchone()
        cursor.close()
        AuditDatabase.release_connection(conn)
        return dict(row) if row else None

    @staticmethod
    def save_repository(repo_id, name, url, username="", token="", branch="main"):
        """Thêm mới hoặc cập nhật repository."""
        if not AuditDatabase._pool:
            repositories = AuditDatabase._ensure_memory_repositories()
            existing = repositories.get(repo_id) or {}
            now = AuditDatabase._memory_timestamp()
            repositories[repo_id] = {
                "id": repo_id,
                "name": name,
                "url": url,
                "username": username,
                "token": token,
                "branch": branch,
                "is_active": True,
                "created_at": existing.get("created_at") or now,
                "updated_at": now,
            }
            return
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO configured_repositories (id, name, url, username, token, branch, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                url = EXCLUDED.url,
                username = EXCLUDED.username,
                token = EXCLUDED.token,
                branch = EXCLUDED.branch,
                is_active = TRUE,
                updated_at = CURRENT_TIMESTAMP
            """,
            (repo_id, name, url, username, token, branch),
        )
        conn.commit()
        cursor.close()
        AuditDatabase.release_connection(conn)

    @staticmethod
    def delete_repository(repo_id):
        """Soft-delete repository (set is_active=FALSE)."""
        if not AuditDatabase._pool:
            repositories = AuditDatabase._ensure_memory_repositories()
            existing = repositories.get(repo_id)
            if existing:
                existing["is_active"] = False
                existing["updated_at"] = AuditDatabase._memory_timestamp()
            return
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE configured_repositories SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (repo_id,),
        )
        conn.commit()
        cursor.close()
        AuditDatabase.release_connection(conn)

    @staticmethod
    def get_effective_rules(target_id):
        """Retrieves and merges GLOBAL rules with project-specific rules."""
        global_rules = AuditDatabase.get_project_rules("GLOBAL") or {}
        project_rules = AuditDatabase.get_project_rules(target_id) or {} if target_id != "GLOBAL" else {}

        # Merge disabled
        g_dis = set(global_rules.get("disabled_core_rules", []))
        p_dis = set(project_rules.get("disabled_core_rules", []))
        p_en = set(project_rules.get("enabled_core_rules", []))
        
        effective_disabled = list((g_dis | p_dis) - p_en)

        # Merge weights
        effective_weights = global_rules.get("custom_weights", {}).copy()
        effective_weights.update(project_rules.get("custom_weights", {}))

        return {
            "disabled_core_rules": effective_disabled,
            "custom_weights": effective_weights,
            "compiled_json": project_rules.get("compiled_json", {}),
            "natural_text": project_rules.get("natural_text", "")
        }

# Avoid initializing DB on import immediately if docker is not up
# AuditDatabase.initialize()
