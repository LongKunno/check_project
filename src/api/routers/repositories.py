"""
Router: Repositories + Health check.
"""
from fastapi import APIRouter
from src.config import CONFIGURED_REPOSITORIES

router = APIRouter()


@router.get("/repositories")
async def get_configured_repositories():
    """Lấy danh sách repository đã cấu hình (ẩn token)."""
    public_repos = [
        {"id": repo["id"], "name": repo["name"], "url": repo["url"]}
        for repo in CONFIGURED_REPOSITORIES
    ]
    return {"status": "success", "data": public_repos}


@router.get("/health/ai")
async def health_ai():
    """Kiểm tra kết nối và tính sẵn sàng của AI Service."""
    from src.engine.ai_service import ai_service
    try:
        response = await ai_service.client.chat.completions.create(
            model=ai_service.model,
            messages=[{"role": "user", "content": "Say 'OK'"}],
            max_tokens=5
        )
        if response.choices[0].message.content:
            return {"status": "healthy", "model": ai_service.model}
        return {"status": "unhealthy", "reason": "Empty response"}
    except Exception as e:
        return {"status": "unhealthy", "reason": str(e)}
