# Database - Tổng quan

Hệ thống sử dụng **SQLite** làm cơ sở dữ liệu chính để lưu trữ lịch sử kiểm toán. SQLite được lựa chọn nhờ tính gọn nhẹ, không yêu cầu server riêng biệt và phù hợp với mô hình chạy trong container.

## Kiến trúc Dữ liệu
Dữ liệu được tổ chức theo mô hình thiết kế phẳng (Flat architecture) để tối ưu hóa tốc độ truy xuất. Mọi thông tin chi tiết về điểm số (Scoring) được đóng gói dưới dạng JSON.

## Vị trí lưu trữ
Trong môi trường Docker: `/app/auditor_v2.db`
Trên máy Host: `./auditor_v2.db`

---
*Duy trì bởi Technical Architect.*
