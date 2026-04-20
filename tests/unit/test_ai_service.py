import asyncio
import importlib
from types import SimpleNamespace

import dotenv


def test_ai_service_defaults_to_gpt_5_4(monkeypatch):
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)

    import src.engine.ai_service as ai_service_module

    importlib.reload(ai_service_module)
    service = ai_service_module.AiService()

    assert service.model == "gpt-5.4"


def test_ai_service_prefers_ai_model_env(monkeypatch):
    monkeypatch.setenv("AI_MODEL", "test-model")

    import src.engine.ai_service as ai_service_module

    importlib.reload(ai_service_module)
    service = ai_service_module.AiService()

    assert service.model == "test-model"


def test_call_llm_json_skips_new_request_when_job_is_cancelled(monkeypatch):
    import src.engine.ai_service as ai_service_module

    service = ai_service_module.AiService()
    called = {"count": 0}

    async def fake_create(**kwargs):
        called["count"] += 1
        return None

    monkeypatch.setattr(
        ai_service_module.JobManager,
        "get_active_job_id",
        lambda: "job-cancelled",
    )
    monkeypatch.setattr(
        ai_service_module.JobManager,
        "is_cancel_requested",
        lambda job_id: True,
    )
    monkeypatch.setattr(ai_service_module.AuditState, "is_cancelled", False)
    service.client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=fake_create),
        )
    )

    result = asyncio.run(
        service._call_llm_json(
            "prompt",
            "system",
            ai_service_module.ValidationResponse,
        )
    )

    assert result is None
    assert called["count"] == 0


def test_call_llm_json_stops_retry_when_cancel_requested_after_failure(monkeypatch):
    import src.engine.ai_service as ai_service_module

    service = ai_service_module.AiService()
    state = {"cancelled": False, "calls": 0, "sleep_calls": 0}

    async def fake_create(**kwargs):
        state["calls"] += 1
        state["cancelled"] = True
        raise RuntimeError("boom")

    async def fake_sleep(_seconds):
        state["sleep_calls"] += 1

    monkeypatch.setattr(
        ai_service_module.JobManager,
        "get_active_job_id",
        lambda: "job-retrying",
    )
    monkeypatch.setattr(
        ai_service_module.JobManager,
        "is_cancel_requested",
        lambda job_id: state["cancelled"],
    )
    monkeypatch.setattr(ai_service_module.AuditState, "is_cancelled", False)
    monkeypatch.setattr(ai_service_module.asyncio, "sleep", fake_sleep)
    service.client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=fake_create),
        )
    )

    result = asyncio.run(
        service._call_llm_json(
            "prompt",
            "system",
            ai_service_module.ValidationResponse,
            max_retries=3,
        )
    )

    assert result is None
    assert state["calls"] == 1
    assert state["sleep_calls"] == 0


def test_call_llm_json_discards_success_response_after_cancel(monkeypatch):
    import src.engine.ai_service as ai_service_module

    service = ai_service_module.AiService()
    state = {"cancelled": False}

    async def fake_create(**kwargs):
        state["cancelled"] = True
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content='{"results":[{"index":0,"is_false_positive":false,"explanation":"ok","confidence":0.8}]}'
                    )
                )
            ]
        )

    monkeypatch.setattr(
        ai_service_module.JobManager,
        "get_active_job_id",
        lambda: "job-finished-request",
    )
    monkeypatch.setattr(
        ai_service_module.JobManager,
        "is_cancel_requested",
        lambda job_id: state["cancelled"],
    )
    monkeypatch.setattr(ai_service_module.AuditState, "is_cancelled", False)
    service.client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=fake_create),
        )
    )

    result = asyncio.run(
        service._call_llm_json(
            "prompt",
            "system",
            ai_service_module.ValidationResponse,
        )
    )

    assert result is None
