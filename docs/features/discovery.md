# Code Discovery Engine (Khám phá tài nguyên)

Tính năng này chịu trách nhiệm thu thập và phân loại toàn bộ tài nguyên trong project mục tiêu.

## Cách hoạt động
1. **Duyệt cây thư mục**: Sử dụng `os.walk` để duyệt qua project.
    - **Ưu tiên**: Nếu tồn tại thư mục `source_code`, engine sẽ chỉ quét các file bên trong thư mục này. 
    - Nếu không, engine sẽ quét toàn bộ project từ root.
2. **Lọc (Filtering)**: Loại bỏ các thư mục rác (venv, node_modules, .git) dựa trên cấu hình `EXCLUDE_DIRS`.
3. **Nhận diện file**: Chỉ xử lý các file có phần mở rộng hợp lệ như `.py`.
4. **Feature Mapping**: 
    - Nếu có `source_code`: Tên tính năng là tên thư mục con cấp 1 của `source_code`. Các file nằm trực tiếp trong `source_code` được gán vào `source_code_root`.
    - Nếu không có `source_code`: Tên tính năng là tên thư mục cấp 1 của project. Các file ở root được gán vào `root`.
5. **Số liệu LOC**: Tính toán tổng số dòng code để chuẩn bị cho giai đoạn tính điểm.

---
*Duy trì bởi Technical Architect.*
