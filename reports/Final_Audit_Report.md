# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-03 08:29:48

## ĐIỂM TỔNG DỰ ÁN: 34.07 / 100 (🚨 Cần cải thiện ngay)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 3532
- Tổng số file: 24
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 0 |
| ⚠️ Major | 5 |
| ℹ️ Minor | 28 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 3.73 | 🚨 Nguy cơ |
| Maintainability | 6.38 | ⚠️ Cần cải thiện |
| Reliability | 0.95 | 🚨 Nguy cơ |
| Security | 1.58 | 🚨 Nguy cơ |

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
#### 🔹 Tính năng: `src` (LOC: 3243)
**Điểm tính năng: 30.34 / 100** (Nợ: 375m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -14.0 | 3.17 |
| Maintainability | -7.5 | 6.34 |
| Reliability | -68.0 | 0.87 |
| Security | -18.0 | 0.83 |

---
#### 🔹 Tính năng: `tests` (LOC: 270)
**Điểm tính năng: 74.18 / 100** (Nợ: 45m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -2.0 | 6.67 |
| Reliability | -14.0 | 1.25 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Performance]** src/engine/scanners.py: Cyclomatic Complexity too high (Too many nested loops/branches): scan (Complexity: 24 > 20). AI Note: Hàm scan đóng vai trò điều phối chính trong engine scanner, thường chứa nhiều vòng lặp duyệt qua các quy tắc (rules) và các điều kiện kiểm tra cây AST. Chỉ số Cyclomatic Complexity (CC) là 24 vượt qua ngưỡng khuyến nghị thông thường (thường là 10 hoặc 20), gây khó khăn cho việc bảo trì và kiểm thử đơn vị (unit testing). Mặc dù nó được phân loại vào trụ cột 'Performance', nhưng độ phức tạp cao thường dẫn đến hiệu năng kém do quá trình rẽ nhánh quá nhiều. (Rule: HIGH_COMPLEXITY) (Trọng số: -2.0)
- **[Performance]** src/engine/scanners.py: Cyclomatic Complexity too high (Too many nested loops/branches): _check_calls (Complexity: 24 > 20). AI Note: Hàm _check_calls thường chứa các logic phức tạp để phân tích các hàm gọi đến (function calls), bao gồm việc xử lý các dạng node khác nhau (ast.Name, ast.Attribute) và kiểm tra đối chiếu với danh sách dangerous_funcs. Việc đạt chỉ số CC 24 cho thấy hàm này đang đảm nhận quá nhiều logic kiểm tra lồng nhau, cần được tách nhỏ thành các hàm bổ trợ để giảm tải độ phức tạp và cải thiện khả năng đọc hiểu. (Rule: HIGH_COMPLEXITY) (Trọng số: -2.0)
- **[Maintainability]** src/api/routers/audit.py: Import 'io' might be unused (AST). AI Note: Import 'io' được khai báo nhưng không được sử dụng trong mã nguồn. Đây là một vi phạm về Maintainability (unused import) thực tế. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** src/engine/ai_service.py: Import 'ValidationError' might be unused (AST). AI Note: ValidationError được import từ pydantic nhưng không được dùng để bắt lỗi hay kiểm tra kiểu trong đoạn mã. Đây là True Positive. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Reliability]** src/engine/dependency_checker.py: Swallowed exception (except block has only 'pass'). AI Note: Việc sử dụng 'except Exception as e: pass' mà không có bất kỳ dòng log hay ghi chú giải thích nào là một lỗi Reliability (Swallowed exception). Nó che giấu mọi lỗi phát sinh (bao gồm cả lỗi không mong muốn) và gây khó khăn cho việc debug. Vì không có comment cho thấy đây là hành vi cố ý được kiểm soát, nên đây là True Positive. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Maintainability]** src/engine/dependency_checker.py: Import 'logging' might be unused (AST). AI Note: Thư viện 'logging' được import nhưng không được sử dụng. Đặc biệt là trong Vi phạm #2, nếu logging được sử dụng để ghi lại lỗi thay vì 'pass', vi phạm này đã không xảy ra. Đây là lỗi Maintainability thực tế. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Reliability]** src/api/audit_state.py: Sử dụng 'threading.local()' để lưu trữ 'active_job_id' trong môi trường ASGI (FastAPI) là không an toàn. FastAPI chạy trên event loop (asyncio), nơi nhiều coroutine xử lý các request khác nhau có thể chạy trên cùng một thread. Việc sử dụng threading.local sẽ khiến dữ liệu job_id bị nhiễm chéo (cross-contamination) giữa các request concurrent. Cần sử dụng 'contextvars' để đảm bảo context-safety. (Rule: AI_REASONING) (Trọng số: -5.0)
- **[Reliability]** src/api/audit_state.py: Lớp 'AuditState' sử dụng các biến class (is_cancelled, is_running, logs) để quản lý trạng thái. Trong một ứng dụng Web đa người dùng, các biến này được chia sẻ giữa toàn bộ ứng dụng. Nếu hai người dùng thực hiện audit cùng lúc, họ sẽ ghi đè trạng thái của nhau, dẫn đến race condition và dữ liệu log bị trộn lẫn. Đây là lỗi thiết kế 'Global State' nghiêm trọng. (Rule: AI_REASONING) (Trọng số: -7.0)
- **[Performance]** src/api/audit_state.py: Biến 'AuditState.logs' (list) tích lũy log từ 'AuditLogHandler' mỗi khi không có job nào active. Tuy nhiên, không có cơ chế giới hạn kích thước hoặc dọn dẹp (cleanup) cho danh sách này trừ khi gọi 'reset()' thủ công. Điều này sẽ gây ra hiện tượng rò rỉ bộ nhớ (Memory Leak) theo thời gian khi ứng dụng chạy liên tục. (Rule: AI_REASONING) (Trọng số: -4.0)
- **[Security]** src/api/api_server.py: Việc ghi đè cấu hình Starlette MultiPartParser để tăng 'max_files' và 'max_fields' lên 10,000 (mặc định là 1000) tạo ra rủi ro bị tấn công từ chối dịch vụ (DoS). Kẻ tấn công có thể gửi các payload multipart cực lớn chứa hàng ngàn file/field nhỏ để làm cạn kiệt tài nguyên CPU và RAM của server khi phân tích headers. (Rule: AI_REASONING) (Trọng số: -6.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `AI_REASONING` | Maintainability, Performance, Reliability, Security | 21 | -90.0 |
| `UNUSED_IMPORT` | Maintainability | 3 | -1.5 |
| `HIGH_COMPLEXITY` | Performance | 2 | -4.0 |
| `SILENT_DATA_CORRUPTION` | Reliability | 2 | -10.0 |
| `UNCHECKED_NONE_RETURN` | Reliability | 2 | -10.0 |
| `MISLEADING_NAME` | Maintainability | 2 | -3.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 1 | -5.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **LongDD** | 2717 | 25.79 | 420m |

#### 🔍 Chi tiết lỗi theo Thành viên

**LongDD** (Top 5 vi phạm nặng nhất):
- [Reliability] src/api/audit_state.py:85 - Lớp 'AuditState' sử dụng các biến class (is_cancelled, is_running, logs) để quản lý trạng thái. Trong một ứng dụng Web đa người dùng, các biến này được chia sẻ giữa toàn bộ ứng dụng. Nếu hai người dùng thực hiện audit cùng lúc, họ sẽ ghi đè trạng thái của nhau, dẫn đến race condition và dữ liệu log bị trộn lẫn. Đây là lỗi thiết kế 'Global State' nghiêm trọng. (Rule: AI_REASONING)
- [Reliability] src/engine/verification.py:173 - Hàm 'generate_verification_script' sử dụng `inspect.getsource` để tạo mã nguồn cho script chạy subprocess. Tuy nhiên, hàm `double_check_modular` bên trong script này tham chiếu đến biến global `logger` (được định nghĩa ở cấp module trong verification.py) nhưng biến này không được định nghĩa hoặc import trong script mới được tạo ra. Việc này sẽ dẫn đến lỗi `NameError: name 'logger' is not defined` khi thực hiện bước Verification. (Rule: AI_REASONING)
- [Security] src/api/api_server.py:18 - Việc ghi đè cấu hình Starlette MultiPartParser để tăng 'max_files' và 'max_fields' lên 10,000 (mặc định là 1000) tạo ra rủi ro bị tấn công từ chối dịch vụ (DoS). Kẻ tấn công có thể gửi các payload multipart cực lớn chứa hàng ngàn file/field nhỏ để làm cạn kiệt tài nguyên CPU và RAM của server khi phân tích headers. (Rule: AI_REASONING)
- [Security] src/engine/discovery.py:16 - Lớp `DiscoveryStep` tạo ra một file Python tạm `ai_precheck.py` ngay trong thư mục nguồn của khách hàng (`target_dir`) và thực thi nó. Đây là một hành vi xâm nhập không an toàn (Intrusive). Ngoài ra, việc nhúng các cấu hình như `EXCLUDE_DIRS` trực tiếp vào mã script thông qua f-string mà không thông qua cơ chế serialization an toàn tiềm ẩn nguy cơ Code Injection nếu các biến cấu hình này bị thao túng. (Rule: AI_REASONING)
- [Security] src/api/routers/audit.py:272 - Tham số 'request.snippet' trong endpoint 'get_fix_suggestion' được nhúng trực tiếp vào chuỗi prompt gửi tới AI. Người dùng có thể cố tình đóng khối code bằng ba dấu nháy ngược và chèn các chỉ thị mới để vượt qua các hạn chế hệ thống (Prompt Injection). (Rule: AI_REASONING)
