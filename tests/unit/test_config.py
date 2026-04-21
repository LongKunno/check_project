import importlib

import pytest

import src.config as config_module
from src.engine.database import AuditDatabase


def _reload_config():
    return importlib.reload(config_module)


@pytest.fixture(autouse=True)
def restore_config_module():
    yield
    _reload_config()


def test_ai_max_concurrency_defaults_to_5_when_env_missing(monkeypatch):
    monkeypatch.delenv("AI_MAX_CONCURRENCY", raising=False)
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(lambda key, default=None: None),
    )

    assert config.AI_MAX_CONCURRENCY == 5
    assert config.get_ai_max_concurrency() == 5


def test_ai_mode_defaults_to_realtime_when_env_missing(monkeypatch):
    monkeypatch.delenv("AI_MODE", raising=False)
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(lambda key, default=None: None),
    )

    assert config.AI_MODE == "realtime"
    assert config.get_ai_mode() == "realtime"


def test_ai_mode_prefers_db_override(monkeypatch):
    monkeypatch.setenv("AI_MODE", "realtime")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(
            lambda key, default=None: "openai_batch" if key == "ai_mode" else default
        ),
    )

    assert config.get_ai_mode() == "openai_batch"


def test_openai_batch_model_prefers_db_override(monkeypatch):
    monkeypatch.setenv("OPENAI_BATCH_MODEL", "gpt-4.1-nano")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(
            lambda key, default=None: "gpt-5.4" if key == "openai_batch_model" else default
        ),
    )

    assert config.get_openai_batch_model() == "gpt-5.4"


def test_openai_batch_model_legacy_gpt_5_nano_maps_to_gpt_4_1_nano(monkeypatch):
    monkeypatch.setenv("OPENAI_BATCH_MODEL", "gpt-5-nano")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(lambda key, default=None: None),
    )

    assert config.OPENAI_BATCH_MODEL == "gpt-4.1-nano"
    assert config.get_openai_batch_model() == "gpt-4.1-nano"


def test_ai_max_concurrency_uses_env_when_valid(monkeypatch):
    monkeypatch.setenv("AI_MAX_CONCURRENCY", "12")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(lambda key, default=None: None),
    )

    assert config.AI_MAX_CONCURRENCY == 12
    assert config.get_ai_max_concurrency() == 12


def test_ai_max_concurrency_prefers_db_override(monkeypatch):
    monkeypatch.setenv("AI_MAX_CONCURRENCY", "12")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(
            lambda key, default=None: "17" if key == "ai_max_concurrency" else default
        ),
    )

    assert config.get_ai_max_concurrency() == 17


def test_ai_max_concurrency_falls_back_to_5_when_env_invalid(monkeypatch):
    monkeypatch.setenv("AI_MAX_CONCURRENCY", "101")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(lambda key, default=None: None),
    )

    assert config.AI_MAX_CONCURRENCY == 5
    assert config.get_ai_max_concurrency() == 5


def test_ai_max_concurrency_falls_back_to_5_when_db_invalid(monkeypatch):
    monkeypatch.setenv("AI_MAX_CONCURRENCY", "12")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(
            lambda key, default=None: "0" if key == "ai_max_concurrency" else default
        ),
    )

    assert config.get_ai_max_concurrency() == 5


def test_member_recent_months_defaults_to_3_when_env_missing(monkeypatch):
    monkeypatch.delenv("MEMBER_RECENT_MONTHS", raising=False)
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(lambda key, default=None: None),
    )

    assert config.MEMBER_RECENT_MONTHS == 3
    assert config.get_member_recent_months() == 3


def test_member_recent_months_uses_env_when_valid(monkeypatch):
    monkeypatch.setenv("MEMBER_RECENT_MONTHS", "6")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(lambda key, default=None: None),
    )

    assert config.MEMBER_RECENT_MONTHS == 6
    assert config.get_member_recent_months() == 6


def test_member_recent_months_prefers_db_override(monkeypatch):
    monkeypatch.setenv("MEMBER_RECENT_MONTHS", "6")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(
            lambda key, default=None: "9" if key == "member_recent_months" else default
        ),
    )

    assert config.get_member_recent_months() == 9


def test_member_recent_months_falls_back_to_3_when_db_invalid(monkeypatch):
    monkeypatch.setenv("MEMBER_RECENT_MONTHS", "6")
    config = _reload_config()
    monkeypatch.setattr(
        AuditDatabase,
        "get_config",
        staticmethod(
            lambda key, default=None: "0" if key == "member_recent_months" else default
        ),
    )

    assert config.get_member_recent_months() == 3
