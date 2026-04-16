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
                    "pillar_scores": latest["pillar_scores"] if latest else None,
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
                    "pillar_scores": None,
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


# ── ENGINE SETTINGS ───────────────────────────────────────────────────────────


class EngineSettingsRequest(BaseModel):
    ai_enabled: Optional[bool] = None
    test_mode_limit_files: Optional[int] = None
    auth_required: Optional[bool] = None


@router.get("/settings/engine")
async def get_engine_settings():
    """Lấy cấu hình engine hiện tại (đọc DB, fallback .env)."""
    from src.config import AI_ENABLED, TEST_MODE_LIMIT_FILES, AUTH_REQUIRED

    ai_enabled_val = AuditDatabase.get_config("ai_enabled")
    test_limit_val = AuditDatabase.get_config("test_mode_limit_files")
    auth_required_val = AuditDatabase.get_config("auth_required")

    return {
        "status": "success",
        "data": {
            "ai_enabled": ai_enabled_val.lower() in ("true", "1", "yes") if ai_enabled_val is not None else AI_ENABLED,
            "test_mode_limit_files": int(test_limit_val) if test_limit_val is not None else TEST_MODE_LIMIT_FILES,
            "auth_required": auth_required_val.lower() in ("true", "1", "yes") if auth_required_val is not None else AUTH_REQUIRED,
        },
    }


@router.put("/settings/engine")
async def update_engine_settings(request: EngineSettingsRequest):
    """Cập nhật cấu hình engine (lưu vào DB, áp dụng runtime)."""
    if request.ai_enabled is not None:
        AuditDatabase.set_config("ai_enabled", str(request.ai_enabled).lower())
    if request.test_mode_limit_files is not None:
        if request.test_mode_limit_files < 0:
            raise HTTPException(status_code=400, detail="test_mode_limit_files phải >= 0")
        AuditDatabase.set_config("test_mode_limit_files", str(request.test_mode_limit_files))
    if request.auth_required is not None:
        AuditDatabase.set_config("auth_required", str(request.auth_required).lower())

    # Đọc lại config mới từ DB
    from src.config import AI_ENABLED, TEST_MODE_LIMIT_FILES, AUTH_REQUIRED
    ai_enabled_val = AuditDatabase.get_config("ai_enabled")
    test_limit_val = AuditDatabase.get_config("test_mode_limit_files")
    auth_required_val = AuditDatabase.get_config("auth_required")

    return {
        "status": "success",
        "data": {
            "ai_enabled": ai_enabled_val.lower() in ("true", "1", "yes") if ai_enabled_val is not None else AI_ENABLED,
            "test_mode_limit_files": int(test_limit_val) if test_limit_val is not None else TEST_MODE_LIMIT_FILES,
            "auth_required": auth_required_val.lower() in ("true", "1", "yes") if auth_required_val is not None else AUTH_REQUIRED,
        },
    }


# ── HEALTH CHECK ──────────────────────────────────────────────────────────────


@router.get("/health/ai")
async def health_ai():
    """Kiểm tra kết nối và tính sẵn sàng của AI Service."""
    from src.engine.ai_service import ai_service

    try:
        response = await ai_service.client.chat.completions.create(
            model=ai_service.model,
            messages=[
                {"role": "system", "content": "You are a health checker. Keep your response very short."},
                {"role": "user", "content": "Hello, are you working?"}
            ],
            max_tokens=10,
            temperature=0.0
        )
        content = response.choices[0].message.content
        if content:
            # Proxies đôi khi trả về 200 OK nhưng nội dung là chuỗi báo lỗi (vd: Token error, accounts failed...)
            if "Token error" in content or "failed" in content.lower():
                return {"status": "unhealthy", "reason": content}
            return {"status": "healthy", "model": ai_service.model}
        return {"status": "unhealthy", "reason": "Empty response"}
    except Exception as e:
        return {"status": "unhealthy", "reason": str(e)}

