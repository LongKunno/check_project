"""
Router: Repositories CRUD + Health check.
Quản lý danh sách repository thông qua PostgreSQL thay vì hardcode config.py.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from src.engine.database import AuditDatabase

router = APIRouter()


class RepositoryRequest(BaseModel):
    id: str
    name: str
    url: str
    username: Optional[str] = ""
    token: Optional[str] = ""
    branch: Optional[str] = "main"


# ── READ ──────────────────────────────────────────────────────────────────────


@router.get("/repositories")
async def get_configured_repositories():
    """Lấy danh sách repository đã cấu hình (ẩn token)."""
    repos = AuditDatabase.get_all_repositories(include_credentials=False)
    return {"status": "success", "data": repos}


@router.get("/repositories/scores")
async def get_projects_scores():
    """Lấy danh sách điểm số (lần audit gần nhất) của toàn bộ dự án đã cấu hình."""
    repos = AuditDatabase.get_all_repositories(include_credentials=False)
    public_repos = []

    for repo in repos:
        try:
            history = AuditDatabase.get_history(repo["url"])
            latest = history[0] if history and len(history) > 0 else None

            public_repos.append(
                {
                    "id": repo["id"],
                    "name": repo["name"],
                    "url": repo["url"],
                    "latest_score": latest["score"] if latest else None,
                    "latest_rating": latest["rating"] if latest else None,
                    "latest_timestamp": latest["timestamp"] if latest else None,
                    "violations_count": latest["violations_count"] if latest else None,
                }
            )
        except Exception as e:
            public_repos.append(
                {
                    "id": repo["id"],
                    "name": repo["name"],
                    "url": repo["url"],
                    "latest_score": None,
                    "latest_rating": None,
                    "latest_timestamp": None,
                    "violations_count": None,
                }
            )

    return {"status": "success", "data": public_repos}


# ── CREATE / UPDATE ───────────────────────────────────────────────────────────


@router.post("/repositories")
async def create_repository(request: RepositoryRequest):
    """Thêm hoặc cập nhật repository."""
    if not request.id or not request.name or not request.url:
        raise HTTPException(status_code=400, detail="Thiếu thông tin bắt buộc: id, name, url.")
    AuditDatabase.save_repository(
        repo_id=request.id,
        name=request.name,
        url=request.url,
        username=request.username or "",
        token=request.token or "",
        branch=request.branch or "main",
    )
    return {"status": "success", "message": f"Repository '{request.name}' đã được lưu."}


@router.put("/repositories/{repo_id}")
async def update_repository(repo_id: str, request: RepositoryRequest):
    """Cập nhật thông tin repository."""
    existing = AuditDatabase.get_repository(repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy repository.")
    AuditDatabase.save_repository(
        repo_id=request.id,
        name=request.name,
        url=request.url,
        username=request.username or existing.get("username", ""),
        token=request.token or existing.get("token", ""),
        branch=request.branch or existing.get("branch", "main"),
    )
    return {"status": "success", "message": f"Repository '{request.name}' đã được cập nhật."}


# ── DELETE ────────────────────────────────────────────────────────────────────


@router.delete("/repositories/{repo_id}")
async def delete_repository(repo_id: str):
    """Soft-delete repository (vô hiệu hóa, không xóa dữ liệu)."""
    existing = AuditDatabase.get_repository(repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy repository.")
    AuditDatabase.delete_repository(repo_id)
    return {"status": "success", "message": f"Repository '{repo_id}' đã bị vô hiệu hóa."}


# ── HEALTH CHECK ──────────────────────────────────────────────────────────────


@router.get("/health/ai")
async def health_ai():
    """Kiểm tra kết nối và tính sẵn sàng của AI Service."""
    from src.engine.ai_service import ai_service

    try:
        response = await ai_service.client.chat.completions.create(
            model=ai_service.model,
            messages=[{"role": "user", "content": "Say 'OK'"}],
            max_tokens=5,
        )
        if response.choices[0].message.content:
            return {"status": "healthy", "model": ai_service.model}
        return {"status": "unhealthy", "reason": "Empty response"}
    except Exception as e:
        return {"status": "unhealthy", "reason": str(e)}
