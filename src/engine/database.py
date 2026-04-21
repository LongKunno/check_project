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
from datetime import datetime

logger = logging.getLogger(__name__)

# Database URL: PHẢI được cấu hình qua biến môi trường DATABASE_URL hoặc docker-compose.yml
# Fallback chỉ dùng cho local development (yêu cầu cấu hình riêng)
DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    logger.warning(
        "DATABASE_URL not set! Database operations will fail. Set it in .env or docker-compose.yml."
    )
    DB_URL = "postgresql://localhost:5432/auditor_v2"  # Sẽ fail-fast nếu chưa cấu hình


class AuditDatabase:
    """
    Manages the PostgreSQL database for audit history.
    """

    _pool = None

    @staticmethod
    def get_connection():
        # Lazy initialization
        if not AuditDatabase._pool:
            AuditDatabase.initialize()
        return AuditDatabase._pool.getconn()

    @staticmethod
    def release_connection(conn):
        if AuditDatabase._pool and conn:
            AuditDatabase._pool.putconn(conn)

    @staticmethod
    def initialize():
        """Creates the necessary tables if they don't exist, retries connection on startup."""
        import time

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
                "Failed to connect to Postgres after multiple retries. Database not initialized."
            )
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
                    scan_mode TEXT DEFAULT 'full_ai'
                )
            """)

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
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        serialized_full_json = json.dumps(full_json) if full_json else None
        cursor.execute(
            """
            INSERT INTO audit_history (target, score, rating, total_loc, violations_count, pillar_scores, full_json, scan_mode)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
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
            ),
        )
        audit_id = cursor.fetchone()[0]
        if isinstance(full_json, dict):
            enriched = dict(full_json)
            metadata = dict(enriched.get("metadata") or {})
            metadata["audit_id"] = audit_id
            enriched["metadata"] = metadata
            cursor.execute(
                "UPDATE audit_history SET full_json = %s WHERE id = %s",
                (json.dumps(enriched), audit_id),
            )
        conn.commit()
        cursor.close()
        AuditDatabase.release_connection(conn)
        return audit_id

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
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        if target_path:
            cursor.execute(
                "SELECT id, timestamp, target, score, rating, total_loc, violations_count, pillar_scores, full_json, scan_mode FROM audit_history WHERE target = %s ORDER BY timestamp DESC",
                (target_path,),
            )
        else:
            cursor.execute(
                "SELECT id, timestamp, target, score, rating, total_loc, violations_count, pillar_scores, full_json, scan_mode FROM audit_history ORDER BY timestamp DESC LIMIT 50"
            )

        rows = cursor.fetchall()
        cursor.close()
        AuditDatabase.release_connection(conn)

        results = []
        for row in rows:
            d = dict(row)
            # Chuyển đổi datetime sang ISO string để tương thích với Frontend
            if "timestamp" in d and isinstance(d["timestamp"], datetime):
                d["timestamp"] = d["timestamp"].isoformat()
            try:
                d["pillar_scores"] = json.loads(d.get("pillar_scores", "{}"))
            except Exception as e:
                logger.warning(f"Error parsing pillar_scores: {e}")
                d["pillar_scores"] = {}
            full_json = None
            if row.get("full_json"):
                try:
                    full_json = json.loads(row["full_json"])
                except Exception as e:
                    logger.warning(f"Error parsing history full_json: {e}")
            d["ai_summary"] = AuditDatabase._extract_ai_summary(full_json)
            d.pop("full_json", None)
            results.append(d)
        return results

    @staticmethod
    def get_audit_by_id(audit_id):
        """Retrieves details of a single audit including the full JSON payload by ID."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            "SELECT id, timestamp, target, score, rating, total_loc, violations_count, pillar_scores, full_json, scan_mode FROM audit_history WHERE id = %s",
            (audit_id,),
        )
        row = cursor.fetchone()
        cursor.close()
        AuditDatabase.release_connection(conn)

        if not row:
            return None

        d = dict(row)
        if "timestamp" in d and isinstance(d["timestamp"], datetime):
            d["timestamp"] = d["timestamp"].isoformat()

        try:
            d["pillar_scores"] = json.loads(d.get("pillar_scores", "{}"))
        except Exception as e:
            logger.warning(f"Error parsing pillar_scores in get_audit_by_id: {e}")
            d["pillar_scores"] = {}

        if d.get("full_json"):
            try:
                d["full_json"] = json.loads(d["full_json"])
            except Exception as e:
                logger.warning(f"Error parsing full_json: {e}")
                d["full_json"] = None
        d["ai_summary"] = AuditDatabase._extract_ai_summary(d.get("full_json"))
        return d

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
