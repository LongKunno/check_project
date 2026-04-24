import ast
import hashlib
import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

from psycopg2.extras import Json, RealDictCursor

from src.engine.database import AuditDatabase

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _json_loads(value: Any, default: Any):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _sha256_text(value: str) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()


def _split_evenly(total: int, parts: int) -> List[int]:
    if parts <= 0:
        return []
    base = int(total or 0) // parts
    remainder = int(total or 0) % parts
    return [base + (1 if idx < remainder else 0) for idx in range(parts)]


def _split_evenly_float(total: float, parts: int) -> List[float]:
    if parts <= 0:
        return []
    total = float(total or 0.0)
    base = round(total / parts, 8)
    values = [base for _ in range(parts)]
    if values:
        values[-1] = round(total - sum(values[:-1]), 8)
    return values


def _empty_stage_summary() -> Dict[str, Any]:
    return {
        "hits": 0,
        "misses": 0,
        "writes": 0,
        "saved_input_tokens": 0,
        "saved_output_tokens": 0,
        "saved_cost_usd": 0.0,
    }


def _empty_run_summary() -> Dict[str, Any]:
    return {
        "hits": 0,
        "misses": 0,
        "writes": 0,
        "saved_input_tokens": 0,
        "saved_output_tokens": 0,
        "saved_cost_usd": 0.0,
        "by_stage": {
            "validation": _empty_stage_summary(),
            "deep_audit": _empty_stage_summary(),
            "cross_check": _empty_stage_summary(),
        },
    }


class ProjectAiCacheIndex:
    TRANSPARENT_ROOTS = {"source_code", "src", "app", "backend", "api", "code"}

    def __init__(self, target_dir: str, discovery_files: Sequence[Dict[str, Any]]):
        self.target_dir = os.path.abspath(target_dir)
        self.discovery_files = list(discovery_files or [])
        self.records: Dict[str, Dict[str, Any]] = {}
        self._dependency_graph: Dict[str, Set[str]] = {}
        self._dependency_fingerprints: Dict[str, str] = {}
        self._module_index: Dict[str, Set[str]] = {}
        self._prefixes: Set[str] = set()
        self._built = False

    def build(self) -> "ProjectAiCacheIndex":
        if self._built:
            return self

        for file_info in self.discovery_files:
            path = os.path.abspath(str(file_info.get("path") or ""))
            if not path:
                continue
            rel_path = self.normalize_relative_path(path)
            if rel_path in self.records:
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception:
                continue

            record = {
                "path": path,
                "relative_path": rel_path,
                "content": content,
                "content_sha256": _sha256_text(content),
                "loc": int(file_info.get("loc") or 0),
                "feature": file_info.get("feature"),
            }
            self.records[rel_path] = record

            rel_parts = rel_path.split("/")
            if rel_parts and rel_parts[0] in self.TRANSPARENT_ROOTS:
                self._prefixes.add(rel_parts[0])
            for module_name in self._module_names_for_path(rel_path):
                self._module_index.setdefault(module_name, set()).add(rel_path)

        self._dependency_graph = {
            rel_path: self._extract_dependencies(record)
            for rel_path, record in self.records.items()
        }
        self._built = True
        return self

    def normalize_relative_path(self, file_path: str) -> str:
        raw_path = str(file_path or "")
        if not raw_path:
            return ""
        path = raw_path
        if not os.path.isabs(path):
            path = os.path.join(self.target_dir, path)
        path = os.path.abspath(path)
        rel_path = os.path.relpath(path, self.target_dir)
        return rel_path.replace("\\", "/")

    def _module_names_for_path(self, rel_path: str) -> Set[str]:
        rel_parts = [part for part in rel_path.replace("\\", "/").split("/") if part]
        if not rel_parts:
            return set()
        filename = rel_parts[-1]
        if not filename.endswith(".py"):
            return set()

        module_parts = rel_parts[:-1]
        stem = filename[:-3]
        aliases: Set[str] = set()

        def register(parts: List[str]):
            if stem != "__init__":
                full = parts + [stem]
                if full:
                    aliases.add(".".join(full))
            elif parts:
                aliases.add(".".join(parts))

        register(module_parts)
        if module_parts and module_parts[0] in self.TRANSPARENT_ROOTS:
            register(module_parts[1:])
        elif stem != "__init__":
            aliases.add(stem)
        return {alias for alias in aliases if alias}

    def _candidate_paths_for_module(self, module_name: str) -> List[str]:
        module_name = str(module_name or "").strip(".")
        if not module_name:
            return []

        parts = [part for part in module_name.split(".") if part]
        if not parts:
            return []

        candidates = []
        prefixes = [""] + sorted(self._prefixes)
        for prefix in prefixes:
            base_parts = [prefix] + parts if prefix else list(parts)
            candidates.append("/".join(base_parts) + ".py")
            candidates.append("/".join(base_parts + ["__init__.py"]))
        return candidates

    def _resolve_module_to_paths(self, module_name: str) -> Set[str]:
        matches = set()
        for candidate in self._candidate_paths_for_module(module_name):
            if candidate in self.records:
                matches.add(candidate)
        matches.update(self._module_index.get(module_name, set()))
        return matches

    def _current_package_parts(self, rel_path: str) -> List[str]:
        rel_parts = [part for part in rel_path.replace("\\", "/").split("/") if part]
        if not rel_parts:
            return []
        filename = rel_parts[-1]
        module_parts = rel_parts[:-1]
        if module_parts and module_parts[0] in self.TRANSPARENT_ROOTS:
            module_parts = module_parts[1:]
        if filename == "__init__.py":
            return module_parts
        return module_parts

    def _resolve_relative_module(
        self,
        rel_path: str,
        level: int,
        module: Optional[str],
        alias_name: Optional[str] = None,
    ) -> Set[str]:
        package_parts = self._current_package_parts(rel_path)
        trim = max(int(level or 0) - 1, 0)
        if trim > len(package_parts):
            base_parts: List[str] = []
        else:
            base_parts = package_parts[: len(package_parts) - trim]

        candidates: Set[str] = set()
        module_parts = [part for part in str(module or "").split(".") if part]
        if module_parts:
            module_name = ".".join(base_parts + module_parts)
            candidates.update(self._resolve_module_to_paths(module_name))
        if alias_name:
            alias_parts = [part for part in str(alias_name).split(".") if part]
            alias_module_name = ".".join(base_parts + module_parts + alias_parts)
            candidates.update(self._resolve_module_to_paths(alias_module_name))
        return candidates

    def _extract_dependencies(self, record: Dict[str, Any]) -> Set[str]:
        rel_path = record["relative_path"]
        if not rel_path.endswith(".py"):
            return set()

        try:
            tree = ast.parse(record["content"])
        except Exception:
            return set()

        dependencies: Set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    dependencies.update(self._resolve_module_to_paths(alias.name))
            elif isinstance(node, ast.ImportFrom):
                if node.level:
                    if node.module:
                        dependencies.update(
                            self._resolve_relative_module(
                                rel_path,
                                node.level,
                                node.module,
                            )
                        )
                    for alias in node.names:
                        dependencies.update(
                            self._resolve_relative_module(
                                rel_path,
                                node.level,
                                node.module,
                                alias.name,
                            )
                        )
                else:
                    if node.module:
                        dependencies.update(self._resolve_module_to_paths(node.module))
                    for alias in node.names:
                        if node.module:
                            dependencies.update(
                                self._resolve_module_to_paths(f"{node.module}.{alias.name}")
                            )
        dependencies.discard(rel_path)
        return dependencies

    def get_record(self, file_path: str) -> Optional[Dict[str, Any]]:
        self.build()
        rel_path = self.normalize_relative_path(file_path)
        record = self.records.get(rel_path)
        return dict(record) if record else None

    def get_content_sha(self, file_path: str) -> str:
        record = self.get_record(file_path)
        return record.get("content_sha256", "") if record else ""

    def get_dependency_fingerprint(self, file_path: str) -> str:
        self.build()
        rel_path = self.normalize_relative_path(file_path)
        if rel_path in self._dependency_fingerprints:
            return self._dependency_fingerprints[rel_path]
        if rel_path not in self.records:
            return ""

        visited: Set[str] = set()
        stack = [rel_path]
        payload: List[List[str]] = []
        while stack:
            current = stack.pop()
            if current in visited or current not in self.records:
                continue
            visited.add(current)
            payload.append([current, self.records[current]["content_sha256"]])
            for dependency in sorted(self._dependency_graph.get(current, set()), reverse=True):
                stack.append(dependency)

        fingerprint = _sha256_text(_json_dumps(sorted(payload)))
        self._dependency_fingerprints[rel_path] = fingerprint
        return fingerprint

    def build_deep_audit_batches(
        self,
        candidate_paths: Optional[Iterable[str]] = None,
        *,
        max_files: int = 5,
        max_chars: int = 210000,
    ) -> List[List[Dict[str, Any]]]:
        self.build()
        selected_records: List[Dict[str, Any]] = []
        selected = None
        if candidate_paths is not None:
            selected = {
                self.normalize_relative_path(path)
                for path in candidate_paths
                if path
            }
        for item in self.discovery_files:
            rel_path = self.normalize_relative_path(item.get("path"))
            if selected is not None and rel_path not in selected:
                continue
            record = self.records.get(rel_path)
            if record:
                selected_records.append(dict(record))

        deep_chunks: List[List[Dict[str, Any]]] = []
        current_batch: List[Dict[str, Any]] = []
        current_size = 0
        for record in selected_records:
            file_chars = len(record["content"])
            if file_chars >= max_chars:
                if current_batch:
                    deep_chunks.append(current_batch)
                    current_batch, current_size = [], 0
                deep_chunks.append([record])
                continue
            if current_batch and (
                current_size + file_chars > max_chars or len(current_batch) >= max_files
            ):
                deep_chunks.append(current_batch)
                current_batch, current_size = [], 0
            current_batch.append(record)
            current_size += file_chars

        if current_batch:
            deep_chunks.append(current_batch)
        return deep_chunks


class AiAuditCache:
    POLICY_CONFIG_KEYS = {
        "enabled": "ai_cache_enabled",
        "validation_enabled": "ai_cache_validation_enabled",
        "deep_audit_enabled": "ai_cache_deep_audit_enabled",
        "cross_check_enabled": "ai_cache_cross_check_enabled",
        "retention_days": "ai_cache_retention_days",
        "last_cleanup_at": "ai_cache_last_cleanup_at",
    }
    PROMPT_VERSIONS = {
        "validation": "2026-04-22.validation.v1",
        "deep_audit": "2026-04-22.deep_audit.v1",
        "cross_check": "2026-04-22.cross_check.v1",
    }
    DEFAULT_POLICY = {
        "enabled": True,
        "validation_enabled": True,
        "deep_audit_enabled": True,
        "cross_check_enabled": True,
        "retention_days": 30,
        "last_cleanup_at": None,
    }

    def __init__(self):
        self._memory_entries: Dict[str, Dict[str, Any]] = {}
        self._memory_runs: Dict[str, Dict[str, Any]] = {}
        self._pending_runs: Dict[str, Dict[str, Any]] = {}
        self._memory_policy = dict(self.DEFAULT_POLICY)

    def _db_ready(self) -> bool:
        return bool(getattr(AuditDatabase, "_pool", None))

    def empty_run_summary(self) -> Dict[str, Any]:
        return _empty_run_summary()

    def _policy_bool(self, raw: Any, default: bool) -> bool:
        if raw is None:
            return default
        return str(raw).strip().lower() in {"true", "1", "yes", "on"}

    def get_policy(self) -> Dict[str, Any]:
        if not self._db_ready():
            return dict(self._memory_policy)

        policy = dict(self.DEFAULT_POLICY)
        for field, key in self.POLICY_CONFIG_KEYS.items():
            raw = AuditDatabase.get_config(key)
            if field == "retention_days":
                try:
                    policy[field] = int(raw) if raw is not None else policy[field]
                except Exception:
                    policy[field] = self.DEFAULT_POLICY["retention_days"]
            elif field == "last_cleanup_at":
                policy[field] = str(raw) if raw else None
            else:
                policy[field] = self._policy_bool(raw, policy[field])
        return policy

    def save_policy(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        policy = {**self.get_policy(), **(payload or {})}
        policy["retention_days"] = max(1, int(policy.get("retention_days") or 30))

        if not self._db_ready():
            self._memory_policy = policy
            self.cleanup_expired()
            return dict(self._memory_policy)

        for field, key in self.POLICY_CONFIG_KEYS.items():
            if field not in policy or field == "last_cleanup_at":
                continue
            AuditDatabase.set_config(key, policy[field])
        self.cleanup_expired()
        return self.get_policy()

    def build_rules_version(self, merged_rules: Optional[Dict[str, Any]]) -> str:
        return _sha256_text(_json_dumps(merged_rules or {}))

    def build_custom_rules_hash(self, custom_rules: Optional[Dict[str, Any]]) -> str:
        return _sha256_text(_json_dumps(custom_rules or {}))

    def normalize_reason(self, reason: str) -> str:
        normalized = str(reason or "").strip()
        if ". AI Note:" in normalized:
            normalized = normalized.split(". AI Note:", 1)[0].strip()
        if "[Cross-Checked:" in normalized:
            normalized = normalized.split("[Cross-Checked:", 1)[0].strip()
        return normalized

    def prompt_version(self, stage: str) -> str:
        return self.PROMPT_VERSIONS.get(stage, "unknown")

    def _build_cache_identity(self, entry_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "entry_type": entry_type,
            **dict(payload or {}),
        }

    def _cache_key_hash(self, entry_type: str, payload: Dict[str, Any]) -> str:
        return _sha256_text(_json_dumps(self._build_cache_identity(entry_type, payload)))

    def is_enabled_for(self, stage: str, policy: Optional[Dict[str, Any]] = None) -> bool:
        policy = policy or self.get_policy()
        if not policy.get("enabled", True):
            return False
        if stage == "validation":
            return bool(policy.get("validation_enabled", True))
        if stage == "deep_audit":
            return bool(policy.get("deep_audit_enabled", True))
        if stage == "cross_check":
            return bool(policy.get("cross_check_enabled", True))
        return False

    def lookup_entry(
        self,
        *,
        entry_type: str,
        payload: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        cache_key_hash = self._cache_key_hash(entry_type, payload)
        if not self._db_ready():
            entry = self._memory_entries.get(cache_key_hash)
            if not entry:
                return None
            entry["hit_count"] = int(entry.get("hit_count") or 0) + 1
            entry["last_hit_at"] = _utc_now().isoformat()
            return dict(entry)

        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT cache_key_hash, entry_type, target_id, mode, model,
                       prompt_version, rules_version, custom_rules_hash,
                       input_meta, result_json,
                       source_input_tokens, source_output_tokens, source_estimated_cost,
                       hit_count, created_at, last_hit_at
                FROM ai_cache_entries
                WHERE cache_key_hash = %s
                LIMIT 1
                """,
                (cache_key_hash,),
            )
            row = cursor.fetchone()
            if not row:
                cursor.close()
                return None
            cursor.execute(
                """
                UPDATE ai_cache_entries
                SET hit_count = COALESCE(hit_count, 0) + 1,
                    last_hit_at = CURRENT_TIMESTAMP
                WHERE cache_key_hash = %s
                """,
                (cache_key_hash,),
            )
            conn.commit()
            cursor.close()
            return {
                **dict(row),
                "input_meta": _json_loads(row.get("input_meta"), {}),
                "result_json": _json_loads(row.get("result_json"), {}),
            }
        finally:
            AuditDatabase.release_connection(conn)

    def store_entry(
        self,
        *,
        entry_type: str,
        payload: Dict[str, Any],
        result_json: Any,
        source_input_tokens: int = 0,
        source_output_tokens: int = 0,
        source_estimated_cost: float = 0.0,
    ) -> Dict[str, Any]:
        identity = self._build_cache_identity(entry_type, payload)
        cache_key_hash = self._cache_key_hash(entry_type, payload)
        entry = {
            "cache_key_hash": cache_key_hash,
            "entry_type": entry_type,
            "target_id": payload.get("target_id"),
            "mode": payload.get("mode"),
            "model": payload.get("model"),
            "prompt_version": payload.get("prompt_version"),
            "rules_version": payload.get("rules_version"),
            "custom_rules_hash": payload.get("custom_rules_hash"),
            "input_meta": identity,
            "result_json": result_json,
            "source_input_tokens": int(source_input_tokens or 0),
            "source_output_tokens": int(source_output_tokens or 0),
            "source_estimated_cost": round(float(source_estimated_cost or 0.0), 8),
            "hit_count": 0,
            "last_hit_at": None,
        }

        if not self._db_ready():
            created_at = _utc_now().isoformat()
            existing = self._memory_entries.get(cache_key_hash) or {}
            self._memory_entries[cache_key_hash] = {
                **existing,
                **entry,
                "created_at": existing.get("created_at") or created_at,
            }
            return dict(self._memory_entries[cache_key_hash])

        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO ai_cache_entries (
                    cache_key_hash, entry_type, target_id, mode, model,
                    prompt_version, rules_version, custom_rules_hash,
                    input_meta, result_json,
                    source_input_tokens, source_output_tokens, source_estimated_cost,
                    hit_count, created_at, last_hit_at, updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP
                )
                ON CONFLICT (cache_key_hash) DO UPDATE SET
                    target_id = EXCLUDED.target_id,
                    mode = EXCLUDED.mode,
                    model = EXCLUDED.model,
                    prompt_version = EXCLUDED.prompt_version,
                    rules_version = EXCLUDED.rules_version,
                    custom_rules_hash = EXCLUDED.custom_rules_hash,
                    input_meta = EXCLUDED.input_meta,
                    result_json = EXCLUDED.result_json,
                    source_input_tokens = EXCLUDED.source_input_tokens,
                    source_output_tokens = EXCLUDED.source_output_tokens,
                    source_estimated_cost = EXCLUDED.source_estimated_cost,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    cache_key_hash,
                    entry_type,
                    payload.get("target_id"),
                    payload.get("mode"),
                    payload.get("model"),
                    payload.get("prompt_version"),
                    payload.get("rules_version"),
                    payload.get("custom_rules_hash"),
                    Json(identity),
                    Json(result_json),
                    int(source_input_tokens or 0),
                    int(source_output_tokens or 0),
                    round(float(source_estimated_cost or 0.0), 8),
                    0,
                ),
            )
            conn.commit()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)
        return entry

    def start_run(self, job_id: Optional[str], target_id: Optional[str] = None):
        if not job_id:
            return
        self._pending_runs[job_id] = {
            **_empty_run_summary(),
            "job_id": job_id,
            "target_id": target_id,
            "created_at": _utc_now().isoformat(),
        }

    def _ensure_run(self, job_id: str) -> Dict[str, Any]:
        if job_id not in self._pending_runs:
            self.start_run(job_id)
        return self._pending_runs[job_id]

    def record_hit(self, job_id: Optional[str], stage: str, entry: Dict[str, Any]):
        if not job_id:
            return
        summary = self._ensure_run(job_id)
        summary["hits"] += 1
        summary["saved_input_tokens"] += int(entry.get("source_input_tokens") or 0)
        summary["saved_output_tokens"] += int(entry.get("source_output_tokens") or 0)
        summary["saved_cost_usd"] = round(
            summary["saved_cost_usd"] + float(entry.get("source_estimated_cost") or 0),
            8,
        )
        stage_summary = summary["by_stage"].setdefault(stage, _empty_stage_summary())
        stage_summary["hits"] += 1
        stage_summary["saved_input_tokens"] += int(entry.get("source_input_tokens") or 0)
        stage_summary["saved_output_tokens"] += int(entry.get("source_output_tokens") or 0)
        stage_summary["saved_cost_usd"] = round(
            stage_summary["saved_cost_usd"]
            + float(entry.get("source_estimated_cost") or 0),
            8,
        )

    def record_miss(self, job_id: Optional[str], stage: str, count: int = 1):
        if not job_id or count <= 0:
            return
        summary = self._ensure_run(job_id)
        summary["misses"] += int(count)
        stage_summary = summary["by_stage"].setdefault(stage, _empty_stage_summary())
        stage_summary["misses"] += int(count)

    def record_write(self, job_id: Optional[str], stage: str, count: int = 1):
        if not job_id or count <= 0:
            return
        summary = self._ensure_run(job_id)
        summary["writes"] += int(count)
        stage_summary = summary["by_stage"].setdefault(stage, _empty_stage_summary())
        stage_summary["writes"] += int(count)

    def summarize_run(self, job_id: Optional[str]) -> Dict[str, Any]:
        if not job_id:
            return _empty_run_summary()
        summary = self._pending_runs.get(job_id)
        if not summary:
            return _empty_run_summary()
        return {
            "hits": int(summary.get("hits") or 0),
            "misses": int(summary.get("misses") or 0),
            "writes": int(summary.get("writes") or 0),
            "saved_input_tokens": int(summary.get("saved_input_tokens") or 0),
            "saved_output_tokens": int(summary.get("saved_output_tokens") or 0),
            "saved_cost_usd": round(float(summary.get("saved_cost_usd") or 0.0), 8),
            "by_stage": {
                key: {
                    "hits": int(value.get("hits") or 0),
                    "misses": int(value.get("misses") or 0),
                    "writes": int(value.get("writes") or 0),
                    "saved_input_tokens": int(value.get("saved_input_tokens") or 0),
                    "saved_output_tokens": int(value.get("saved_output_tokens") or 0),
                    "saved_cost_usd": round(float(value.get("saved_cost_usd") or 0.0), 8),
                }
                for key, value in (summary.get("by_stage") or {}).items()
            },
        }

    def finalize_run(
        self,
        job_id: Optional[str],
        *,
        target_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not job_id:
            return _empty_run_summary()
        summary = self.summarize_run(job_id)
        pending = self._pending_runs.pop(job_id, None)
        if not pending or (
            not summary["hits"] and not summary["misses"] and not summary["writes"]
        ):
            return summary

        row = {
            "job_id": job_id,
            "target_id": target_id or pending.get("target_id"),
            "hits": summary["hits"],
            "misses": summary["misses"],
            "writes": summary["writes"],
            "saved_input_tokens": summary["saved_input_tokens"],
            "saved_output_tokens": summary["saved_output_tokens"],
            "saved_cost_usd": summary["saved_cost_usd"],
            "by_stage": summary["by_stage"],
            "created_at": pending.get("created_at") or _utc_now().isoformat(),
        }

        if not self._db_ready():
            self._memory_runs[job_id] = row
            return summary

        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO ai_cache_runs (
                    job_id, target_id, hits, misses, writes,
                    saved_input_tokens, saved_output_tokens, saved_cost_usd,
                    by_stage, created_at, updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, CURRENT_TIMESTAMP
                )
                ON CONFLICT (job_id) DO UPDATE SET
                    target_id = EXCLUDED.target_id,
                    hits = EXCLUDED.hits,
                    misses = EXCLUDED.misses,
                    writes = EXCLUDED.writes,
                    saved_input_tokens = EXCLUDED.saved_input_tokens,
                    saved_output_tokens = EXCLUDED.saved_output_tokens,
                    saved_cost_usd = EXCLUDED.saved_cost_usd,
                    by_stage = EXCLUDED.by_stage,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    row["job_id"],
                    row["target_id"],
                    row["hits"],
                    row["misses"],
                    row["writes"],
                    row["saved_input_tokens"],
                    row["saved_output_tokens"],
                    row["saved_cost_usd"],
                    Json(row["by_stage"]),
                    row["created_at"],
                ),
            )
            conn.commit()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)
        return summary

    def cleanup_expired(self) -> Dict[str, Any]:
        policy = self.get_policy()
        retention_days = max(1, int(policy.get("retention_days") or 30))
        cutoff = _utc_now() - timedelta(days=retention_days)
        cleanup_stamp = _utc_now().isoformat()

        if not self._db_ready():
            self._memory_entries = {
                key: value
                for key, value in self._memory_entries.items()
                if str(value.get("last_hit_at") or value.get("created_at") or "") >= cutoff.isoformat()
            }
            self._memory_runs = {
                key: value
                for key, value in self._memory_runs.items()
                if str(value.get("created_at") or "") >= cutoff.isoformat()
            }
            self._memory_policy["last_cleanup_at"] = cleanup_stamp
            return {
                "deleted_entries": 0,
                "deleted_runs": 0,
                "last_cleanup_at": cleanup_stamp,
            }

        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM ai_cache_entries
                WHERE COALESCE(last_hit_at, created_at) < %s
                """,
                (cutoff,),
            )
            deleted_entries = cursor.rowcount
            cursor.execute(
                """
                DELETE FROM ai_cache_runs
                WHERE created_at < %s
                """,
                (cutoff,),
            )
            deleted_runs = cursor.rowcount
            conn.commit()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)

        AuditDatabase.set_config(self.POLICY_CONFIG_KEYS["last_cleanup_at"], cleanup_stamp)
        return {
            "deleted_entries": deleted_entries,
            "deleted_runs": deleted_runs,
            "last_cleanup_at": cleanup_stamp,
        }

    def clear_cache(self) -> Dict[str, Any]:
        self._pending_runs.clear()
        if not self._db_ready():
            self._memory_entries.clear()
            self._memory_runs.clear()
            return self.get_cache_state()

        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM ai_cache_entries")
            cursor.execute("DELETE FROM ai_cache_runs")
            conn.commit()
            cursor.close()
        finally:
            AuditDatabase.release_connection(conn)
        return self.get_cache_state()

    def _fetch_run_rows(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not self._db_ready():
            rows = list(self._memory_runs.values())
            if date_from:
                rows = [row for row in rows if str(row.get("created_at") or "") >= date_from]
            if date_to:
                rows = [row for row in rows if str(row.get("created_at") or "") < date_to]
            return rows

        where = []
        params: List[Any] = []
        if date_from:
            where.append("created_at >= %s")
            params.append(date_from)
        if date_to:
            where.append("created_at < %s")
            params.append(date_to)
        clause = f"WHERE {' AND '.join(where)}" if where else ""

        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                f"""
                SELECT job_id, target_id, hits, misses, writes,
                       saved_input_tokens, saved_output_tokens, saved_cost_usd,
                       by_stage, created_at, updated_at
                FROM ai_cache_runs
                {clause}
                ORDER BY created_at ASC
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
            cursor.close()
            return [dict(row) for row in rows]
        finally:
            AuditDatabase.release_connection(conn)

    def _count_entries(self) -> int:
        if not self._db_ready():
            return len(self._memory_entries)
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM ai_cache_entries")
            count = int(cursor.fetchone()[0])
            cursor.close()
            return count
        finally:
            AuditDatabase.release_connection(conn)

    def _last_hit_at(self) -> Optional[str]:
        if not self._db_ready():
            values = [
                str(entry.get("last_hit_at") or "")
                for entry in self._memory_entries.values()
                if entry.get("last_hit_at")
            ]
            return max(values) if values else None
        conn = AuditDatabase.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT MAX(last_hit_at) FROM ai_cache_entries")
            value = cursor.fetchone()[0]
            cursor.close()
            return value.isoformat() if value else None
        finally:
            AuditDatabase.release_connection(conn)

    def _aggregate_runs(self, rows: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        summary = _empty_run_summary()
        for row in rows:
            summary["hits"] += int(row.get("hits") or 0)
            summary["misses"] += int(row.get("misses") or 0)
            summary["writes"] += int(row.get("writes") or 0)
            summary["saved_input_tokens"] += int(row.get("saved_input_tokens") or 0)
            summary["saved_output_tokens"] += int(row.get("saved_output_tokens") or 0)
            summary["saved_cost_usd"] = round(
                summary["saved_cost_usd"] + float(row.get("saved_cost_usd") or 0.0),
                8,
            )
            by_stage = _json_loads(row.get("by_stage"), {}) or {}
            for stage, stage_value in by_stage.items():
                bucket = summary["by_stage"].setdefault(stage, _empty_stage_summary())
                bucket["hits"] += int(stage_value.get("hits") or 0)
                bucket["misses"] += int(stage_value.get("misses") or 0)
                bucket["writes"] += int(stage_value.get("writes") or 0)
                bucket["saved_input_tokens"] += int(
                    stage_value.get("saved_input_tokens") or 0
                )
                bucket["saved_output_tokens"] += int(
                    stage_value.get("saved_output_tokens") or 0
                )
                bucket["saved_cost_usd"] = round(
                    bucket["saved_cost_usd"]
                    + float(stage_value.get("saved_cost_usd") or 0.0),
                    8,
                )
        total = summary["hits"] + summary["misses"]
        summary["hit_rate"] = round(summary["hits"] / total, 4) if total else 0.0
        return summary

    def get_overview_summary(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        rows = self._fetch_run_rows(date_from=date_from, date_to=date_to)
        return self._aggregate_runs(rows)

    def get_usage_series(
        self,
        *,
        granularity: str = "day",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        rows = self._fetch_run_rows(date_from=date_from, date_to=date_to)
        buckets: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            created_at = row.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except Exception:
                    created_at = None
            if not isinstance(created_at, datetime):
                continue
            if granularity == "hour":
                bucket_key = created_at.replace(minute=0, second=0, microsecond=0).isoformat()
            else:
                bucket_key = created_at.date().isoformat()
            bucket = buckets.setdefault(
                bucket_key,
                {
                    "bucket": bucket_key,
                    "cache_hits": 0,
                    "cache_misses": 0,
                    "cache_writes": 0,
                    "saved_input_tokens": 0,
                    "saved_output_tokens": 0,
                    "saved_cost_usd": 0.0,
                },
            )
            bucket["cache_hits"] += int(row.get("hits") or 0)
            bucket["cache_misses"] += int(row.get("misses") or 0)
            bucket["cache_writes"] += int(row.get("writes") or 0)
            bucket["saved_input_tokens"] += int(row.get("saved_input_tokens") or 0)
            bucket["saved_output_tokens"] += int(row.get("saved_output_tokens") or 0)
            bucket["saved_cost_usd"] = round(
                bucket["saved_cost_usd"] + float(row.get("saved_cost_usd") or 0.0),
                8,
            )
        for bucket in buckets.values():
            total = bucket["cache_hits"] + bucket["cache_misses"]
            bucket["cache_hit_rate"] = round(bucket["cache_hits"] / total, 4) if total else 0.0
        return [buckets[key] for key in sorted(buckets.keys())]

    def get_cache_state(self, *, cleanup: bool = True) -> Dict[str, Any]:
        if cleanup:
            self.cleanup_expired()
        policy = self.get_policy()
        summary = self.get_overview_summary()
        return {
            **policy,
            "entries_count": self._count_entries(),
            "last_hit_at": self._last_hit_at(),
            "all_time_summary": summary,
        }

    def estimate_split_metrics(
        self,
        *,
        messages: Any,
        output_payload: Any,
        provider: str,
        mode: str,
        model: str,
        shares: int,
    ) -> List[Dict[str, Any]]:
        if shares <= 0:
            return []

        from src.engine.ai_telemetry import ai_telemetry

        input_text = ai_telemetry._stringify_payload(messages)
        output_text = ai_telemetry._stringify_payload(output_payload)
        input_tokens = ai_telemetry._estimate_tokens_from_text(input_text)
        output_tokens = ai_telemetry._estimate_tokens_from_text(output_text)
        estimated_cost = ai_telemetry._calculate_cost(
            provider=provider,
            mode=mode,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_tokens=0,
        )

        input_parts = _split_evenly(input_tokens, shares)
        output_parts = _split_evenly(output_tokens, shares)
        cost_parts = _split_evenly_float(estimated_cost, shares)
        return [
            {
                "source_input_tokens": input_parts[idx],
                "source_output_tokens": output_parts[idx],
                "source_estimated_cost": cost_parts[idx],
            }
            for idx in range(shares)
        ]


ai_audit_cache = AiAuditCache()
