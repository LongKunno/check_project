import pytest

from fastapi import HTTPException

from src.api.routers import rules as rules_router_module
from src.api.routers.rules import SaveRulesRequest


def test_save_rules_request_custom_weights_are_not_shared_between_instances():
    first = SaveRulesRequest(target="repo-1")
    second = SaveRulesRequest(target="repo-2")

    first.custom_weights["HIGH_COMPLEXITY"] = -3.0

    assert second.custom_weights == {}


@pytest.mark.anyio
async def test_save_rules_returns_503_when_persistence_is_unavailable(monkeypatch):
    monkeypatch.setattr(
        rules_router_module.AuditDatabase,
        "save_project_rules",
        staticmethod(
            lambda **_kwargs: (_ for _ in ()).throw(
                RuntimeError("Database-backed persistence is unavailable.")
            )
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        await rules_router_module.save_rules(SaveRulesRequest(target="repo-1"))

    assert exc_info.value.status_code == 503
