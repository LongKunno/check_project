# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

## ĐIỂM TỔNG DỰ ÁN: 95.97 / 100 (🏆 Xuất sắc)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 382713
- Tổng số file: 1621
- Tổng số tính năng: 2

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 9.56 | ✅ Tốt |
| Maintainability | 9.14 | ✅ Tốt |
| Reliability | 9.48 | ✅ Tốt |
| Security | 9.4 | ✅ Tốt |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `growme_app` (LOC: 274119)
**Điểm tính năng: 91.94 / 100** (Nợ: 720m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -35.0 | 9.4 |
| Maintainability | -72.0 | 8.84 |
| Reliability | -42.0 | 9.29 |
| Security | -49.0 | 9.18 |

---
#### 🔹 Tính năng: `growme_api` (LOC: 108594)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/F7_2_Dashboard/utils/handle_data.py: Function too long: get_data_cache_004 (> 100 lines). AI Note: Hàm xử lý báo cáo RPT_004 thường bao gồm nhiều bước truy vấn, biến đổi dữ liệu và định dạng JSON, dẫn đến việc vượt quá 100 dòng là lỗi phổ biến trong các module dashboard cũ. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Performance]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/F7_2_Dashboard/utils/handle_data.py: Cyclomatic Complexity too high: get_data_cache_004 (Complexity: 17 > 10). AI Note: Độ phức tạp 17 cho thấy hàm có nhiều cấu trúc điều kiện (if/else) hoặc vòng lặp để xử lý các tham số thời gian và logic cache, vi phạm tiêu chuẩn thiết kế đơn giản. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/F7_2_Dashboard/utils/handle_data.py: Function too long: get_data_cache_005 (> 100 lines). AI Note: Tương tự như các hàm xử lý báo cáo khác trong file này, get_data_cache_005 chứa logic xử lý dữ liệu phức tạp cho Report 005, dễ dàng vượt ngưỡng 100 dòng. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/F7_2_Dashboard/utils/handle_data.py: Function too long: get_data_cache_003 (> 100 lines). AI Note: Hàm get_data_cache_003 thực hiện các tác vụ lấy dữ liệu và lưu cache cho báo cáo 003, việc gom quá nhiều logic vào một hàm duy nhất là vi phạm thực tế về bảo trì. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Performance]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/F7_2_Dashboard/utils/handle_data.py: Cyclomatic Complexity too high: get_data_cache_003 (Complexity: 22 > 10). AI Note: Chỉ số 22 là rất cao, cho thấy hàm có quá nhiều nhánh rẽ nhánh logic, gây khó khăn cho việc kiểm thử và bảo trì code. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/F7_2_Dashboard/utils/report_draw.py: Function too long: CRB_RPT_003 (> 100 lines). AI Note: Hàm xử lý báo cáo logic thường dài và phức tạp; nếu vượt quá 100 dòng thì việc cảnh báo để refactor là đúng tiêu chuẩn Maintainability. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/F7_2_Dashboard/utils/report_draw.py: Import '*' might be unused (AST). AI Note: Wildcard import (*) gây khó khăn cho việc kiểm tra tĩnh (AST) và làm ô nhiễm namespace. Đây là lỗi thực tế về quy chuẩn lập trình Python. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/_Extract_Tags/models.py: Import 'models' might be unused (AST). AI Note: Đây là import mặc định khi tạo app Django. Nếu file models.py chưa khai báo Model nào thì import này thực sự dư thừa và cần loại bỏ. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/_Extract_Tags/tests.py: Import 'TestCase' might be unused (AST). AI Note: Trong Django, file tests.py được tạo sẵn import TestCase. Nếu không có mã test nào được viết, nó là import không sử dụng. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** /tmp/git_audit_pgc2d_xl/repo/source_code/growme_app/code/_Extract_Tags/admin.py: Import 'admin' might be unused (AST). AI Note: Tương tự các file mặc định của Django, nếu admin.py chưa đăng ký bất kỳ model nào với admin site, import này là dư thừa. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
