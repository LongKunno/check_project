import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def ai_client(monkeypatch):
    import src.config
    import src.engine.database as database_module
    import src.api.routers.audit as audit_router_module

    monkeypatch.setattr(src.config, "get_auth_required", lambda: False)
    monkeypatch.setattr(
        database_module.AuditDatabase,
        "initialize",
        staticmethod(lambda: None),
    )

    async def fake_recover():
        return None

    monkeypatch.setattr(audit_router_module, "recover_persisted_batch_jobs", fake_recover)

    import src.api.api_server as api_server_module

    importlib.reload(api_server_module)

    with TestClient(api_server_module.app) as client:
        yield client


def test_ai_overview_endpoint(ai_client, monkeypatch):
    import src.api.routers.ai as ai_router_module

    monkeypatch.setattr(
        ai_router_module.ai_telemetry,
        "get_overview",
        lambda **kwargs: {"spend_today_usd": 1.25, "total_requests": 4},
    )

    response = ai_client.get("/ai/overview")

    assert response.status_code == 200
    assert response.json()["data"]["spend_today_usd"] == 1.25
    assert response.json()["data"]["total_requests"] == 4


def test_ai_requests_endpoint_returns_paginated_payload(ai_client, monkeypatch):
    import src.api.routers.ai as ai_router_module

    captured = {}

    monkeypatch.setattr(
        ai_router_module.ai_telemetry,
        "list_requests",
        lambda **kwargs: (
            captured.update(kwargs)
            or {
                "items": [{"request_id": "req-1", "source": "audit.validation"}],
                "total": 1,
                "page": kwargs["page"],
                "page_size": kwargs["page_size"],
            }
        ),
    )

    response = ai_client.get(
        "/ai/requests?page=2&page_size=10&project=demo&date_from=2026-04-01&date_to=2026-04-21&source=audit.validation&status=completed&provider=openai&model=gpt-5.4&mode=realtime"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["request_id"] == "req-1"
    assert payload["page"] == 2
    assert payload["page_size"] == 10
    assert captured["date_from"] == "2026-04-01"
    assert captured["date_to"] == "2026-04-21"
    assert captured["project"] == "demo"
    assert captured["source"] == "audit.validation"
    assert captured["status"] == "completed"
    assert captured["provider"] == "openai"
    assert captured["model"] == "gpt-5.4"
    assert captured["mode"] == "realtime"


def test_ai_pricing_update_endpoint(ai_client, monkeypatch):
    import src.api.routers.ai as ai_router_module

    monkeypatch.setattr(
        ai_router_module.ai_telemetry,
        "save_pricing_catalog",
        lambda items: items,
    )

    response = ai_client.put(
        "/ai/pricing",
        json={
            "items": [
                {
                    "provider": "proxy",
                    "mode": "realtime",
                    "model": "gpt-test",
                    "input_cost_per_million": 1,
                    "output_cost_per_million": 2,
                    "cached_input_cost_per_million": 0.5,
                    "currency": "USD",
                    "is_active": True,
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["data"][0]["model"] == "gpt-test"


def test_ai_pricing_update_endpoint_returns_400_on_invalid_row(ai_client, monkeypatch):
    import src.api.routers.ai as ai_router_module

    def fail(_items):
        raise ValueError("Pricing rows must include non-empty provider, mode, and model.")

    monkeypatch.setattr(
        ai_router_module.ai_telemetry,
        "save_pricing_catalog",
        fail,
    )

    response = ai_client.put("/ai/pricing", json={"items": []})

    assert response.status_code == 400


def test_ai_budget_update_endpoint(ai_client, monkeypatch):
    import src.api.routers.ai as ai_router_module

    monkeypatch.setattr(
        ai_router_module.ai_telemetry,
        "save_budget_policy",
        lambda payload: {
            "daily_budget_usd": payload["daily_budget_usd"],
            "monthly_budget_usd": payload["monthly_budget_usd"],
            "hard_stop_enabled": payload["hard_stop_enabled"],
            "retention_days": payload["retention_days"],
            "raw_payload_retention_enabled": payload["raw_payload_retention_enabled"],
        },
    )
    monkeypatch.setattr(
        ai_router_module.ai_telemetry,
        "get_budget_usage",
        lambda: {"today_spend": 0.2, "month_spend": 1.4},
    )

    response = ai_client.put(
        "/ai/budget",
        json={
            "daily_budget_usd": 4,
            "monthly_budget_usd": 40,
            "hard_stop_enabled": True,
            "retention_days": 14,
            "raw_payload_retention_enabled": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["daily_budget_usd"] == 4
    assert payload["today_spend"] == 0.2
