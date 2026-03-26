# Static Analysis Auditor (Bộ máy kiểm toán)

Đây là trung tâm xử lý, thực hiện việc quét và phát hiện các vi phạm quy chuẩn chất lượng.

## Quá trình Thực thi (5 Bước)
1. **BƯỚC 1: Khám phá tài nguyên (Discovery)**: Lọc dự án thành các Features dựa trên cấu trúc thư mục (VD ưu tiên `source_code`).
2. **BƯỚC 2 & 3: Quét và Xác thực lỗi (Scanning & Verification)**: 
    - Xử lý qua kiến trúc **Modular Scanners**, bao gồm `RegexScanner` (trực quan hóa bằng Regex) và `PythonASTScanner` (mở rộng phân tích độ phức tạp, Node Lineage).
3. **BƯỚC 3.5: Xác thực AI (AI Hybrid Validation - Batching)**: Gửi các lỗi (Violations) tìm được cho AI phân loại False Positive thông qua Async I/O (đồng thời 25 luồng để ổn định tốc độ báo lỗi).
4. **BƯỚC 3.6: AI Reasoning Audit (Deep Audit)**: Áp dụng Deep File Scan để tìm kiếm các lỗi hệ thống dạng logic tiềm ẩn (Architectural / Security Logical Flaws).
5. **BƯỚC 4: Tổng hợp dữ liệu (Aggregation)**: 
    - Tính toán điểm số theo Từng Tính năng (Feature-based).
    - Đánh giá Điểm thành viên (Member Performance) giới hạn trong 6 tháng thông qua `--since=6.months` blame data.
6. **BƯỚC 5: Xuất báo cáo (Reporting)**: Lưu toàn bộ lịch sử vi phạm vào DB và tổng hợp Markdown Report tổng thể.

---
*Duy trì bởi LongDD.*
