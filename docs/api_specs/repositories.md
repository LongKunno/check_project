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
      "violations_count": 3
    }
  ]
}
```

**Mô tả Response:**
- `latest_score`: Điểm 100 của bài kiểm toán cuối cùng (`null` nếu chưa test).
- `latest_rating`: Bậc đánh giá hạng mục (A, B, C, N/A).
- `latest_timestamp`: Thời gian gần nhất.
- `violations_count`: Tổng số lỗ hổng phát hiện được.

## 2. Thông tin Repositories tổng quát
**Endpoint:** `GET /api/repositories`

**Mục đích:** Trả về danh sách repository nguyên mẫu chỉ với định danh và tên.

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
