"""
Router: Trends — Baseline/regression trend analytics cho portfolio và repository.
"""

from fastapi import APIRouter, HTTPException, Query

from src.engine.database import AuditDatabase

router = APIRouter()

_SUPPORTED_DAY_RANGES = {7, 30, 90}


def _normalize_trend_days(days: int) -> int:
    if days not in _SUPPORTED_DAY_RANGES:
        raise HTTPException(
            status_code=400,
            detail="days chỉ hỗ trợ một trong các giá trị: 7, 30, 90",
        )
    return days


def _repository_lookup():
    repos = AuditDatabase.get_all_repositories(include_credentials=False)
    return {repo.get("url"): repo for repo in repos}


@router.get("/trends/portfolio")
async def get_portfolio_trends(days: int = Query(default=30)):
    normalized_days = _normalize_trend_days(days)
    try:
        payload = AuditDatabase.get_portfolio_trends(normalized_days)
        repo_by_url = _repository_lookup()
        enriched_top = []
        for item in payload.get("top_regressing_repos", []):
            repo = repo_by_url.get(item.get("target"), {})
            enriched_top.append(
                {
                    **item,
                    "repo_id": repo.get("id"),
                    "repo_name": repo.get("name"),
                }
            )
        payload["top_regressing_repos"] = enriched_top
        return {"status": "success", "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/trends/repository")
async def get_repository_trends(
    target: str = Query(default=""),
    days: int = Query(default=30),
):
    target = str(target or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Thiếu query param target")

    normalized_days = _normalize_trend_days(days)
    try:
        payload = AuditDatabase.get_repository_trends(target, normalized_days)
        repo = _repository_lookup().get(target, {})
        payload["repo_id"] = repo.get("id")
        payload["repo_name"] = repo.get("name")
        return {"status": "success", "data": payload}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
