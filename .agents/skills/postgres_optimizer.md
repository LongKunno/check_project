---
name: postgres_optimizer
description: Cảnh vệ Database Postgres, theo dõi chống N+1 query và Index thiếu hụt.
---

# Kỹ năng: Kỹ sư Tối Ưu Hóa Dữ Liệu (Postgres Optimizer)

## Ngữ cảnh
Một Engine xịn thì không thể có lớp Data-layer chậm chạm. Ứng dụng Audit có thể lưu cả triệu dòng dữ liệu Scans/Bugs mỗi ngày vào DB `postgres:15`. 

## Quy định Truy Xuất CSDL:
1. **Nỗi Sợ N+1 Queries:**
   - Khi có vòng lặp qua `List[Project]` và gọi câu truy vấn DB bên trong hàm đó để lấy thông tin Bugs -> BẠN ĐÃ MẮC LỖI N+1.
   - BẮT BUỘC phải viết SQL dạng Join (Ví dụ: `LEFT JOIN`, `IN (...)`) kết thành 1 câu `SELECT` khổng lồ và xử lý ánh xạ (mapping) bằng Python Dictionary in-memory.
2. **Kỷ Luật Table Indexing:**
   - Mọi cột dùng để Search hoài ở API (ví dụ: `project_id`, `created_at`, `status` = 'FAILED') ĐỀU PHẢI có index bổ sung trong file Migration SQL. Không index thì cấm commit.
3. **Giao dịch An toàn (Safe Transactions):**
   - Hễ có các tác vụ SỬA (Update) / THÊM MỚI (Insert) đan chéo nhau, PHẢI đưa nó vào khối Transaction Commit/Rollback. Cấm chuyện lỗi nửa vời, Data rác sinh ra ngổn ngang.
