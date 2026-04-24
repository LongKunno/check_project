"""
Router: Repositories CRUD + Health check.
Quản lý danh sách repository thông qua PostgreSQL thay vì hardcode config.py.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from src.engine.database import AuditDatabase
from src.engine.settings_crypto import encrypt_setting
from src.engine.ai_telemetry import AiBudgetExceededError
from src.config import (
    get_regression_gate_enabled,
    get_regression_new_critical_threshold,
    get_regression_pillar_drop_threshold,
    get_regression_score_drop_threshold,
    get_regression_violations_increase_threshold,
    normalize_openai_batch_model,
)

router = APIRouter()


def _raise_persistence_unavailable(exc: RuntimeError):
    raise HTTPException(status_code=503, detail=str(exc)) from exc


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
    latest_audits = AuditDatabase.get_latest_audits_for_targets(
        [repo.get("url", "") for repo in repos]
    )
    public_repos = []

    for repo in repos:
        try:
            latest = latest_audits.get(repo["url"])

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
                    "regression_status": (
                        latest.get("regression_status") if latest else "unavailable"
                    ),
                    "regression_summary": (
                        latest.get("regression_summary") if latest else None
                    ),
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
                    "regression_status": "unavailable",
                    "regression_summary": None,
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


@router.put("/repositories/{repo_id:path}")
async def update_repository(repo_id: str, request: RepositoryRequest):
    """Cập nhật thông tin repository."""
    existing = AuditDatabase.get_repository(repo_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy repository.")
    if request.id != repo_id:
        raise HTTPException(
            status_code=400,
            detail="ID trong body phải khớp với repo_id trên URL.",
        )
    AuditDatabase.save_repository(
        repo_id=repo_id,
        name=request.name,
        url=request.url,
        username=request.username or existing.get("username", ""),
        token=request.token or existing.get("token", ""),
        branch=request.branch or existing.get("branch", "main"),
    )
    return {"status": "success", "message": f"Repository '{request.name}' đã được cập nhật."}


# ── DELETE ────────────────────────────────────────────────────────────────────


@router.delete("/repositories/{repo_id:path}")
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
    ai_mode: Optional[str] = None
    test_mode_limit_files: Optional[int] = None
    ai_max_concurrency: Optional[int] = None
    openai_batch_model: Optional[str] = None
    openai_batch_api_key: Optional[str] = None
    clear_openai_batch_api_key: Optional[bool] = None
    member_recent_months: Optional[int] = None
    auth_required: Optional[bool] = None
    regression_gate_enabled: Optional[bool] = None
    regression_score_drop_threshold: Optional[float] = None
    regression_violations_increase_threshold: Optional[int] = None
    regression_pillar_drop_threshold: Optional[float] = None
    regression_new_critical_threshold: Optional[int] = None


def _build_engine_settings_payload():
    from src.config import (
        get_ai_enabled,
        get_ai_mode,
        get_ai_max_concurrency,
        get_auth_required,
        get_member_recent_months,
        get_openai_batch_model,
        get_test_mode_limit,
        has_openai_batch_api_key,
    )

    return {
        "ai_enabled": get_ai_enabled(),
        "ai_mode": get_ai_mode(),
        "test_mode_limit_files": get_test_mode_limit(),
        "ai_max_concurrency": get_ai_max_concurrency(),
        "openai_batch_model": get_openai_batch_model(),
        "openai_batch_api_key_configured": has_openai_batch_api_key(),
        "member_recent_months": get_member_recent_months(),
        "auth_required": get_auth_required(),
        "regression_gate_enabled": get_regression_gate_enabled(),
        "regression_score_drop_threshold": get_regression_score_drop_threshold(),
        "regression_violations_increase_threshold": get_regression_violations_increase_threshold(),
        "regression_pillar_drop_threshold": get_regression_pillar_drop_threshold(),
        "regression_new_critical_threshold": get_regression_new_critical_threshold(),
    }


@router.get("/settings/engine")
async def get_engine_settings():
    """Lấy cấu hình engine hiện tại (đọc DB, fallback .env)."""
    return {
        "status": "success",
        "data": _build_engine_settings_payload(),
    }


@router.put("/settings/engine")
async def update_engine_settings(request: EngineSettingsRequest):
    """Cập nhật cấu hình engine (lưu vào DB, áp dụng runtime)."""
    try:
        if request.ai_enabled is not None:
            AuditDatabase.set_config("ai_enabled", str(request.ai_enabled).lower())
        if request.ai_mode is not None:
            if request.ai_mode not in {"realtime", "openai_batch"}:
                raise HTTPException(
                    status_code=400,
                    detail="ai_mode chỉ hỗ trợ 'realtime' hoặc 'openai_batch'",
                )
            AuditDatabase.set_config("ai_mode", request.ai_mode)
        if request.test_mode_limit_files is not None:
            if request.test_mode_limit_files < 0:
                raise HTTPException(
                    status_code=400, detail="test_mode_limit_files phải >= 0"
                )
            AuditDatabase.set_config(
                "test_mode_limit_files", str(request.test_mode_limit_files)
            )
        if request.ai_max_concurrency is not None:
            if not 1 <= request.ai_max_concurrency <= 100:
                raise HTTPException(
                    status_code=400,
                    detail="ai_max_concurrency phải nằm trong khoảng 1..100",
                )
            AuditDatabase.set_config(
                "ai_max_concurrency", str(request.ai_max_concurrency)
            )
        if request.openai_batch_model is not None:
            raw_model = request.openai_batch_model.strip()
            if not raw_model:
                raise HTTPException(
                    status_code=400,
                    detail="openai_batch_model không được để trống",
                )
            model = normalize_openai_batch_model(raw_model)
            AuditDatabase.set_config("openai_batch_model", model)
        if request.clear_openai_batch_api_key:
            AuditDatabase.set_config("openai_batch_api_key_encrypted", "")
        elif request.openai_batch_api_key is not None:
            sanitized = request.openai_batch_api_key.strip()
            if sanitized:
                AuditDatabase.set_config(
                    "openai_batch_api_key_encrypted",
                    encrypt_setting(sanitized),
                )
        if request.member_recent_months is not None:
            if not 1 <= request.member_recent_months <= 24:
                raise HTTPException(
                    status_code=400,
                    detail="member_recent_months phải nằm trong khoảng 1..24",
                )
            AuditDatabase.set_config(
                "member_recent_months", str(request.member_recent_months)
            )
        if request.auth_required is not None:
            AuditDatabase.set_config(
                "auth_required", str(request.auth_required).lower()
            )
        if request.regression_gate_enabled is not None:
            AuditDatabase.set_config(
                "regression_gate_enabled",
                str(request.regression_gate_enabled).lower(),
            )
        if request.regression_score_drop_threshold is not None:
            if not 0 <= request.regression_score_drop_threshold <= 100:
                raise HTTPException(
                    status_code=400,
                    detail="regression_score_drop_threshold phải nằm trong khoảng 0..100",
                )
            AuditDatabase.set_config(
                "regression_score_drop_threshold",
                str(request.regression_score_drop_threshold),
            )
        if request.regression_violations_increase_threshold is not None:
            if not 0 <= request.regression_violations_increase_threshold <= 100000:
                raise HTTPException(
                    status_code=400,
                    detail="regression_violations_increase_threshold phải nằm trong khoảng 0..100000",
                )
            AuditDatabase.set_config(
                "regression_violations_increase_threshold",
                str(request.regression_violations_increase_threshold),
            )
        if request.regression_pillar_drop_threshold is not None:
            if not 0 <= request.regression_pillar_drop_threshold <= 10:
                raise HTTPException(
                    status_code=400,
                    detail="regression_pillar_drop_threshold phải nằm trong khoảng 0..10",
                )
            AuditDatabase.set_config(
                "regression_pillar_drop_threshold",
                str(request.regression_pillar_drop_threshold),
            )
        if request.regression_new_critical_threshold is not None:
            if not 0 <= request.regression_new_critical_threshold <= 100000:
                raise HTTPException(
                    status_code=400,
                    detail="regression_new_critical_threshold phải nằm trong khoảng 0..100000",
                )
            AuditDatabase.set_config(
                "regression_new_critical_threshold",
                str(request.regression_new_critical_threshold),
            )
    except RuntimeError as exc:
        _raise_persistence_unavailable(exc)

    return {"status": "success", "data": _build_engine_settings_payload()}


# ── HEALTH CHECK ──────────────────────────────────────────────────────────────


@router.get("/health/ai")
async def health_ai():
    """Kiểm tra kết nối và tính sẵn sàng của AI Service."""
    from src.engine.ai_service import ai_service
    from src.config import get_ai_enabled, get_ai_mode

    if not get_ai_enabled():
        return {"status": "disabled", "mode": "static_only"}

    ai_mode = get_ai_mode()
    try:
        if ai_mode == "openai_batch":
            return await ai_service.check_openai_batch_health()
        return await ai_service.check_realtime_health()
    except AiBudgetExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        return {"status": "unhealthy", "mode": ai_mode, "reason": str(e)}
