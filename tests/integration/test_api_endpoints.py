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
            for field in ["id", "name", "url", "latest_score"]:
                assert field in repo, f"Missing field '{field}'"


class TestHistoryEndpoint:
    """GET /history — Lịch sử audit."""

    def test_returns_list(self, client):
        response = client.get("/history")
        assert response.status_code == 200, response.text
        data = response.json()
        assert isinstance(data, list)


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
        monkeypatch.setattr(src.config, "OPENAI_BATCH_MODEL", "gpt-5.4-mini")
        monkeypatch.setattr(src.config, "MEMBER_RECENT_MONTHS", 3)
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
        assert data["data"]["openai_batch_model"] == "gpt-5.4-mini"
        assert data["data"]["member_recent_months"] == 3

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

    def test_put_engine_settings_encrypts_batch_api_key(self, client, monkeypatch):
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
        monkeypatch.setattr(audit_router_module, "_is_openai_batch_mode", lambda: False)

        upload = UploadFile(filename="demo.py", file=io.BytesIO(b"print('ok')\n"))
        background_tasks = BackgroundTasks()
        response = asyncio.run(
            audit_router_module.upload_and_audit(background_tasks, files=[upload])
        )
        for task in background_tasks.tasks:
            task.func(*task.args, **task.kwargs)

        job_id = response["job_id"]
        job = JobManager.get_job(job_id)

        assert observed["job_id"] == job_id
        assert observed["exists_during_run"] is True
        assert job.status == "COMPLETED"
        assert job.result["status"] == "success"
        assert not os.path.exists(observed["target_path"])

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

    def test_upload_process_cancelled_job_does_not_save_result(self, client, monkeypatch):
        from src.api.audit_state import JobManager
        from src.api.routers import audit as audit_router_module
        import asyncio

        observed = {"build_called": False}

        def fake_run_auditor_with_capture(target_path, target_id=None, job_id=None):
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
