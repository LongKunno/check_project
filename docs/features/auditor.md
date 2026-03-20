# Static Analysis Auditor (Bộ máy kiểm toán)

Đây là trung tâm xử lý, thực hiện việc quét và phát hiện các vi phạm quy chuẩn chất lượng.

## Cách hoạt động
1. **AST & Regex Analysis**:
    - **Python**: Sử dụng cây cú pháp trừu tượng (AST) để phân tích cấu trúc logic.
    - **JavaScript/React**: Sử dụng biểu thức chính quy (Regex) tối ưu để tìm kiếm pattern lỗi.
2. **Các trụ cột kiểm tra**:
    - **Syntax**: Đảm bảo mã nguồn không có lỗi biên dịch cơ bản.
    - **Complexity**: Đo lường độ phức tạp Cyclomatic của các hàm.
    - **Security**: Tìm kiếm secrets, SQL injection, và các hàm nguy hiểm (`eval`).
    - **Documentation**: Kiểm tra sự tồn tại của Docstrings và comments.

---
*Duy trì bởi Technical Architect.*
