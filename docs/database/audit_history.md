# Database - Bảng Audit History

Bảng `audit_history` lưu trữ toàn bộ các lần quét mã nguồn.

| Cột | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `id` | INTEGER | Khóa chính. |
| `timestamp` | DATETIME | Thời gian thực hiện quét (mặc định CURRENT_TIMESTAMP). |
| `target` | TEXT | Dự án quét. |
| `score` | REAL | Điểm tổng kết. |
| `rating` | TEXT | Xếp hạng dạng Emoji dựa trên điểm đánh giá (VD: 🏆 Xuất sắc, 🚨 Cần cải thiện ngay). |
| `total_loc` | INTEGER | Tổng số dòng code. |
| `violations_count` | INTEGER | Tổng lỗi. |
| `pillar_scores` | JSON | Chi tiết điểm số Feature/Pillar. Chứa thông tin xếp hạng dự án (`project`), tính năng (`features`), và thành viên (`members` - trong vòng 3 tháng gần nhất). |
| `full_json` | TEXT | Lưu trữ toàn bộ kết quả phân tích dưới dạng JSON nguyên bản để phục vụ xem lại chi tiết không cần quét lại. |
| `scan_mode` | TEXT | Chế độ quét của vòng kiểm toán. Các giá trị khả thi bao gồm `full_ai` (Mặc định) và `static_only` (Khi AI bị tắt do cấu hình). |

---
*Duy trì bởi LongDD.*
