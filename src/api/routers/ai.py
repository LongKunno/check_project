"""
Router: AI Ops — observability, pricing, budgets, request explorer.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.engine.ai_pricing_research import ai_pricing_research
from src.engine.ai_telemetry import ai_telemetry

router = APIRouter()


class PricingEntryRequest(BaseModel):
    provider: str
    mode: str
    model: str
    input_cost_per_million: float = Field(default=0, ge=0)
    output_cost_per_million: float = Field(default=0, ge=0)
    cached_input_cost_per_million: float = Field(default=0, ge=0)
    currency: str = "USD"
    is_active: bool = True


class PricingCatalogRequest(BaseModel):
    items: List[PricingEntryRequest]


class PricingResearchRequest(BaseModel):
    provider: str
    model: str
    mode: Optional[str] = None


class BudgetPolicyRequest(BaseModel):
    daily_budget_usd: Optional[float] = Field(default=None, ge=0)
    monthly_budget_usd: Optional[float] = Field(default=None, ge=0)
    hard_stop_enabled: Optional[bool] = None
    retention_days: Optional[int] = Field(default=None, ge=1, le=3650)
    raw_payload_retention_enabled: Optional[bool] = None


@router.get("/ai/overview")
async def get_ai_overview(
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
):
    return {
        "status": "success",
        "data": ai_telemetry.get_overview(date_from=date_from, date_to=date_to),
    }


@router.get("/ai/usage/series")
async def get_ai_usage_series(
    granularity: str = Query(default="day"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
):
    if granularity not in {"day", "hour"}:
        raise HTTPException(status_code=400, detail="granularity chỉ hỗ trợ 'day' hoặc 'hour'")
    return {
        "status": "success",
        "data": ai_telemetry.get_usage_series(
            granularity=granularity,
            date_from=date_from,
            date_to=date_to,
        ),
    }


@router.get("/ai/requests")
async def list_ai_requests(
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    project: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    provider: Optional[str] = Query(default=None),
    model: Optional[str] = Query(default=None),
    mode: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    return {
        "status": "success",
        **ai_telemetry.list_requests(
            date_from=date_from,
            date_to=date_to,
            project=project,
            source=source,
            status=status,
            provider=provider,
            model=model,
            mode=mode,
            page=page,
            page_size=page_size,
        ),
    }


@router.get("/ai/filters/meta")
async def get_ai_filters_meta(
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    project: Optional[str] = Query(default=None),
):
    return {
        "status": "success",
        "data": ai_telemetry.get_filter_metadata(
            date_from=date_from,
            date_to=date_to,
            project=project,
        ),
    }


@router.get("/ai/requests/{request_id}")
async def get_ai_request_detail(request_id: str):
    detail = ai_telemetry.get_request_detail(request_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Không tìm thấy AI request.")
    return {
        "status": "success",
        "data": detail,
    }


@router.get("/ai/pricing")
async def get_ai_pricing():
    return {
        "status": "success",
        "data": ai_telemetry.get_pricing_catalog(),
    }


@router.put("/ai/pricing")
async def update_ai_pricing(request: PricingCatalogRequest):
    try:
        return {
            "status": "success",
            "data": ai_telemetry.save_pricing_catalog(
                [item.model_dump() for item in request.items]
            ),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai/pricing/research")
async def research_ai_pricing(request: PricingResearchRequest):
    try:
        return {
            "status": "success",
            "data": ai_pricing_research.research(
                provider=request.provider,
                model=request.model,
                mode=request.mode,
            ),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/ai/budget")
async def get_ai_budget():
    return {
        "status": "success",
        "data": {
            **ai_telemetry.get_budget_policy(),
            **ai_telemetry.get_budget_usage(),
        },
    }


@router.put("/ai/budget")
async def update_ai_budget(request: BudgetPolicyRequest):
    return {
        "status": "success",
        "data": {
            **ai_telemetry.save_budget_policy(request.model_dump(exclude_none=True)),
            **ai_telemetry.get_budget_usage(),
        },
    }
