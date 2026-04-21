from datetime import datetime
import json

import pytest

import src.engine.ai_telemetry as ai_telemetry_module
from src.engine.ai_telemetry import AiBudgetExceededError, ai_telemetry
from src.engine.database import AuditDatabase


def _reset_ai_telemetry_state():
    ai_telemetry._pending_batches.clear()
    ai_telemetry._memory_request_logs.clear()
    ai_telemetry._memory_pricing_catalog.clear()
    ai_telemetry._memory_budget_policy = dict(ai_telemetry.DEFAULT_BUDGET_POLICY)
    AuditDatabase._pool = None


def setup_function():
    _reset_ai_telemetry_state()


def teardown_function():
    _reset_ai_telemetry_state()


def test_complete_request_uses_pricing_catalog_and_redacts_preview():
    ai_telemetry.save_pricing_catalog(
        [
            {
                "provider": "proxy",
                "mode": "realtime",
                "model": "test-model",
                "input_cost_per_million": 1.0,
                "output_cost_per_million": 2.0,
                "cached_input_cost_per_million": 0.5,
                "currency": "USD",
                "is_active": True,
            }
        ]
    )

    record = ai_telemetry.begin_request(
        payload='Authorization: Bearer sk-secret-token',
        provider="proxy",
        mode="realtime",
        model="test-model",
        context={"source": "rules.compile", "job_id": "job-1", "project": "sandbox"},
    )

    detail = ai_telemetry.complete_request(
        record["request_id"],
        provider="proxy",
        mode="realtime",
        model="test-model",
        output_payload="done",
        usage={
            "prompt_tokens": 1000,
            "completion_tokens": 500,
            "prompt_tokens_details": {"cached_tokens": 100},
        },
    )

    assert detail["usage_source"] == "reported"
    assert detail["estimated_cost"] == pytest.approx(0.00195)

    stored = ai_telemetry.get_request_detail(record["request_id"])
    assert stored["input_preview"]
    assert "sk-secret-token" not in stored["input_preview"]
    assert "[REDACTED]" in stored["input_preview"]


def test_begin_request_logs_blocked_budget_when_hard_stop_is_reached():
    ai_telemetry.save_pricing_catalog(
        [
            {
                "provider": "proxy",
                "mode": "realtime",
                "model": "budget-model",
                "input_cost_per_million": 1.0,
                "output_cost_per_million": 0.0,
                "cached_input_cost_per_million": 0.0,
                "currency": "USD",
                "is_active": True,
            }
        ]
    )

    seed = ai_telemetry.begin_request(
        payload="seed",
        provider="proxy",
        mode="realtime",
        model="budget-model",
        context={"source": "health.ai", "job_id": "seed-job"},
    )
    ai_telemetry.complete_request(
        seed["request_id"],
        provider="proxy",
        mode="realtime",
        model="budget-model",
        output_payload="ok",
        usage={"prompt_tokens": 500000, "completion_tokens": 0},
    )

    ai_telemetry.save_budget_policy(
        {
            "daily_budget_usd": 0.5,
            "monthly_budget_usd": 10.0,
            "hard_stop_enabled": True,
            "retention_days": 30,
            "raw_payload_retention_enabled": False,
        }
    )

    with pytest.raises(AiBudgetExceededError):
        ai_telemetry.begin_request(
            payload="blocked",
            provider="proxy",
            mode="realtime",
            model="budget-model",
            context={"source": "audit.fix_suggestion", "job_id": "job-2"},
        )

    blocked = [
        item
        for item in ai_telemetry._memory_request_logs.values()
        if item.get("status") == "blocked_budget"
    ]
    assert blocked
    assert "budget exceeded" in blocked[0]["error_reason"].lower()


def test_summarize_scope_returns_source_breakdown():
    first = ai_telemetry.begin_request(
        payload="validation",
        provider="proxy",
        mode="realtime",
        model="scope-model",
        context={"source": "audit.validation", "job_id": "audit-job"},
    )
    ai_telemetry.complete_request(
        first["request_id"],
        provider="proxy",
        mode="realtime",
        model="scope-model",
        output_payload="ok",
        usage={"prompt_tokens": 10, "completion_tokens": 4},
    )

    second = ai_telemetry.begin_request(
        payload="deep",
        provider="proxy",
        mode="realtime",
        model="scope-model",
        context={"source": "audit.deep_audit", "job_id": "audit-job"},
    )
    ai_telemetry.complete_request(
        second["request_id"],
        provider="proxy",
        mode="realtime",
        model="scope-model",
        output_payload="ok",
        usage={"prompt_tokens": 20, "completion_tokens": 8},
    )

    summary = ai_telemetry.summarize_scope(job_id="audit-job", source_prefix="audit.")

    assert summary["total_requests"] == 2
    assert summary["input_tokens"] == 30
    assert summary["output_tokens"] == 12
    assert summary["by_source"]["audit.validation"]["requests"] == 1
    assert summary["by_source"]["audit.deep_audit"]["requests"] == 1


def test_save_pricing_catalog_rejects_incomplete_identity_fields():
    with pytest.raises(ValueError):
        ai_telemetry.save_pricing_catalog(
            [
                {
                    "provider": "proxy",
                    "mode": "realtime",
                    "model": "",
                }
            ]
        )


def test_annotate_scope_merges_audit_metadata_into_requests():
    record = ai_telemetry.begin_request(
        payload="validation",
        provider="proxy",
        mode="realtime",
        model="scope-model",
        context={"source": "audit.validation", "job_id": "audit-job"},
    )

    ai_telemetry.annotate_scope(
        job_id="audit-job",
        source_prefix="audit.",
        metadata={"audit_id": 42, "history_id": 42},
    )

    detail = ai_telemetry.get_request_detail(record["request_id"])
    assert detail["metadata"]["audit_id"] == 42
    assert detail["metadata"]["history_id"] == 42


def test_overview_includes_breakdowns():
    for source, provider, mode, model in (
        ("audit.validation", "openai", "realtime", "gpt-5.4"),
        ("health.ai", "proxy", "realtime", "gpt-5.4-mini"),
    ):
        record = ai_telemetry.begin_request(
            payload=source,
            provider=provider,
            mode=mode,
            model=model,
            context={"source": source, "job_id": f"job-{source}"},
        )
        ai_telemetry.complete_request(
            record["request_id"],
            provider=provider,
            mode=mode,
            model=model,
            output_payload="ok",
            usage={"prompt_tokens": 10, "completion_tokens": 4},
        )

    overview = ai_telemetry.get_overview()

    assert overview["breakdowns"]["source"][0]["label"]
    assert {item["label"] for item in overview["breakdowns"]["provider"]} == {
        "openai",
        "proxy",
    }


def test_save_pricing_catalog_uses_bulk_insert_when_db_ready(monkeypatch):
    calls = {"execute": [], "execute_values": None, "commits": 0, "released": 0}

    class FakeCursor:
        def execute(self, query, params=None):
            calls["execute"].append((query, params))

        def close(self):
            return None

    class FakeConnection:
        def __init__(self):
            self.cursor_obj = FakeCursor()

        def cursor(self, *args, **kwargs):
            return self.cursor_obj

        def commit(self):
            calls["commits"] += 1

    def fake_execute_values(cursor, query, rows, template=None, page_size=100):
        calls["execute_values"] = {
            "cursor": cursor,
            "query": query,
            "rows": list(rows),
            "template": template,
            "page_size": page_size,
        }

    AuditDatabase._pool = object()
    monkeypatch.setattr(
        AuditDatabase,
        "get_connection",
        staticmethod(lambda: FakeConnection()),
    )
    monkeypatch.setattr(
        AuditDatabase,
        "release_connection",
        staticmethod(lambda conn: calls.__setitem__("released", calls["released"] + 1)),
    )
    monkeypatch.setattr(ai_telemetry_module, "execute_values", fake_execute_values)
    monkeypatch.setattr(
        ai_telemetry,
        "get_pricing_catalog",
        lambda: list(ai_telemetry._memory_pricing_catalog),
    )

    ai_telemetry.save_pricing_catalog(
        [
            {
                "provider": "openai",
                "mode": "realtime",
                "model": "gpt-4.1-nano",
                "input_cost_per_million": 0.1,
                "output_cost_per_million": 0.2,
                "cached_input_cost_per_million": 0.05,
                "currency": "USD",
                "is_active": True,
            },
            {
                "provider": "openai",
                "mode": "openai_batch",
                "model": "gpt-4.1-nano",
                "input_cost_per_million": 0.08,
                "output_cost_per_million": 0.16,
                "cached_input_cost_per_million": 0.04,
                "currency": "USD",
                "is_active": True,
            },
        ]
    )

    assert any("DELETE FROM ai_pricing_catalog" in query for query, _ in calls["execute"])
    assert calls["execute_values"] is not None
    assert len(calls["execute_values"]["rows"]) == 2
    assert calls["commits"] == 1
    assert calls["released"] == 1


def test_annotate_scope_uses_bulk_update_when_db_ready(monkeypatch):
    calls = {"execute_values": None, "commits": 0, "released": 0}

    class FakeCursor:
        def __init__(self):
            self.executed = []

        def execute(self, query, params=None):
            self.executed.append((query, params))

        def fetchall(self):
            return [
                {"request_id": "req-1", "metadata": json.dumps({"existing": 1})},
                {"request_id": "req-2", "metadata": ""},
            ]

        def close(self):
            return None

    class FakeConnection:
        def __init__(self):
            self.cursor_obj = FakeCursor()

        def cursor(self, *args, **kwargs):
            return self.cursor_obj

        def commit(self):
            calls["commits"] += 1

    def fake_execute_values(cursor, query, rows, template=None, page_size=100):
        calls["execute_values"] = {
            "cursor": cursor,
            "query": query,
            "rows": list(rows),
            "template": template,
            "page_size": page_size,
        }

    record = ai_telemetry.begin_request(
        payload="validation",
        provider="proxy",
        mode="realtime",
        model="scope-model",
        context={"source": "audit.validation", "job_id": "audit-job"},
    )
    ai_telemetry.begin_request(
        payload="deep",
        provider="proxy",
        mode="realtime",
        model="scope-model",
        context={"source": "audit.deep_audit", "job_id": "audit-job"},
    )

    AuditDatabase._pool = object()
    monkeypatch.setattr(
        AuditDatabase,
        "get_connection",
        staticmethod(lambda: FakeConnection()),
    )
    monkeypatch.setattr(
        AuditDatabase,
        "release_connection",
        staticmethod(lambda conn: calls.__setitem__("released", calls["released"] + 1)),
    )
    monkeypatch.setattr(ai_telemetry_module, "execute_values", fake_execute_values)

    ai_telemetry.annotate_scope(
        job_id="audit-job",
        source_prefix="audit.",
        metadata={"audit_id": 42, "history_id": 42},
    )

    detail = ai_telemetry.get_request_detail(record["request_id"])
    assert detail["metadata"]["audit_id"] == 42
    assert calls["execute_values"] is not None
    assert len(calls["execute_values"]["rows"]) == 2
    first_row = calls["execute_values"]["rows"][0]
    assert first_row[0] == "req-1"
    assert json.loads(first_row[1])["audit_id"] == 42
    assert calls["commits"] == 1
    assert calls["released"] == 1
