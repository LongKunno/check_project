# Code Discovery Engine (Khám phá tài nguyên)

Tính năng này chịu trách nhiệm thu thập và phân loại toàn bộ tài nguyên trong project mục tiêu.

## Cách hoạt động
1. **Duyệt cây thư mục**: Sử dụng `os.walk` kết hợp `followlinks=True` để duyệt qua project.
    - **Symlink Support**: Đảm bảo Auditor không bỏ sót các thư mục được liên kết ảo (thư mục có biểu tượng mũi tên trong sidebar).
    - **Ưu tiên**: Nếu tồn tại thư mục `source_code`, engine sẽ chỉ quét các file bên trong thư mục này. 
2. **Lọc (Filtering)**: Loại bỏ các thư mục rác (venv, node_modules, .git) dựa trên cấu hình `EXCLUDE_DIRS` ở mọi cấp độ.
3. **Nhận diện file**: Chỉ xử lý các file có phần mở rộng hợp lệ (`.py`) theo quy chuẩn Python-Centric.
4. **Feature Mapping (App-based)**: 
    - Hệ thống tự động xác định các "App" hoặc "Module" Python dựa vào vị trí thư mục.
    - Nếu có `source_code`: Tên tính năng là tên thư mục con của `source_code`.
    - Ví dụ: `source_code/Auto_Pacing/` -> Feature: `Auto_Pacing`.
5. **Số liệu LOC**: Tính toán tổng số dòng code vật lý (Physical Rows) của các tệp Python được tìm thấy.

---
*Duy trì bởi LongDD.*
