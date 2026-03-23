# Database - Bảng Audit History

Bảng `audit_history` lưu trữ toàn bộ các lần quét mã nguồn.

| Cột | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `id` | INTEGER | Khóa chính. |
| `timestamp` | DATETIME | Thời gian thực hiện quét (mặc định CURRENT_TIMESTAMP). |
| `target` | TEXT | Dự án quét. |
| `score` | REAL | Điểm tổng kết. |
| `rating` | TEXT | Xếp hạng (A, B, C...). |
| `total_loc` | INTEGER | Tổng số dòng code. |
| `violations_count` | INTEGER | Tổng lỗi. |
| `pillar_scores` | JSON | Chi tiết điểm số Feature/Pillar. Chứa thông tin xếp hạng dự án (`project`), tính năng (`features`), và thành viên (`members` - trong vòng 6 tháng gần nhất). |

---
*Duy trì bởi Technical Architect.*
