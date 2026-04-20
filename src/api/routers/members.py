"""
Router: Members Overview — Cross-Project Leaderboard.

Tổng hợp dữ liệu thành viên (author) từ lần audit gần nhất của TẤT CẢ
repository đã cấu hình, gộp theo email và tính điểm Weighted Average (theo LOC).
"""

import logging
from fastapi import APIRouter

from src.config import CONFIGURED_REPOSITORIES
from src.engine.database import AuditDatabase
from src.engine.scoring import ScoringEngine

router = APIRouter()
logger = logging.getLogger(__name__)


def _parse_members_from_full_json(full_json: dict) -> dict:
    """
    Trích xuất member_results từ full_json của một audit session.
    full_json có cấu trúc: {"scores": {"members": {email: {...}}}}
    """
    try:
        return full_json.get("scores", {}).get("members", {}) or {}
    except (AttributeError, TypeError):
        return {}


def _aggregate_members(all_member_data: list[dict]) -> dict:
    """
    Gộp danh sách member data từ nhiều dự án thành một dict theo email.

    Mỗi phần tử trong all_member_data là:
    {
        "email": str,
        "author_name": str,
        "loc": int,
        "punishments": { pillar: float },
        "debt_mins": int,
        "pillars": { pillar: float },
        "final": float,
        "project_name": str,  # thêm vào để hiển thị
    }

    Kết quả aggregation tính điểm cuối (final) bằng Weighted Average theo LOC.
    """
    from src.config import WEIGHTS

    aggregated: dict[str, dict] = {}

    for entry in all_member_data:
        email = entry.get("email", "unknown@unknown")
        if not email or email == "unknown@unknown":
            continue

        if email not in aggregated:
            aggregated[email] = {
                "email": email,
                "author_name": entry.get("author_name", email),
                "total_loc": 0,
                "total_debt_mins": 0,
                "weighted_pillar_sums": {p: 0.0 for p in WEIGHTS.keys()},
                "projects": [],
            }

        agg = aggregated[email]
        loc = entry.get("loc", 0)
        agg["total_loc"] += loc
        agg["total_debt_mins"] += entry.get("debt_mins", 0)
        entry_pillars = entry.get("pillars") or {}
        fallback_punishments = entry.get("punishments") or {}
        for pillar in WEIGHTS.keys():
            score = entry_pillars.get(pillar)
            if score is None:
                score = ScoringEngine.calculate_pillar_score(
                    fallback_punishments.get(pillar, 0.0), loc, pillar
                )
            agg["weighted_pillar_sums"][pillar] += score * loc

        # Cập nhật tên hiển thị nếu có (ưu tiên tên mới nhất)
        if entry.get("author_name") and entry["author_name"] != email:
            agg["author_name"] = entry["author_name"]

        # Ghi nhận dự án member tham gia
        agg["projects"].append(
            {
                "project_name": entry.get("project_name", "Unknown"),
                "loc": loc,
                "score": entry.get("final", 0),
                "debt_mins": entry.get("debt_mins", 0),
            }
        )

    # Tính điểm tổng Weighted Average theo LOC xuyên suốt các dự án
    results = []
    for email, agg in aggregated.items():
        total_loc = agg["total_loc"]
        if total_loc == 0:
            continue

        pillar_scores = {
            pillar: round(agg["weighted_pillar_sums"][pillar] / total_loc, 2)
            for pillar in WEIGHTS.keys()
        }

        # Tính điểm cuối từ pillar scores
        final_score = ScoringEngine.calculate_final_score(pillar_scores)
        rating = ScoringEngine.get_rating(final_score)

        results.append(
            {
                "email": email,
                "author_name": agg["author_name"],
                "total_loc": total_loc,
                "total_debt_mins": agg["total_debt_mins"],
                "pillar_scores": pillar_scores,
                "final_score": final_score,
                "rating": rating,
                "projects": sorted(
                    agg["projects"], key=lambda x: x.get("loc", 0), reverse=True
                ),
                "projects_count": len(agg["projects"]),
            }
        )

    # Sắp xếp theo điểm giảm dần
    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results


@router.get("/members/scores")
async def get_members_scores():
    """
    Cross-Project Member Leaderboard.

    Lấy dữ liệu member từ lần audit gần nhất của tất cả repository đã cấu hình,
    gộp theo email và tính điểm Weighted Average (theo LOC).

    Response 200:
    {
        "status": "success",
        "total_members": int,
        "data": [
            {
                "email": "dev@example.com",
                "author_name": "Long DD",
                "total_loc": 12500,
                "total_debt_mins": 340,
                "final_score": 87.5,
                "rating": "🥈 Tốt",
                "pillar_scores": { "Maintainability": 9.1, "Security": 8.5, ... },
                "projects_count": 3,
                "projects": [
                    { "project_name": "backend-api", "loc": 8000, "score": 92.0 }
                ]
            }
        ]
    }
    """
    all_member_entries = []

    for repo in CONFIGURED_REPOSITORIES:
        repo_url = repo.get("url", "")
        project_name = (
            repo_url.split("/")[-1].replace(".git", "")
            if repo_url
            else repo.get("name", repo.get("id", "unknown"))
        )

        try:
            history = AuditDatabase.get_history(repo_url)
            if not history:
                continue

            latest = history[0]
            audit_id = latest.get("id")
            if not audit_id:
                continue

            audit_detail = AuditDatabase.get_audit_by_id(audit_id)
            if not audit_detail or not audit_detail.get("full_json"):
                continue

            members_in_repo = _parse_members_from_full_json(audit_detail["full_json"])

            for email, m_data in members_in_repo.items():
                # Đảm bảo backward-compat: audit cũ có thể không có "email" key
                email_key = m_data.get("email", email)
                all_member_entries.append(
                    {
                        **m_data,
                        "email": email_key,
                        "project_name": project_name,
                    }
                )

        except Exception as e:
            logger.warning(f"Lỗi khi lấy member data từ repo {repo_url}: {e}")
            continue

    aggregated_results = _aggregate_members(all_member_entries)

    return {
        "status": "success",
        "total_members": len(aggregated_results),
        "data": aggregated_results,
    }
