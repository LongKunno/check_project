import importlib

import pytest
from fastapi import HTTPException


@pytest.fixture
def auth_module():
    import src.api.routers.auth as auth_router_module

    return importlib.reload(auth_router_module)


def test_create_jwt_token_requires_configured_secret(monkeypatch, auth_module):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        auth_module.create_jwt_token("dev@example.com", "Dev", "")


def test_decode_authorization_header_returns_500_when_secret_missing(
    monkeypatch, auth_module
):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        auth_module.decode_authorization_header("Bearer test-token")

    assert exc_info.value.status_code == 500
    assert "JWT_SECRET_KEY" in str(exc_info.value.detail)
