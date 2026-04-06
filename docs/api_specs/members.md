# API Specification: Members Overview

Tài liệu này đặc tả endpoint tổng hợp thông tin thành viên (Cross-Project Leaderboard).

## GET /api/members/scores

**Mục đích:** Tổng hợp điểm số của từng thành viên (developer) qua **TẤT CẢ** repositories đã được cấu hình trong hệ thống. Sử dụng `author_email` từ `git blame` làm khóa chính để tránh nhầm lẫn khi cùng một người dùng nhiều tên hiển thị khác nhau.

**Yêu cầu Xác thực:** Không yêu cầu (Public).

**Tham số:** Không có.

**Response Format (200 OK):**
```json
{
  "status": "success",
  "total_members": 18,
  "data": [
    {
      "email": "dev@example.com",
      "author_name": "Long DD",
      "total_loc": 12500,
      "total_debt_mins": 340,
      "final_score": 87.5,
      "rating": "🥈 Tốt",
      "pillar_scores": {
        "Maintainability": 9.1,
        "Security": 8.5,
        "Reliability": 9.0,
        "Performance": 8.8
      },
      "projects_count": 3,
      "projects": [
        { "project_name": "backend-api", "loc": 8000, "score": 92.0, "debt_mins": 120 },
        { "project_name": "frontend", "loc": 4500, "score": 79.2, "debt_mins": 220 }
      ]
    }
  ]
}
```

**Mô tả thuật toán tổng hợp (Aggregation Logic):**
1. Duyệt qua `CONFIGURED_REPOSITORIES`, lấy bản ghi audit **gần nhất** của mỗi repo.
2. Parse `full_json → scores.members` (dict keyed by email) từ mỗi bản ghi.
3. Gộp (aggregate) các entry cùng email: cộng dồn `total_loc`, `total_debt_mins`, `total_punishments` theo từng Pillar.
4. Tính lại `pillar_scores` và `final_score` từ tổng punishment gộp bằng `ScoringEngine`, đảm bảo tính điểm **Weighted Average theo LOC** xuyên suốt các dự án.
5. Sắp xếp kết quả theo `final_score` giảm dần.

**Backward Compatibility:**
- Audit cũ lưu `member_results` với key là tên (name). Hệ thống xử lý fallback: nếu không có trường `email` trong dữ liệu member cũ, dùng key gốc (tên) làm `email`.

**Response 500:** Lỗi kết nối database hoặc lỗi parse JSON.

---
*Duy trì bởi LongDD.*
