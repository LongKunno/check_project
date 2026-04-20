"""
Integration Tests — API Endpoints (Audit, Repositories, History, Health)
Sử dụng FastAPI TestClient để test API layer.
"""

import os

import pytest
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
        assert response.status_code == 200

    def test_root_has_engine_info(self, client):
        response = client.get("/")
        data = response.json()
        assert "engine" in data or "status" in data


class TestRepositoriesEndpoint:
    """GET /repositories — Danh sách repository."""

    def test_returns_success(self, client):
        response = client.get("/repositories")
        assert response.status_code == 200
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
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["data"], list)

    def test_scores_have_required_fields(self, client):
        response = client.get("/repositories/scores")
        data = response.json()
        if data["data"]:
            repo = data["data"][0]
            for field in ["id", "name", "url", "latest_score"]:
                assert field in repo, f"Missing field '{field}'"


class TestHistoryEndpoint:
    """GET /history — Lịch sử audit."""

    def test_returns_list(self, client):
        response = client.get("/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAuditStatus:
    """GET /audit/status — Trạng thái audit."""

    def test_returns_status(self, client):
        response = client.get("/audit/status")
        assert response.status_code == 200
        data = response.json()
        assert "is_running" in data


class TestHealthAI:
    """GET /health/ai — AI health check."""

    def test_returns_status_field(self, client):
        response = client.get("/health/ai")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] in ["healthy", "unhealthy"]


class TestEngineSettings:
    """GET/PUT /settings/engine — runtime engine settings."""

    def test_get_engine_settings_returns_ai_max_concurrency(self, client, monkeypatch):
        import src.config
        from src.engine.database import AuditDatabase

        monkeypatch.setattr(src.config, "AI_MAX_CONCURRENCY", 5)
        monkeypatch.setattr(
            AuditDatabase,
            "get_config",
            staticmethod(lambda key, default=None: None),
        )

        response = client.get("/settings/engine")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["ai_max_concurrency"] == 5

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

    def test_upload_process_keeps_temp_dir_until_background_task_finishes(self, client, monkeypatch):
        from src.api.audit_state import JobManager
        from src.api.routers import audit as audit_router_module

        observed = {}

        def fake_run_auditor_with_capture(target_path, target_id=None, job_id=None):
            observed["target_path"] = target_path
            observed["job_id"] = job_id
            observed["exists_during_run"] = os.path.exists(target_path)
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

        response = client.post(
            "/audit/process",
            files=[("files", ("nested/demo.py", b"print('ok')\n", "text/x-python"))],
        )

        assert response.status_code == 200
        job_id = response.json()["job_id"]
        job = JobManager.get_job(job_id)

        assert observed["job_id"] == job_id
        assert observed["exists_during_run"] is True
        assert job.status == "COMPLETED"
        assert job.result["status"] == "success"
        assert not os.path.exists(observed["target_path"])


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
