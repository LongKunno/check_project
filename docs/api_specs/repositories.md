# Định nghĩa API: Repositories

Tài liệu này đặc tả các endpoint liên quan đến dữ liệu Repositories.

## 1. Lấy thông tin các repository và điểm đánh giá
**Endpoint:** `GET /api/repositories/scores`

**Mục đích:** Truy xuất danh sách toàn bộ các dự án (repository) đã được cấu hình trong hệ thống kèm theo số điểm, xếp loại và thông tin vi phạm của bài đánh giá gần nhất.

**Yêu cầu Xác thực:** Không yêu cầu (Public).

**Tham số:** Không có.

**Response Format (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "project-frontend-01",
      "name": "Frontend Microservice",
      "url": "https://github.com/example/frontend.git",
      "latest_score": 92.5,
      "latest_rating": "A+",
      "latest_timestamp": "2026-04-03T10:00:00",
      "violations_count": 3,
      "regression_status": "warning",
      "regression_summary": {
        "baseline_audit_id": 41,
        "baseline_timestamp": "2026-04-22T08:30:00",
        "baseline_score": 95.6,
        "current_score": 92.5,
        "score_delta": -3.1,
        "violations_delta": 2,
        "new_high_severity_count": 1,
        "triggered_signals": ["score_drop", "new_high_severity"]
      },
      "pillar_scores": {
        "Performance": 9.2,
        "Maintainability": 8.5,
        "Reliability": 9.8,
        "Security": 7.1
      }
    }
  ]
}
```

**Mô tả Response:**
- `latest_score`: Điểm 100 của bài kiểm toán cuối cùng (`null` nếu chưa test).
- `latest_rating`: Bậc đánh giá hạng mục (A, B, C, N/A).
- `latest_timestamp`: Thời gian gần nhất.
- `violations_count`: Tổng số lỗ hổng phát hiện được.
- `regression_status`: Trạng thái Regression Gate của lần scan mới nhất. Giá trị hiện tại: `pass`, `warning`, `unavailable`.
- `regression_summary`: Tóm tắt delta so với baseline liền trước. Nếu chưa đủ dữ liệu so sánh thì có thể là `null`.
- `pillar_scores`: Object chứa điểm 4 trụ cột chất lượng (thang 10), bao gồm `Performance`, `Maintainability`, `Reliability`, `Security`. Giá trị `null` nếu dự án chưa được kiểm toán.

## 2. Thông tin Repositories tổng quát
**Endpoint:** `GET /api/repositories`

**Mục đích:** Trả về danh sách repository nguyên mẫu chỉ với định danh và tên.

> [!NOTE]
> Nếu DB không sẵn sàng, endpoint này sẽ fallback sang snapshot in-memory từ `config.py`. Điều này giúp local/dev vẫn duyệt được danh sách repo, nhưng các thay đổi sẽ không tồn tại sau restart.

**Response Format (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "my-id",
      "name": "My Repo",
      "url": "https://github.com/repo"
    }
  ]
}
```

## 3. Lưu ý runtime khi không có DB

- `GET /api/repositories` và CRUD repository vẫn có thể hoạt động bằng in-memory fallback.
- `GET /api/repositories/scores` không giả lập dữ liệu audit. Nếu không có persistence, các trường như `latest_score`, `latest_rating`, `latest_timestamp`, `violations_count`, `pillar_scores` sẽ là `null`.
- Khi có audit history, `GET /api/repositories/scores` luôn ghép thêm metadata regression của lần scan mới nhất để UI Project Scores hiển thị nhanh trạng thái gate mà không cần gọi history chi tiết.
