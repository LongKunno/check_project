# Static Analysis Auditor (Bộ máy kiểm toán)

Đây là trung tâm xử lý, thực hiện việc quét và phát hiện các vi phạm quy chuẩn chất lượng.

## Cách hoạt động
1. **AST & Regex Analysis (V5)**:
    - **Python (Node Lineage & Context Aware)**: Sử dụng cây cú pháp trừu tượng (AST) có gán `parent` node để phân tích cấu trúc logic. Cho phép kiểm tra ngữ cảnh sâu như: "Một Exception bị nuốt (`try/except pass`), File mở ra nhưng không có block `with` hay `close()` (Leak Memory), và gọi API HTTP mà không set hàm `timeout`." Suy luận phức tạp này chỉ có V5 mới làm được mà không dùng đến AI.
    - **JavaScript/React**: Sử dụng biểu thức chính quy (Regex) tối ưu để tìm kiếm pattern lỗi.
2. **Các trụ cột kiểm tra**:
    - **Syntax**: Đảm bảo mã nguồn không có lỗi biên dịch cơ bản.
    - **Complexity & Clean Code V5**: Đo lường độ phức tạp (ngưỡng 12), giới hạn kích thước hàm (80 dòng), và số tham số đầu vào tối đa (7 tham số).
    - **Security V5**: Tìm kiếm secrets (JWT, AWS, GCP token rò rỉ), chặn đứng `DEBUG=True` trên Django Cấu hình, và cấm các hàm nguy hiểm (`eval`).
    - **Documentation**: Kiểm tra sự tồn tại của Docstrings và comments.

---
*Duy trì bởi Technical Architect.*
