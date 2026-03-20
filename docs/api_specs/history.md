# API - Audit History

Lấy danh sách các lần kiểm toán đã được thực hiện trong quá khứ được lưu trữ trong Database.

- **Endpoint**: `/history`
- **Method**: `GET`

## Tham số truy vấn (Query Parameters)
- `target` (string): Lọc lịch sử theo đường dẫn hoặc URL của dự án.

## Phản hồi
Trả về một mảng chứa chi tiết các lần kiểm toán bao gồm: `score`, `rating`, `timestamp` và `violations_count`.

---
*Duy trì bởi Technical Architect.*
