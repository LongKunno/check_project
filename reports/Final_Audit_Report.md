# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-03 03:42:54

## ĐIỂM TỔNG DỰ ÁN: 18.3 / 100 (🚨 Cần cải thiện ngay)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 3515
- Tổng số file: 24
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 0 |
| ⚠️ Major | 14 |
| ℹ️ Minor | 24 |
| ℹ️ Info | 1 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 1.58 | 🚨 Nguy cơ |
| Maintainability | 3.22 | 🚨 Nguy cơ |
| Reliability | 1.09 | 🚨 Nguy cơ |
| Security | 1.27 | 🚨 Nguy cơ |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `root` (LOC: 19)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `src` (LOC: 3242)
**Điểm tính năng: 14.78 / 100** (Nợ: 660m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -38.0 | 1.46 |
| Maintainability | -36.0 | 2.65 |
| Reliability | -59.0 | 0.99 |
| Security | -29.0 | 0.53 |

---
#### 🔹 Tính năng: `tests` (LOC: 254)
**Điểm tính năng: 57.09 / 100** (Nợ: 40m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -3.0 | 2.5 |
| Maintainability | 0 | 10.0 |
| Reliability | -5.0 | 1.67 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Performance]** src/engine/auditor.py: Cyclomatic Complexity too high (Too many nested loops/branches): run (Complexity: 58 > 12). AI Note: Hàm `run` có độ phức tạp Cyclomatic là 58, vượt xa ngưỡng 12. Điều này là do hàm chứa quá nhiều vòng lặp lồng nhau và các nhánh điều kiện (if/else) để xử lý toàn bộ quy trình kiểm toán từ quét file, xử lý rules, đến lưu log. Đây là một True Positive rõ ràng về mặt hiệu năng và khả năng bảo trì. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** src/engine/auditor.py: Function too long (God Object anti-pattern): generate_report (> 80 lines). AI Note: Hàm `generate_report` dài hơn 80 dòng code. Nó thực hiện quá nhiều nhiệm vụ: tính toán điểm số, định dạng Markdown cho từng trụ cột, liệt kê chi tiết lỗi và ghi file. Việc gộp tất cả vào một hàm vi phạm nguyên tắc Single Responsibility, xác nhận là True Positive. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Performance]** src/engine/auditor.py: Cyclomatic Complexity too high (Too many nested loops/branches): generate_report (Complexity: 22 > 12). AI Note: Độ phức tạp 22 vượt ngưỡng 12 do hàm phải lặp qua nhiều danh sách kết quả, phân loại theo Pillar và Feature, đồng thời xử lý các định dạng hiển thị khác nhau. Cần được tách nhỏ để giảm độ phức tạp. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Reliability]** src/engine/auditor.py: Swallowed exception (except block has only 'pass'). AI Note: Khối `except ImportError: pass` nuốt lỗi mà không có bất kỳ thông báo hay ghi log nào. Mặc dù có thể là có ý đồ bỏ qua khi thiếu module tùy chọn, nhưng việc không log lại khiến việc gỡ lỗi trở nên khó khăn nếu module đó thực sự cần thiết cho luồng xử lý. Đây là True Positive về Reliability. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Performance]** src/engine/dependency_checker.py: Cyclomatic Complexity too high (Too many nested loops/branches): detect_circular_dependencies (Complexity: 21 > 12). AI Note: Hàm `detect_circular_dependencies` chứa logic đệ quy hoặc các vòng lặp duyệt đồ thị phức tạp để phát hiện vòng lặp phụ thuộc. Với độ phức tạp 21, nó gây khó khăn cho việc hiểu và kiểm thử logic phát hiện lỗi, xác nhận là True Positive. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** src/api/api_server.py: Forgotten TODO/FIXME comment in code.. AI Note: Comment sử dụng từ khóa 'HACK', đây là một dạng ghi chú về giải pháp tạm thời tương tự như TODO/FIXME. Do không có mã số Ticket hoặc Issue đi kèm để theo dõi (tracking), nó được coi là một ghi chú lãng quên/tạm thời trong mã nguồn theo chỉ đạo. (Rule: FORGOTTEN_TODO) (Trọng số: -0.5)
- **[Maintainability]** src/api/api_server.py: Import 'asyncio' might be unused (AST). AI Note: Thư viện 'asyncio' được import nhưng không thấy được sử dụng trong các đoạn mã thực thi được cung cấp (như uvicorn.run). Đây là một lỗi import thừa (Unused import). (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Performance]** src/api/git_helper.py: Cyclomatic Complexity too high (Too many nested loops/branches): clone_repository (Complexity: 13 > 12). AI Note: Chỉ số độ phức tạp Cyclomatic (13) đã vượt quá ngưỡng cho phép (12). Đây là vi phạm thực tế về khả năng bảo trì và độ phức tạp của mã nguồn. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Performance]** src/api/routers/audit.py: Cyclomatic Complexity too high (Too many nested loops/branches): upload_and_audit (Complexity: 14 > 12). AI Note: Hàm xử lý file upload tích hợp với Background Tasks và trả về response thường chứa nhiều khối try-except, vòng lặp qua danh sách file và kiểm tra điều kiện (if/else), dẫn đến độ phức tạp đạt 14 là hoàn toàn khả thi và vi phạm ngưỡng 12. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** src/engine/ai_service.py: Function too long (God Object anti-pattern): deep_audit_batch (> 80 lines). AI Note: Các hàm tương tác với AI thường bao gồm các bước: chuẩn bị chunk, xây dựng prompt, gọi API, xử lý lỗi retry và parse kết quả JSON. Việc vượt quá 80 dòng là lỗi phổ biến nếu không tách nhỏ service. (Rule: GOD_OBJECT) (Trọng số: -2.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `AI_REASONING` | Maintainability, Performance, Reliability, Security | 14 | -79.0 |
| `HIGH_COMPLEXITY` | Performance | 7 | -35.0 |
| `GOD_OBJECT` | Maintainability | 5 | -10.0 |
| `SILENT_DATA_CORRUPTION` | Reliability | 4 | -19.0 |
| `MISLEADING_NAME` | Maintainability | 2 | -6.0 |
| `UNCHECKED_NONE_RETURN` | Reliability | 2 | -9.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 1 | -5.0 |
| `FORGOTTEN_TODO` | Maintainability | 1 | -0.5 |
| `UNUSED_IMPORT` | Maintainability | 1 | -0.5 |
| `TOO_MANY_PARAMS` | Maintainability | 1 | -3.0 |
| `SLOW_STRING_CONCAT` | Performance | 1 | -3.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **LongDD** | 2809 | 12.84 | 675m |

#### 🔍 Chi tiết lỗi theo Thành viên

**LongDD** (Top 5 vi phạm nặng nhất):
- [Security] src/api/routers/audit.py:157 - Endpoint '/audit' (legacy) nhận tham số 'target' từ Query string và sử dụng 'os.path.abspath(target)' mà không có bước validate xem đường dẫn đó có nằm trong vùng được phép hay không. Điều này cho phép kẻ tấn công thực hiện kỹ thuật Path Traversal để yêu cầu hệ thống quét các thư mục nhạy cảm bên ngoài root dự án (ví dụ: /etc, /var/log). (Rule: AI_REASONING)
- [Security] src/engine/discovery.py:78 - Rủi ro thực thi mã (Code Execution) và gây ô nhiễm môi trường kiểm toán: Hàm `run_discovery` tạo ra một script Python (`ai_precheck.py`) bên trong thư mục mục tiêu và thực thi nó thông qua `subprocess`. Nếu thư mục mục tiêu chứa mã nguồn không đáng tin cậy hoặc có file trùng tên từ trước, hành động này có thể bị lợi dụng để thực thi mã độc hoặc làm thay đổi trạng thái của mã nguồn đang được kiểm toán. (Rule: AI_REASONING)
- [Reliability] src/api/audit_state.py:84 - Lớp `AuditState` sử dụng các class attributes (`is_cancelled`, `is_running`) để quản lý trạng thái phiên kiểm toán. Trong môi trường FastAPI/Uvicorn (đa luồng/async), các biến này được chia sẻ chung giữa tất cả các request. Nếu một người dùng nhấn 'Cancel', toàn bộ tiến trình kiểm toán của các người dùng khác cũng sẽ bị hủy bỏ (Race Condition/Shared State Corruption). (Rule: AI_REASONING)
- [Reliability] src/api/routers/audit.py:40 - Việc ghi đè trực tiếp 'sys.stdout' sang 'StdoutFallbackStream' trong môi trường bất đồng bộ (FastAPI/asyncio) là một lỗi thiết kế nghiêm trọng. Vì 'sys.stdout' là biến toàn cục của tiến trình, nếu có nhiều yêu cầu audit chạy cùng lúc, log của các job sẽ bị trộn lẫn vào nhau. Hơn nữa, nếu hàm 'run_auditor_with_capture' gặp lỗi cực trọng và không thoát qua khối 'finally', 'sys.stdout' sẽ bị kẹt ở trạng thái chuyển hướng, làm hỏng toàn bộ hệ thống logging của server. (Rule: AI_REASONING)
- [Maintainability] src/engine/dependency_checker.py:25 - Logic bug trong việc xác định tên module: Sử dụng `os.path.basename(f)` sẽ gây ra xung đột (name collision) nếu dự án có các file trùng tên ở các thư mục khác nhau (ví dụ: `auth/utils.py` và `db/utils.py`). Điều này khiến bản đồ phụ thuộc `mod_to_file` bị ghi đè dữ liệu, dẫn đến việc phát hiện phụ thuộc vòng (Circular Dependency) bị sai lệch hoàn toàn hoặc bỏ sót lỗi. (Rule: AI_REASONING)
