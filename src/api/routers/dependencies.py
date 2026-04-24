"""
Router: Dependency Health Guard overview/detail endpoints.
"""

from fastapi import APIRouter, HTTPException, Query

from src.engine.database import AuditDatabase

router = APIRouter()


@router.get("/dependencies/overview")
async def get_dependency_overview():
    try:
        payload = AuditDatabase.get_dependency_health_overview()
        return {"status": "success", "data": payload}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/dependencies/repository")
async def get_repository_dependency_health(
    target: str = Query(default=""),
):
    normalized_target = str(target or "").strip()
    if not normalized_target:
        raise HTTPException(status_code=400, detail="Thiếu query param target")

    try:
        payload = AuditDatabase.get_repository_dependency_health(normalized_target)
        return {"status": "success", "data": payload}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
