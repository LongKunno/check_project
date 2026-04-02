"""
Router: History — Tra cứu lịch sử các lần kiểm toán.
"""
from fastapi import APIRouter, HTTPException
from src.engine.database import AuditDatabase

router = APIRouter()


@router.get("/history")
async def get_audit_history(target: str = None):
    """Lấy danh sách lịch sử các lần audit (không kèm payload vi phạm đầy đủ)."""
    try:
        history = AuditDatabase.get_history(target)
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{audit_id}")
async def get_audit_detail(audit_id: int):
    """Lấy chi tiết 1 lần audit theo ID (kèm toàn bộ payload vi phạm)."""
    try:
        detail = AuditDatabase.get_audit_by_id(audit_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch sử kiểm toán.")
        return detail
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
