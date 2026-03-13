# AI Static Analysis - Release V1.0.0 (Framework V3)

Dự án này là một công cụ phân tích tĩnh chuyên biệt được thiết kế để đánh giá chất lượng, bảo mật và hiệu năng của các dự án phần mềm khác. Phiên bản 1.0.0 tích hợp đầy đủ Web Dashboard và Docker Orchestration.

## 核心架构 (Core Architecture)

Hệ thống hoạt động dựa trên nguyên tắc "Chỉ phân tích tĩnh" (**Static-Only**), đảm bảo an toàn và tốc độ bằng cách phân tích mã nguồn mà không cần thực thi. Công cụ đánh giá dựa trên 4 trụ cột chính:

1.  **Hiệu năng (Performance - 30%)**: Tối ưu hóa **BigQuery**, quản lý bộ nhớ (**Memory management**), độ trễ API (**API latency**), hiệu suất xây dựng (**Build efficiency**).
2.  **Bảo trì (Maintainability - 25%)**: Các lỗi trình bày (**Code smells**), tuân thủ kiến trúc (**Architecture compliance**), các quy ước (**Conventions** như PEP8, Type Hints), tài liệu (**Documentation**).
3.  **Độ tin cậy (Reliability - 25%)**: Xử lý ngoại lệ (**Exception handling**), độ bao phủ mã nguồn (**Code coverage**), lỗi logic (**Logical flaws**), tính ổn định (**Robustness**).
4.  **Bảo mật (Security - 20%)**: Quản lý bí mật (**Secret management**), xác thực & phân quyền (**Auth/Authz**), làm sạch dữ liệu (**Sanitization**), bảo vệ phụ thuộc (**Dependency protection**).

## Chế độ hoạt động (Operating Modes)

Công cụ kiểm toán có thể được tích hợp vào các quy trình làm việc khác nhau:
-   **Terminal CLI**: Dùng cho việc kiểm toán thủ công nhanh chóng.
-   **CI/CD Pipeline**: Tự động kiểm tra trong mỗi **Pull Request**.
-   **Bulk Auditor**: Quét hàng loạt nhiều kho lưu trữ (**Repositories**) trong một không gian làm việc.

## Định mức hóa (Normalization)

Điểm số được tính toán dựa trên mật độ vi phạm trên mỗi 1000 dòng code (LOC):
`Điểm = 10 / (1 + (|Tổng trọng số vi phạm| / 2))`

---

## Hướng dẫn cho Kiểm toán viên (System Prompt)

Quy trình kiểm toán tuân thủ nghiêm ngặt 5 bước:
1.  **DISCOVERY**: Tự động tính toán LOC và lập chỉ mục file (**File indexing**) qua `ai_precheck.py`.
2.  **ITERATIVE SCANNING**: Phân tích ngữ nghĩa chuyên sâu từng file theo bảng tiêu chí V3.
3.  **AUTOMATED VERIFICATION**: Kiểm tra chéo dựa trên **AST** (Abstract Syntax Tree) và **Regex** qua `ai_double_check.py`.
4.  **AGGREGATION**: Tổng hợp dữ liệu và tính điểm theo trọng số.
5.  **FINAL REPORTING**: Xuất báo cáo `Final_Audit_Report.md` và các bản tóm tắt cấp cao.

---

## Hướng dẫn sử dụng (How to Use)

### 1. Chạy cục bộ (Local Development)
- **Backend**: 
  ```bash
  python3 src/api/api_server.py
  ```
- **Frontend**:
  ```bash
  cd dashboard && npm install && npm run dev
  ```

### 2. Chạy bằng Docker (Production Ready)
```bash
docker-compose up --build
```
Hệ thống sẽ khả dụng tại:
- Dashboard: `http://localhost:3000`
- API Swagger: `http://localhost:8000/docs`

---

*Khung đánh giá này dựa trên các tiêu chuẩn quốc tế bao gồm ISO/IEC 5055:2021, ISO/IEC 25010, và các chuẩn OWASP/CWE.*
