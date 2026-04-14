"""
Integration Tests — API Endpoints (Audit, Repositories, History, Health)
Sử dụng FastAPI TestClient để test API layer.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    """Create a TestClient for the FastAPI app."""
    from src.api.api_server import app
    with TestClient(app) as c:
        yield c


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
