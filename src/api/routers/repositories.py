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


@router.get("/repositories/scores")
async def get_projects_scores():
    """Lấy danh sách điểm số (lần audit gần nhất) của toàn bộ dự án đã cấu hình."""
    from src.engine.database import AuditDatabase
    public_repos = []

    for repo in CONFIGURED_REPOSITORIES:
        try:
            history = AuditDatabase.get_history(repo["url"])
            latest = history[0] if history and len(history) > 0 else None
            
            public_repos.append({
                "id": repo["id"],
                "name": repo["name"],
                "url": repo["url"],
                "latest_score": latest["score"] if latest else None,
                "latest_rating": latest["rating"] if latest else None,
                "latest_timestamp": latest["timestamp"] if latest else None,
                "violations_count": latest["violations_count"] if latest else None,
            })
        except Exception as e:
            public_repos.append({
                "id": repo["id"],
                "name": repo["name"],
                "url": repo["url"],
                "latest_score": None,
                "latest_rating": None,
                "latest_timestamp": None,
                "violations_count": None,
            })
            
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
