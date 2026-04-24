"""
Integration Tests — API Endpoints (Audit, Repositories, History, Health)
Sử dụng FastAPI TestClient để test API layer.
"""

import io
import os

import pytest
from fastapi import BackgroundTasks, UploadFile
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    """Create a TestClient for the FastAPI app."""
    from src.api.api_server import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def disable_backend_auth(monkeypatch):
    import src.config

    monkeypatch.setattr(src.config, "get_auth_required", lambda: False)


class TestRootEndpoint:
    """GET / — Health check/root endpoint."""

    def test_root_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200, response.text

    def test_root_has_engine_info(self, client):
        response = client.get("/")
        data = response.json()
        assert "engine" in data or "status" in data

    def test_removed_change_review_endpoints_return_404(self, client):
        assert client.get("/change-reviews/inbox").status_code == 404
        assert client.get("/pr-reviews/inbox").status_code == 404


class TestRepositoriesEndpoint:
    """GET /repositories — Danh sách repository."""

    def test_returns_success(self, client):
        response = client.get("/repositories")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["data"], list)

    def test_no_token_exposed(self, client):
        response = client.get("/repositories")
        data = response.json()
        for repo in data["data"]:
            assert "token" not in repo, f"Token leaked in repo: {repo['id']}"
            assert "username" not in repo, f"Username leaked in repo: {repo['id']}"

    def test_repos_have_required_fields(self, client):
        response = client.get("/repositories")
        data = response.json()
        if data["data"]:
            repo = data["data"][0]
            for field in ["id", "name", "url"]:
                assert field in repo, f"Missing field '{field}' in repo response"


class TestRepositoriesScores:
    """GET /repositories/scores — Điểm số repositories."""

    def test_returns_success(self, client):
        response = client.get("/repositories/scores")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["data"], list)

    def test_scores_have_required_fields(self, client):
        response = client.get("/repositories/scores")
        data = response.json()
        if data["data"]:
            repo = data["data"][0]
            for field in [
                "id",
                "name",
                "url",
                "latest_score",
                "regression_status",
                "regression_summary",
                "dependency_health_status",
                "dependency_health_summary",
            ]:
                assert field in repo, f"Missing field '{field}'"

    def test_scores_use_latest_audit_lookup_instead_of_history_loop(self, client, monkeypatch):
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_all_repositories",
            staticmethod(
                lambda include_credentials=False: [
                    {"id": "repo-1", "name": "Repo 1", "url": "https://example.com/repo-1.git"},
                    {"id": "repo-2", "name": "Repo 2", "url": "https://example.com/repo-2.git"},
                ]
            ),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "get_latest_audits_for_targets",
            staticmethod(
                lambda targets, include_full_json=False: {
                    "https://example.com/repo-1.git": {
                        "score": 91.5,
                        "rating": "A",
                        "timestamp": "2026-04-21T10:00:00",
                        "violations_count": 2,
                        "pillar_scores": {"Security": 9.0},
                        "regression_status": "warning",
                        "regression_summary": {
                            "score_delta": -3.5,
                            "triggered_signals": ["score_drop"],
                        },
                        "dependency_health_status": "warning",
                        "dependency_health_summary": {
                            "near_eol_count": 1,
                            "triggered_signals": ["near_eol"],
                        },
                    }
                }
            ),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "get_history",
            staticmethod(lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("legacy history path should not be used"))),
        )

        response = client.get("/repositories/scores")

        assert response.status_code == 200, response.text
        payload = response.json()["data"]
        assert payload[0]["latest_score"] == 91.5
        assert payload[0]["violations_count"] == 2
        assert payload[0]["regression_status"] == "warning"
        assert payload[0]["dependency_health_status"] == "warning"
        assert payload[1]["latest_score"] is None


class TestEngineSettings:
    """PUT /settings/engine — lỗi rõ ràng khi persistence unavailable."""

    def test_update_returns_503_when_database_persistence_is_unavailable(
        self, client, monkeypatch
    ):
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "set_config",
            staticmethod(
                lambda *_args, **_kwargs: (_ for _ in ()).throw(
                    RuntimeError(
                        "Database-backed persistence is unavailable because DATABASE_URL is not configured or Postgres could not be reached."
                    )
                )
            ),
        )

        response = client.put(
            "/settings/engine",
            json={"ai_enabled": True},
        )

        assert response.status_code == 503, response.text
        assert "Database-backed persistence is unavailable" in response.json()["detail"]


class TestMembersScores:
    """GET /members/scores — bảng xếp hạng thành viên."""

    def test_members_scores_uses_active_repositories_and_latest_audit_lookup(
        self, client, monkeypatch
    ):
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_all_repositories",
            staticmethod(
                lambda include_credentials=False: [
                    {"id": "repo-1", "name": "Repo 1", "url": "https://example.com/repo-1.git"},
                    {"id": "repo-2", "name": "Repo 2", "url": "https://example.com/repo-2.git"},
                ]
            ),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "get_latest_audits_for_targets",
            staticmethod(
                lambda targets, include_full_json=False: {
                    "https://example.com/repo-1.git": {
                        "full_json": {
                            "scores": {
                                "members": {
                                    "dev@example.com": {
                                        "email": "dev@example.com",
                                        "author_name": "Dev One",
                                        "loc": 120,
                                        "debt_mins": 30,
                                        "pillars": {
                                            "Performance": 9.0,
                                            "Maintainability": 8.0,
                                            "Reliability": 8.5,
                                            "Security": 9.5,
                                        },
                                        "final": 88.0,
                                    }
                                }
                            }
                        }
                    },
                    "https://example.com/repo-2.git": {
                        "full_json": {
                            "scores": {
                                "members": {
                                    "dev@example.com": {
                                        "email": "dev@example.com",
                                        "author_name": "Dev One",
                                        "loc": 80,
                                        "debt_mins": 15,
                                        "pillars": {
                                            "Performance": 8.0,
                                            "Maintainability": 9.0,
                                            "Reliability": 8.5,
                                            "Security": 9.0,
                                        },
                                        "final": 87.0,
                                    }
                                }
                            }
                        }
                    },
                }
            ),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "get_history",
            staticmethod(lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("legacy history path should not be used"))),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "get_audit_by_id",
            staticmethod(lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("legacy audit detail path should not be used"))),
        )

        response = client.get("/members/scores")

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["status"] == "success"
        assert payload["total_members"] == 1
        member = payload["data"][0]
        assert member["email"] == "dev@example.com"
        assert member["projects_count"] == 2
        assert member["total_loc"] == 200


class TestHistoryEndpoint:
    """GET /history — Lịch sử audit."""

    def test_returns_list(self, client):
        response = client.get("/history")
        assert response.status_code == 200, response.text
        data = response.json()
        assert isinstance(data, list)


class TestTrendsEndpoints:
    """GET /trends/* — Portfolio và repository trends."""

    def test_portfolio_trends_returns_enriched_top_regressing_repos(
        self, client, monkeypatch
    ):
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_all_repositories",
            staticmethod(
                lambda include_credentials=False: [
                    {
                        "id": "repo-1",
                        "name": "Repo 1",
                        "url": "https://example.com/repo-1.git",
                    }
                ]
            ),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "get_portfolio_trends",
            staticmethod(
                lambda days=30: {
                    "range_days": days,
                    "summary": {
                        "scanned_repos": 1,
                        "avg_latest_score": 88.4,
                        "regressing_repos": 1,
                        "scans_in_range": 3,
                    },
                    "score_series": [{"date": "2026-04-23", "avg_score": 88.4}],
                    "scan_volume_series": [{"date": "2026-04-23", "scans": 3}],
                    "regression_series": [{"date": "2026-04-23", "warnings": 1}],
                    "latest_portfolio_pillars": {"Security": 8.2},
                    "top_regressing_repos": [
                        {
                            "id": 42,
                            "target": "https://example.com/repo-1.git",
                            "score": 88.4,
                            "regression_status": "warning",
                            "regression_summary": {
                                "triggered_signals": ["score_drop"],
                            },
                        }
                    ],
                }
            ),
        )

        response = client.get("/trends/portfolio?days=30")

        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["summary"]["regressing_repos"] == 1
        assert data["top_regressing_repos"][0]["repo_name"] == "Repo 1"

    def test_repository_trends_requires_target(self, client):
        response = client.get("/trends/repository?days=30")
        assert response.status_code == 400, response.text

    def test_repository_trends_returns_payload(self, client, monkeypatch):
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_all_repositories",
            staticmethod(
                lambda include_credentials=False: [
                    {
                        "id": "repo-1",
                        "name": "Repo 1",
                        "url": "https://example.com/repo-1.git",
                    }
                ]
            ),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "get_repository_trends",
            staticmethod(
                lambda target, days=30: {
                    "target": target,
                    "range_days": days,
                    "summary": {
                        "total_scans": 2,
                        "latest_score": 88.4,
                        "latest_rating": "B",
                        "latest_timestamp": "2026-04-23T10:00:00",
                        "warnings_count": 1,
                    },
                    "audit_points": [
                        {
                            "id": 7,
                            "timestamp": "2026-04-23T10:00:00",
                            "score": 88.4,
                            "violations_count": 4,
                            "regression_status": "warning",
                            "regression_summary": {"score_delta": -2.6},
                        }
                    ],
                    "score_series": [{"timestamp": "2026-04-23T10:00:00", "score": 88.4}],
                    "violations_series": [
                        {"timestamp": "2026-04-23T10:00:00", "violations_count": 4}
                    ],
                    "pillar_series": [
                        {
                            "timestamp": "2026-04-23T10:00:00",
                            "Security": 8.4,
                            "Maintainability": 8.0,
                        }
                    ],
                    "regression_events": [
                        {
                            "id": 7,
                            "timestamp": "2026-04-23T10:00:00",
                            "regression_status": "warning",
                            "regression_summary": {"score_delta": -2.6},
                        }
                    ],
                }
            ),
        )

        response = client.get(
            "/trends/repository?target=https%3A%2F%2Fexample.com%2Frepo-1.git&days=30"
        )

        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["repo_name"] == "Repo 1"
        assert data["summary"]["warnings_count"] == 1


class TestDependencyHealthEndpoints:
    """GET /dependencies/* — overview và repository drill-down."""

    def test_dependency_overview_returns_payload(self, client, monkeypatch):
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_dependency_health_overview",
            staticmethod(
                lambda: {
                    "summary": {
                        "configured_repos": 2,
                        "scanned_repos": 2,
                        "warning_repos": 1,
                        "pass_repos": 1,
                        "unavailable_repos": 0,
                        "manifests_scanned": ["requirements.txt", "package-lock.json"],
                        "dependencies_total": 12,
                        "critical_advisories": 0,
                        "high_advisories": 1,
                        "deprecated_count": 1,
                        "near_eol_count": 2,
                        "eol_count": 0,
                        "unknown_eol_count": 5,
                        "mutable_base_image_count": 1,
                        "hygiene_warning_count": 2,
                        "triggered_signals": ["near_eol"],
                    },
                    "repositories": [
                        {
                            "id": "repo-1",
                            "name": "Repo 1",
                            "url": "https://example.com/repo-1.git",
                            "dependency_health_status": "warning",
                            "dependency_health_summary": {"near_eol_count": 2},
                        }
                    ],
                }
            ),
        )

        response = client.get("/dependencies/overview")

        assert response.status_code == 200, response.text
        payload = response.json()["data"]
        assert payload["summary"]["warning_repos"] == 1
        assert payload["repositories"][0]["dependency_health_status"] == "warning"

    def test_dependency_repository_requires_target(self, client):
        response = client.get("/dependencies/repository")
        assert response.status_code == 400, response.text

    def test_dependency_repository_returns_payload(self, client, monkeypatch):
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_repository_dependency_health",
            staticmethod(
                lambda target: {
                    "target": target,
                    "repo_id": "repo-1",
                    "repo_name": "Repo 1",
                    "latest_audit": {
                        "id": 99,
                        "timestamp": "2026-04-24T02:00:00",
                        "dependency_health_status": "warning",
                        "dependency_health_summary": {"near_eol_count": 1},
                    },
                    "dependency_health": {
                        "status": "warning",
                        "summary": {
                            "manifests_scanned": ["requirements.txt"],
                            "dependencies_total": 3,
                            "critical_advisories": 0,
                            "high_advisories": 1,
                            "deprecated_count": 0,
                            "near_eol_count": 1,
                            "eol_count": 0,
                            "unknown_eol_count": 1,
                            "mutable_base_image_count": 0,
                            "hygiene_warning_count": 0,
                            "triggered_signals": ["near_eol"],
                        },
                        "items": [
                            {
                                "ecosystem": "python",
                                "name": "requests",
                                "status": "warning",
                            }
                        ],
                        "manifests": [{"path": "requirements.txt"}],
                    },
                    "recent_audits": [
                        {
                            "id": 99,
                            "dependency_health_status": "warning",
                            "dependency_health_summary": {"near_eol_count": 1},
                        }
                    ],
                }
            ),
        )

        response = client.get(
            "/dependencies/repository?target=https%3A%2F%2Fexample.com%2Frepo-1.git"
        )

        assert response.status_code == 200, response.text
        payload = response.json()["data"]
        assert payload["repo_name"] == "Repo 1"
        assert payload["dependency_health"]["status"] == "warning"
        assert payload["recent_audits"][0]["dependency_health_status"] == "warning"


class TestAuditStatus:
    """GET /audit/status — Trạng thái audit."""

    def test_returns_status(self, client):
        response = client.get("/audit/status")
        assert response.status_code == 200, response.text
        data = response.json()
        assert "is_running" in data


class TestHealthAI:
    """GET /health/ai — AI health check."""

    def test_returns_status_field(self, client, monkeypatch):
        import src.config
        import src.engine.ai_service as ai_service_module

        monkeypatch.setattr(src.config, "get_ai_enabled", lambda: True)
        monkeypatch.setattr(src.config, "get_ai_mode", lambda: "realtime")

        async def fake_check_realtime_health():
            return {
                "status": "healthy",
                "mode": "realtime",
                "provider": "proxy",
                "model": "test-model",
            }

        monkeypatch.setattr(
            ai_service_module.ai_service,
            "check_realtime_health",
            fake_check_realtime_health,
        )

        response = client.get("/health/ai")
        assert response.status_code == 200, response.text
        data = response.json()
        assert "status" in data
        assert data["status"] in ["healthy", "unhealthy", "disabled"]


class TestEngineSettings:
    """GET/PUT /settings/engine — runtime engine settings."""

    def test_get_engine_settings_returns_ai_max_concurrency(self, client, monkeypatch):
        import src.config
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(src.config, "AI_MAX_CONCURRENCY", 5)
        monkeypatch.setattr(src.config, "AI_MODE", "realtime")
        monkeypatch.setattr(src.config, "OPENAI_BATCH_MODEL", "gpt-4.1-nano")
        monkeypatch.setattr(src.config, "MEMBER_RECENT_MONTHS", 3)
        monkeypatch.setattr(src.config, "REGRESSION_GATE_ENABLED", True)
        monkeypatch.setattr(src.config, "REGRESSION_SCORE_DROP_THRESHOLD", 2.0)
        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: None),
        )

        response = client.get("/settings/engine")

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["ai_max_concurrency"] == 5
        assert data["data"]["ai_mode"] == "realtime"
        assert data["data"]["openai_batch_model"] == "gpt-4.1-nano"
        assert data["data"]["member_recent_months"] == 3
        assert data["data"]["regression_gate_enabled"] is True
        assert data["data"]["regression_score_drop_threshold"] == 2.0
        assert data["data"]["dependency_health_enabled"] is True
        assert data["data"]["dependency_eol_warning_days"] == 180

    def test_put_engine_settings_updates_regression_thresholds(self, client, monkeypatch):
        store = {}
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: store.get(key, default)),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "set_config",
            staticmethod(lambda key, value: store.__setitem__(key, value)),
        )

        response = client.put(
            "/settings/engine",
            json={
                "regression_gate_enabled": False,
                "regression_score_drop_threshold": 3.5,
                "regression_violations_increase_threshold": 8,
                "regression_pillar_drop_threshold": 0.9,
                "regression_new_critical_threshold": 2,
                "dependency_health_enabled": False,
                "dependency_eol_warning_days": 365,
            },
        )

        assert response.status_code == 200, response.text
        assert store["regression_gate_enabled"] == "false"
        assert store["regression_score_drop_threshold"] == "3.5"
        assert store["regression_violations_increase_threshold"] == "8"
        assert store["regression_pillar_drop_threshold"] == "0.9"
        assert store["regression_new_critical_threshold"] == "2"
        assert store["dependency_health_enabled"] == "false"
        assert store["dependency_eol_warning_days"] == "365"

    def test_put_engine_settings_updates_ai_mode_and_batch_model(self, client, monkeypatch):
        store = {}
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: store.get(key, default)),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "set_config",
            staticmethod(lambda key, value: store.__setitem__(key, value)),
        )

        response = client.put(
            "/settings/engine",
            json={"ai_mode": "openai_batch", "openai_batch_model": "gpt-5.4"},
        )

        assert response.status_code == 200, response.text
        assert store["ai_mode"] == "openai_batch"
        assert store["openai_batch_model"] == "gpt-5.4"
        assert response.json()["data"]["ai_mode"] == "openai_batch"
        assert response.json()["data"]["openai_batch_model"] == "gpt-5.4"

    def test_put_engine_settings_normalizes_legacy_gpt_5_nano_batch_model(
        self, client, monkeypatch
    ):
        store = {}
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: store.get(key, default)),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "set_config",
            staticmethod(lambda key, value: store.__setitem__(key, value)),
        )

        response = client.put(
            "/settings/engine",
            json={"openai_batch_model": "gpt-5-nano"},
        )

        assert response.status_code == 200, response.text
        assert store["openai_batch_model"] == "gpt-4.1-nano"
        assert response.json()["data"]["openai_batch_model"] == "gpt-4.1-nano"

    def test_put_engine_settings_encrypts_batch_api_key(self, client, monkeypatch):
        store = {}
        from src.engine.database import AuditDatabase

        monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", "test-settings-secret")

        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: store.get(key, default)),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "set_config",
            staticmethod(lambda key, value: store.__setitem__(key, value)),
        )

        response = client.put(
            "/settings/engine",
            json={"openai_batch_api_key": "sk-test"},
        )

        assert response.status_code == 200, response.text
        assert store["openai_batch_api_key_encrypted"]
        assert store["openai_batch_api_key_encrypted"] != "sk-test"
        assert response.json()["data"]["openai_batch_api_key_configured"] is True

    def test_health_ai_uses_batch_health_when_batch_mode_enabled(self, client, monkeypatch):
        import src.config
        import src.engine.ai_service as ai_service_module

        monkeypatch.setattr(src.config, "get_ai_enabled", lambda: True)
        monkeypatch.setattr(src.config, "get_ai_mode", lambda: "openai_batch")

        async def fake_check_openai_batch_health():
            return {
                "status": "healthy",
                "mode": "openai_batch",
                "provider": "openai",
                "model": "gpt-5.4-mini",
            }

        monkeypatch.setattr(
            ai_service_module.ai_service,
            "check_openai_batch_health",
            fake_check_openai_batch_health,
        )

        response = client.get("/health/ai")

        assert response.status_code == 200, response.text
        assert response.json()["mode"] == "openai_batch"

    def test_health_ai_returns_disabled_when_ai_off(self, client, monkeypatch):
        import src.config

        monkeypatch.setattr(src.config, "get_ai_enabled", lambda: False)

        response = client.get("/health/ai")

        assert response.status_code == 200
        assert response.json()["status"] == "disabled"

    def test_put_engine_settings_updates_ai_max_concurrency(self, client, monkeypatch):
        store = {}
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: store.get(key, default)),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "set_config",
            staticmethod(lambda key, value: store.__setitem__(key, value)),
        )

        response = client.put("/settings/engine", json={"ai_max_concurrency": 8})

        assert response.status_code == 200
        assert store["ai_max_concurrency"] == "8"
        assert response.json()["data"]["ai_max_concurrency"] == 8

    def test_put_engine_settings_updates_member_recent_months(self, client, monkeypatch):
        store = {}
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: store.get(key, default)),
        )
        monkeypatch.setattr(
            AuditDatabase,
            "set_config",
            staticmethod(lambda key, value: store.__setitem__(key, value)),
        )

        response = client.put("/settings/engine", json={"member_recent_months": 6})

        assert response.status_code == 200
        assert store["member_recent_months"] == "6"
        assert response.json()["data"]["member_recent_months"] == 6

    @pytest.mark.parametrize("value", [0, 101])
    def test_put_engine_settings_rejects_invalid_ai_max_concurrency(
        self, client, value
    ):
        response = client.put("/settings/engine", json={"ai_max_concurrency": value})

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "ai_max_concurrency phải nằm trong khoảng 1..100"
        )

    @pytest.mark.parametrize("value", [0, 25])
    def test_put_engine_settings_rejects_invalid_member_recent_months(
        self, client, value
    ):
        response = client.put("/settings/engine", json={"member_recent_months": value})

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "member_recent_months phải nằm trong khoảng 1..24"
        )


class TestRepositoryCRUD:
    """POST/PUT/DELETE /repositories — CRUD operations."""

    def test_create_repository(self, client):
        response = client.post("/repositories", json={
            "id": "test-repo-crud",
            "name": "Test CRUD Repo",
            "url": "https://github.com/test/repo.git",
            "username": "",
            "token": "",
            "branch": "main",
        })
        assert response.status_code == 200
        assert response.json()["status"] == "success"

    def test_created_repo_appears_in_list(self, client):
        response = client.get("/repositories")
        data = response.json()
        ids = [r["id"] for r in data["data"]]
        assert "test-repo-crud" in ids

    def test_delete_repository(self, client):
        response = client.delete("/repositories/test-repo-crud")
        assert response.status_code == 200
        assert response.json()["status"] == "success"

    def test_deleted_repo_not_in_list(self, client):
        response = client.get("/repositories")
        data = response.json()
        ids = [r["id"] for r in data["data"]]
        assert "test-repo-crud" not in ids

    def test_delete_nonexistent_returns_404(self, client):
        response = client.delete("/repositories/nonexistent-repo-id")
        assert response.status_code == 404

    def test_update_repository_rejects_mismatched_body_id(self, client):
        create_response = client.post("/repositories", json={
            "id": "test-repo-update-source",
            "name": "Test Update Source",
            "url": "https://github.com/test/source.git",
            "username": "",
            "token": "",
            "branch": "main",
        })
        assert create_response.status_code == 200

        response = client.put("/repositories/test-repo-update-source", json={
            "id": "test-repo-update-target",
            "name": "Test Update Target",
            "url": "https://github.com/test/target.git",
            "username": "",
            "token": "",
            "branch": "develop",
        })
        assert response.status_code == 400
        assert response.json()["detail"] == "ID trong body phải khớp với repo_id trên URL."

        repos = client.get("/repositories").json()["data"]
        ids = [repo["id"] for repo in repos]
        assert "test-repo-update-source" in ids
        assert "test-repo-update-target" not in ids

        cleanup_response = client.delete("/repositories/test-repo-update-source")
        assert cleanup_response.status_code == 200


class TestAuditEndpoints:
    """Audit trigger endpoints — validation tests."""

    def test_audit_missing_url_returns_400(self, client):
        response = client.post("/audit/repository", json={})
        assert response.status_code == 400

    def test_audit_invalid_id_returns_400(self, client):
        response = client.post("/audit/repository", json={"id": "nonexistent-project"})
        assert response.status_code == 400

    def test_batch_empty_ids_returns_400(self, client):
        response = client.post("/audit/batch", json={"project_ids": []})
        assert response.status_code == 400

    def test_job_not_found_returns_404(self, client):
        response = client.get("/audit/jobs/nonexistent-job-id")
        assert response.status_code == 404

    def test_job_status_returns_structured_progress(self, client):
        from src.api.audit_state import JobManager

        JobManager.jobs.clear()
        JobManager.job_logs.clear()

        job_id = JobManager.create_job("progress-demo")
        JobManager.update_job(job_id, "RUNNING", "Đang phân tích tĩnh và áp dụng AI...")
        JobManager.start_progress_phase(
            job_id,
            "validation",
            "Validation",
            total_batches=3,
            batch_size=5,
            last_detail="Preparing validation batches...",
        )
        JobManager.record_batch_started(
            job_id,
            2,
            last_detail="Starting Validation batch 2/3",
        )

        response = client.get(f"/audit/jobs/{job_id}")

        assert response.status_code == 200
        progress = response.json()["progress"]
        assert progress["phase"] == "validation"
        assert progress["phase_label"] == "Validation"
        assert progress["total_batches"] == 3
        assert progress["batch_size"] == 5
        assert progress["last_started_batch"] == 2
        assert progress["completed_batches"] == 0
        assert progress["active_batches"] == 1
        assert progress["pending_batches"] == 2

        JobManager.start_progress_phase(
            job_id,
            "deep_audit",
            "Deep Audit",
            total_batches=2,
            batch_size=5,
            last_detail="Preparing deep audit batches...",
        )
        JobManager.record_batch_started(
            job_id,
            1,
            last_detail="Starting Deep Audit batch 1/2",
        )

        response = client.get(f"/audit/jobs/{job_id}")

        assert response.status_code == 200
        progress = response.json()["progress"]
        assert progress["phase"] == "deep_audit"
        assert progress["phase_label"] == "Deep Audit"
        assert progress["total_batches"] == 2
        assert progress["last_started_batch"] == 1

    def test_upload_process_keeps_temp_dir_until_background_task_finishes(self, client, monkeypatch):
        from src.api.audit_state import JobManager
        from src.api.routers import audit as audit_router_module
        import asyncio

        observed = {}

        def fake_run_auditor_with_capture(
            target_path,
            target_id=None,
            job_id=None,
            workspace_path=None,
            use_cache=None,
        ):
            observed["target_path"] = target_path
            observed["job_id"] = job_id
            observed["exists_during_run"] = os.path.exists(target_path)
            observed["use_cache"] = use_cache
            return object()

        def fake_build_and_save_audit_result(auditor, target_str, project_name):
            return {
                "status": "success",
                "target": target_str,
                "project_name": project_name,
            }

        JobManager.jobs.clear()
        JobManager.job_logs.clear()
        monkeypatch.setattr(
            audit_router_module,
            "run_auditor_with_capture",
            fake_run_auditor_with_capture,
        )
        monkeypatch.setattr(
            audit_router_module,
            "_build_and_save_audit_result",
            fake_build_and_save_audit_result,
        )
        monkeypatch.setattr(audit_router_module, "_is_openai_batch_mode", lambda: False)

        upload = UploadFile(filename="demo.py", file=io.BytesIO(b"print('ok')\n"))
        background_tasks = BackgroundTasks()
        response = asyncio.run(
            audit_router_module.upload_and_audit(
                background_tasks,
                files=[upload],
                use_cache=False,
            )
        )
        for task in background_tasks.tasks:
            task.func(*task.args, **task.kwargs)

        job_id = response["job_id"]
        job = JobManager.get_job(job_id)

        assert observed["job_id"] == job_id
        assert observed["exists_during_run"] is True
        assert observed["use_cache"] is False
        assert job.status == "COMPLETED"
        assert job.result["status"] == "success"
        assert not os.path.exists(observed["target_path"])

    def test_repository_audit_passes_use_cache_to_background_runner(self, client, monkeypatch):
        from src.api.audit_state import JobManager
        from src.api.routers import audit as audit_router_module
        import asyncio

        observed = {}

        def fake_clone_repository(repo_url, dest_dir, username=None, token=None, branch=None):
            os.makedirs(dest_dir, exist_ok=True)
            with open(os.path.join(dest_dir, "demo.py"), "w", encoding="utf-8") as f:
                f.write("print('ok')\n")

        def fake_run_auditor_with_capture(
            target_path,
            target_id=None,
            job_id=None,
            workspace_path=None,
            use_cache=None,
        ):
            observed["target_path"] = target_path
            observed["job_id"] = job_id
            observed["use_cache"] = use_cache
            return object()

        def fake_build_and_save_audit_result(auditor, target_str, project_name):
            return {
                "status": "success",
                "target": target_str,
                "project_name": project_name,
            }

        JobManager.jobs.clear()
        JobManager.job_logs.clear()
        monkeypatch.setattr(
            audit_router_module.GitHelper,
            "clone_repository",
            fake_clone_repository,
        )
        monkeypatch.setattr(
            audit_router_module,
            "run_auditor_with_capture",
            fake_run_auditor_with_capture,
        )
        monkeypatch.setattr(
            audit_router_module,
            "_build_and_save_audit_result",
            fake_build_and_save_audit_result,
        )
        monkeypatch.setattr(audit_router_module, "_is_openai_batch_mode", lambda: False)

        background_tasks = BackgroundTasks()
        response = asyncio.run(
            audit_router_module.audit_repository(
                audit_router_module.RepositoryAuditRequest(
                    repo_url="https://example.com/demo.git",
                    use_cache=False,
                ),
                background_tasks,
            )
        )
        for task in background_tasks.tasks:
            task.func(*task.args, **task.kwargs)

        job = JobManager.get_job(response["job_id"])

        assert job is not None
        assert job.orchestration_state["use_cache"] is False
        assert observed["job_id"] == response["job_id"]
        assert observed["use_cache"] is False

    def test_batch_audit_stores_use_cache_in_job_state(self, client, monkeypatch):
        from src.api.audit_state import JobManager
        from src.api.routers import audit as audit_router_module
        import asyncio

        JobManager.jobs.clear()
        JobManager.job_logs.clear()
        monkeypatch.setattr(audit_router_module, "_is_openai_batch_mode", lambda: True)

        background_tasks = BackgroundTasks()
        response = asyncio.run(
            audit_router_module.audit_batch(
                audit_router_module.BatchAuditRequest(
                    project_ids=["demo-project"],
                    use_cache=False,
                ),
                background_tasks,
            )
        )

        job = JobManager.get_job(response["job_id"])

        assert job is not None
        assert job.orchestration_state["use_cache"] is False
        assert response["status"] == "started"

    def test_cancel_job_endpoint_marks_job_cancel_requested(self, client):
        from src.api.audit_state import JobManager

        JobManager.jobs.clear()
        JobManager.job_logs.clear()
        job_id = JobManager.create_job("cancel-me")
        JobManager.update_job(job_id, "RUNNING", "Running")

        response = client.post(f"/audit/jobs/{job_id}/cancel")

        assert response.status_code == 200
        job = JobManager.get_job(job_id)
        assert job is not None
        assert job.status == "RUNNING"
        assert job.cancel_requested is True

    def test_cancel_audit_endpoint_does_not_flip_legacy_global_cancel_flag(
        self, client
    ):
        from src.api.audit_state import AuditState, JobManager

        JobManager.jobs.clear()
        JobManager.job_logs.clear()
        AuditState.is_cancelled = False

        job_id = JobManager.create_job("cancel-all")
        JobManager.update_job(job_id, "RUNNING", "Running")

        response = client.post("/audit/cancel")

        assert response.status_code == 200
        assert AuditState.is_cancelled is False
        assert JobManager.get_job(job_id).cancel_requested is True

    def test_upload_process_cancelled_job_does_not_save_result(self, client, monkeypatch):
        from src.api.audit_state import JobManager
        from src.api.routers import audit as audit_router_module
        import asyncio

        observed = {"build_called": False}

        def fake_run_auditor_with_capture(
            target_path,
            target_id=None,
            job_id=None,
            workspace_path=None,
            use_cache=None,
        ):
            JobManager.request_cancel(job_id, "Cancel requested during test.")
            return object()

        def fake_build_and_save_audit_result(auditor, target_str, project_name):
            observed["build_called"] = True
            return {
                "status": "success",
                "target": target_str,
                "project_name": project_name,
            }

        JobManager.jobs.clear()
        JobManager.job_logs.clear()
        monkeypatch.setattr(
            audit_router_module,
            "run_auditor_with_capture",
            fake_run_auditor_with_capture,
        )
        monkeypatch.setattr(
            audit_router_module,
            "_build_and_save_audit_result",
            fake_build_and_save_audit_result,
        )
        monkeypatch.setattr(audit_router_module, "_is_openai_batch_mode", lambda: False)

        upload = UploadFile(filename="demo.py", file=io.BytesIO(b"print('ok')\n"))
        background_tasks = BackgroundTasks()
        response = asyncio.run(
            audit_router_module.upload_and_audit(background_tasks, files=[upload])
        )
        for task in background_tasks.tasks:
            task.func(*task.args, **task.kwargs)

        job = JobManager.get_job(response["job_id"])

        assert job is not None
        assert job.status == "CANCELLED"
        assert observed["build_called"] is False
        assert job.result is None

    def test_legacy_audit_rejects_path_outside_workspace_with_commonpath(
        self, client
    ):
        response = client.get("/audit", params={"target": ".."})

        assert response.status_code == 403
        assert "không gian ứng dụng" in response.json()["detail"]


class TestAuthEndpoints:
    """Authentication and validation behavior."""

    def test_google_login_invalid_body_returns_422(self, client):
        response = client.post("/auth/google", json={})

        assert response.status_code == 422
        assert isinstance(response.json()["detail"], list)

    def test_protected_endpoint_requires_token_when_auth_enabled(self, client, monkeypatch):
        import src.config

        monkeypatch.setattr(src.config, "get_auth_required", lambda: True)

        response = client.get("/repositories")

        assert response.status_code == 401
        assert response.json()["detail"] == "Missing or invalid Authorization header."

    def test_protected_endpoint_accepts_valid_token_when_auth_enabled(self, client, monkeypatch):
        import src.config
        from src.api.routers import auth as auth_router_module

        monkeypatch.setattr(src.config, "get_auth_required", lambda: True)
        monkeypatch.setattr(
            auth_router_module,
            "verify_jwt_token",
            lambda token: {
                "email": "review@example.com",
                "name": "Review User",
                "picture": "",
            },
        )

        response = client.get(
            "/repositories",
            headers={"Authorization": "Bearer valid-token"},
        )

        assert response.status_code == 200

    def test_auth_config_remains_public_when_auth_enabled(self, client, monkeypatch):
        import src.config

        monkeypatch.setattr(src.config, "get_auth_required", lambda: True)

        response = client.get("/auth/config")

        assert response.status_code == 200
        assert response.json()["auth_required"] is True
