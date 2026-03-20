# Code Discovery Engine (Khám phá tài nguyên)

Tính năng này chịu trách nhiệm thu thập và phân loại toàn bộ tài nguyên trong project mục tiêu.

## Cách hoạt động
1. **Duyệt cây thư mục**: Sử dụng `os.walk` để duyệt qua toàn bộ project.
2. **Lọc (Filtering)**: Loại bỏ các thư mục rác (venv, node_modules, .git) dựa trên cấu hình `EXCLUDE_DIRS`.
3. **Nhận diện file**: Chỉ xử lý các file có phần mở rộng hợp lệ như `.py`, `.js`, `.jsx`.
4. **Feature Mapping**: Tự động phân nhóm các file vào một "Tính năng" (Feature) dựa trên tên thư mục cấp 1.
5. **Số liệu LOC**: Tính toán tổng số dòng code để chuẩn bị cho giai đoạn tính điểm.

---
*Duy trì bởi Technical Architect.*
