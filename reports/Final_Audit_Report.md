# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-03 02:38:00

## ĐIỂM TỔNG DỰ ÁN: 99.46 / 100 (🏆 Xuất sắc)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 3440
- Tổng số file: 24
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 0 |
| ⚠️ Major | 20 |
| ℹ️ Minor | 29 |
| ℹ️ Info | 9 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 9.95 | ✅ Tốt |
| Maintainability | 9.95 | ✅ Tốt |
| Reliability | 9.95 | ✅ Tốt |
| Security | 9.95 | ✅ Tốt |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `root` (LOC: 19)
**Điểm tính năng: 2.64 / 100** (Nợ: 926m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -53.5 | 0.18 |
| Maintainability | -38.0 | 0.5 |
| Reliability | -92.5 | 0.11 |
| Security | -9.0 | 0.27 |

---
#### 🔹 Tính năng: `src` (LOC: 3167)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `tests` (LOC: 254)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** src/engine/ai_service.py: Function too long (God Object anti-pattern): deep_audit_batch (> 80 lines). AI Note: Hàm 'deep_audit_batch' kéo dài từ dòng 110 đến dòng 192 (khoảng 82 dòng), vượt quá ngưỡng 80 dòng được quy định. Đây là một hàm phức tạp thực hiện nhiều tác vụ như chuẩn bị prompt, gọi API với cơ chế retry, xử lý lỗi và parsing kết quả, vi phạm nguyên tắc Single Responsibility. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Maintainability]** src/engine/ai_service.py: Function too long (God Object anti-pattern): verify_flagged_issues (> 80 lines). AI Note: Hàm 'verify_flagged_issues' kéo dài từ dòng 194 đến dòng 276 (82 dòng), vượt quá ngưỡng 80 dòng. Tương tự như 'deep_audit_batch', nó thực hiện quá nhiều logic xử lý trong một hàm duy nhất, gây khó khăn cho việc bảo trì. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Maintainability]** src/engine/ai_service.py: Print statement found in production code. Use logger instead.. AI Note: Sử dụng 'print' trực tiếp trong mã nguồn production là một thực hành xấu. Nên sử dụng thư viện log chuẩn (ví dụ: logging) để có khả năng kiểm soát mức độ log (DEBUG, INFO, ERROR), định dạng log và log rotation. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** src/engine/ai_service.py: Print statement found in production code. Use logger instead.. AI Note: Sử dụng 'print' trong khối catch lỗi của dịch vụ batch. Việc ghi log vào console qua print làm mất đi tính linh hoạt trong việc giám sát hệ thống production. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** src/engine/ai_service.py: Print statement found in production code. Use logger instead.. AI Note: Sử dụng 'print' trong khối catch lỗi của cơ chế Cross-Check. Các thông tin lỗi quan trọng này cần được ghi nhận qua logger để dễ dàng truy vết và tích hợp với các hệ thống giám sát tập trung. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** src/engine/scanners.py: Function too long (God Object anti-pattern): scan (> 80 lines). AI Note: Hàm `scan` trong `scanners.py` thực tế bao gồm logic xử lý cho rất nhiều loại node AST khác nhau (FunctionDef, For, While, If...), trải dài hơn 80 dòng code, vi phạm nguyên tắc về độ dài hàm để đảm bảo tính bảo trì. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Performance]** src/engine/scanners.py: Cyclomatic Complexity too high (Too many nested loops/branches): scan (Complexity: 62 > 12). AI Note: Hàm `scan` chứa một vòng lặp lớn đi qua các rule và bên trong là rất nhiều cấu trúc điều kiện lồng nhau (if/elif) để kiểm tra các loại node và quy tắc khác nhau, dẫn đến độ phức tạp vòng (Cyclomatic Complexity) vượt xa ngưỡng đề ra. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** src/engine/ai_service.py: Print statement found in production code. Use logger instead.. AI Note: Việc sử dụng lệnh print trực tiếp trong mã nguồn production (đặc biệt là trong các module thuộc engine như ai_service.py) là không tốt cho việc quản lý logs. Nên sử dụng thư viện logging để có thể cấu hình level, format và destination của log. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** src/engine/auditor.py: Function has too many parameters (Consider DTO/Dict): log_violation (9 > 7). AI Note: Hàm log_violation có tới 9 tham số (bao gồm cả 'self'). Theo các tiêu chuẩn Clean Code (như Clean Code của Robert C. Martin), một hàm có quá 3-4 tham số đã bắt đầu khó quản lý. Việc có 9 tham số làm tăng khả năng nhầm lẫn thứ tự đối số và gây khó khăn cho việc viết Unit Test. Giải pháp dùng DTO hoặc Dictionary là hoàn toàn hợp lý. (Rule: TOO_MANY_PARAMS) (Trọng số: -3.0)
- **[Maintainability]** src/engine/auditor.py: Function too long (God Object anti-pattern): run (> 80 lines). AI Note: Việc hàm run() vượt quá 80 dòng là một dấu hiệu của 'God Function'. Trong các công cụ auditor, hàm run thường phải gánh vác nhiều việc như khởi tạo, quét file, chạy luật và tổng hợp kết quả. Nếu không được chia nhỏ, mã nguồn sẽ rất khó bảo trì và debug. (Rule: GOD_OBJECT) (Trọng số: -2.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `AI_REASONING` | Maintainability, Performance, Reliability, Security | 17 | -65.5 |
| `PRINT_STATEMENT` | Maintainability | 8 | -4.0 |
| `HIGH_COMPLEXITY` | Performance | 7 | -35.0 |
| `SILENT_DATA_CORRUPTION` | Performance, Reliability | 6 | -28.5 |
| `UNCHECKED_NONE_RETURN` | Reliability | 6 | -30.0 |
| `GOD_OBJECT` | Maintainability | 5 | -10.0 |
| `UNUSED_IMPORT` | Maintainability | 3 | -1.5 |
| `MISLEADING_NAME` | Maintainability | 2 | -7.0 |
| `TOO_MANY_PARAMS` | Maintainability | 1 | -3.0 |
| `SLOW_STRING_CONCAT` | Performance | 1 | -3.0 |
| `FORGOTTEN_TODO` | Maintainability | 1 | -0.5 |
| `SWALLOWED_EXCEPTION` | Reliability | 1 | -5.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **LongDD** | 2953 | 13.41 | 926m |

#### 🔍 Chi tiết lỗi theo Thành viên

**LongDD** (Top 5 vi phạm nặng nhất):
- [Security] src/engine/discovery.py:15 - Vulnerabilidade de Code Injection: O método 'generate_precheck_script' interpola variáveis (EXCLUDE_DIRS, SCAN_EXTENSIONS) diretamente em uma string de script Python que é executada via subprocess. Se um usuário puder manipular essas configurações (ex: via custom_rules ou env vars), ele pode executar código arbitrário no host. (Rule: AI_REASONING)
- [Performance] src/engine/scanners.py:83 - Cyclomatic Complexity too high (Too many nested loops/branches): scan (Complexity: 62 > 12). AI Note: Hàm `scan` chứa một vòng lặp lớn đi qua các rule và bên trong là rất nhiều cấu trúc điều kiện lồng nhau (if/elif) để kiểm tra các loại node và quy tắc khác nhau, dẫn đến độ phức tạp vòng (Cyclomatic Complexity) vượt xa ngưỡng đề ra. (Rule: HIGH_COMPLEXITY)
- [Performance] src/engine/auditor.py:68 - Cyclomatic Complexity too high (Too many nested loops/branches): run (Complexity: 58 > 12). AI Note: Chỉ số Cyclomatic Complexity là 58 là cực kỳ cao (ngưỡng an toàn thường là 10-15). Điều này chứng minh hàm run() chứa quá nhiều vòng lặp, câu lệnh điều kiện (if/else) lồng nhau. Mặc dù linter xếp nó vào cột Performance (vì nhiều nhánh có thể ảnh hưởng đến branch prediction của CPU), nhưng tác động chính vẫn là Maintainability. (Rule: HIGH_COMPLEXITY)
- [Performance] src/engine/auditor.py:431 - Cyclomatic Complexity too high (Too many nested loops/branches): generate_report (Complexity: 22 > 12). AI Note: Độ phức tạp 22 mặc dù nhỏ hơn hàm run nhưng vẫn vượt xa ngưỡng khuyến nghị (12). Điều này cho thấy logic phân nhánh trong báo cáo (ví dụ: kiểm tra điểm số, xếp hạng, lặp qua các pillars) đang được xử lý quá phức tạp trong một khối code duy nhất. (Rule: HIGH_COMPLEXITY)
- [Performance] src/engine/dependency_checker.py:12 - Cyclomatic Complexity too high (Too many nested loops/branches): detect_circular_dependencies (Complexity: 21 > 12). AI Note: Mặc dù chỉ cung cấp phần đầu của hàm, nhưng việc phát hiện phụ thuộc vòng (circular dependencies) trong một project thường đòi hỏi các thuật toán duyệt đồ thị (như DFS) với nhiều điều kiện kiểm tra, xử lý đệ quy và quản lý trạng thái, dẫn đến Cyclomatic Complexity đạt mức 21 là hợp lý và vượt ngưỡng 12 quy định. Đây là một vi phạm thật về thiết kế code. (Rule: HIGH_COMPLEXITY)
