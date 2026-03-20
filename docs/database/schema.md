# Database Schema

Hệ thống sử dụng SQLite làm cơ sở dữ liệu lưu trữ lịch sử kiểm toán.

## Bảng: `audit_history`

| Cột | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `id` | INTEGER | Khóa chính, tự động tăng. |
| `timestamp` | DATETIME | Thời gian thực hiện kiểm toán (mặc định CURRENT_TIMESTAMP). |
| `target` | TEXT | Đường dẫn hoặc URL của project được kiểm toán. |
| `score` | REAL | Điểm tổng kết cuối cùng của dự án (thang 100). |
| `rating` | TEXT | Xếp hạng dự án (A+, A, B, C, D, E). |
| `total_loc` | INTEGER | Tổng số dòng code (Lines of Code) được quét. |
| `violations_count` | INTEGER | Tổng số lỗi/vi phạm tìm thấy. |
| `pillar_scores` | TEXT (JSON) | Chuỗi JSON lưu trữ chi tiết điểm số theo từng Feature và Pillar. |

## Mối quan hệ (Relationships)
Hiện tại, hệ thống sử dụng cấu trúc phẳng (Flat Architecture) để lưu trữ kết quả. Toàn bộ chi tiết phân cấp (Phân tích theo Feature -> Pillar) được đóng gói trong cột `pillar_scores` dưới định dạng JSON để tối ưu hóa việc truy xuất nhanh cho Dashboard.

---
*Vị trí file database trên host: `/home/long/Documents/project_private/check_project/auditor_v2.db`*
