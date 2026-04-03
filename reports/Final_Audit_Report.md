# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-03 08:37:16

## ĐIỂM TỔNG DỰ ÁN: 42.56 / 100 (🚨 Cần cải thiện ngay)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 3541
- Tổng số file: 24
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 0 |
| ⚠️ Major | 3 |
| ℹ️ Minor | 20 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 6.5 | ⚠️ Cần cải thiện |
| Maintainability | 5.41 | 🚨 Nguy cơ |
| Reliability | 1.36 | 🚨 Nguy cơ |
| Security | 1.77 | 🚨 Nguy cơ |

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
#### 🔹 Tính năng: `src` (LOC: 3252)
**Điểm tính năng: 39.32 / 100** (Nợ: 240m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -4.0 | 6.19 |
| Maintainability | -11.0 | 5.42 |
| Reliability | -58.0 | 1.01 |
| Security | -14.0 | 1.04 |

---
#### 🔹 Tính năng: `tests` (LOC: 270)
**Điểm tính năng: 77.5 / 100** (Nợ: 25m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -4.0 | 5.0 |
| Reliability | -2.0 | 5.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Reliability]** src/engine/database.py: Sử dụng 'psycopg2.pool.SimpleConnectionPool' trong một kiến trúc có sử dụng Asyncio/Concurrency. Theo tài liệu của psycopg2, SimpleConnectionPool không thread-safe. Trong môi trường kiểm toán mã nguồn quy mô lớn hoặc chạy tích hợp trong web server, điều này có thể dẫn đến lỗi tranh chấp kết nối (connection race conditions) hoặc hỏng trạng thái pool nội bộ. (Rule: AI_REASONING) (Trọng số: -7.0)
- **[Reliability]** src/engine/dependency_checker.py: Lỗi logic ánh xạ module (Short Name Collision). Hàm '_build_mappings' sử dụng tên file ngắn (basename) làm key trong 'mod_to_f'. Trong các dự án Python lớn, các file như 'models.py', 'utils.py' thường xuất hiện ở nhiều package khác nhau (vd: app1/models.py và app2/models.py). Việc chỉ lưu 'short_name' sẽ khiến ánh xạ sau ghi đè ánh xạ trước, dẫn đến việc phát hiện Circular Dependency sai lệch hoàn toàn hoặc bỏ sót các mối liên kết thực tế. (Rule: AI_REASONING) (Trọng số: -6.0)
- **[Security]** src/engine/discovery.py: Cơ chế 'Code Injection by Design'. Hàm 'run_discovery' thực hiện ghi một kịch bản Python mới ('ai_precheck.py') vào thư mục đích (target_dir) và thực thi nó bằng 'subprocess.run'. Nếu người dùng có quyền ghi vào thư mục này hoặc nếu 'target_dir' là một repo không tin cậy, điều này cho phép thực thi mã tùy ý trong môi trường của Auditor. Ngoài ra, việc thực thi python3 mà không thông qua venv hiện tại có thể dẫn đến sai lệch library. (Rule: AI_REASONING) (Trọng số: -8.0)
- **[Reliability]** src/engine/database.py: Race condition trong logic 'toggle_core_rule'. Mặc dù có sử dụng 'SELECT ... FOR UPDATE', nhưng nếu 'target_id' chưa tồn tại, lock sẽ không được thiết lập trên bản ghi. Nếu hai luồng cùng gọi hàm này đồng thời cho một 'target_id' mới, cả hai đều thấy 'row' là None và cùng thực hiện 'INSERT', dẫn đến lỗi 'Unique Violation' (IntegrityError) cho cột target_id_unique. (Rule: AI_REASONING) (Trọng số: -4.0)
- **[Maintainability]** src/engine/auditor.py: Quản lý Event Loop không an toàn. Hàm '_step_ai_validation' và '_step_ai_reasoning' tạo mới event loop bằng 'asyncio.new_event_loop()' và chạy 'run_until_complete'. Nếu CodeAuditor được tích hợp vào một ứng dụng đã có sẵn loop (như Fast API hoặc ứng dụng Async khác), việc này sẽ gây lỗi 'RuntimeError: Timeout context manager should be used inside a task' hoặc xung đột loop hiện hữu. (Rule: AI_REASONING) (Trọng số: -3.0)
- **[Maintainability]** tests/test_overall_pillars.py: Có sự mâu thuẫn nghiêm trọng giữa tài liệu (comment dòng 64) và kỳ vọng thực tế (assert dòng 67). Comment tính toán Score = 1.67 dựa trên logic phạt, nhưng assert lại mong đợi giá trị 8.18. Điều này cho thấy nomenclature 'project_pillars' hoặc cách tính toán engine đang gây hiểu lầm cho người đọc mã nguồn về bản chất của điểm số (là điểm cộng hay điểm trừ/phạt). (Rule: MISLEADING_NAME) (Trọng số: -1.0)
- **[Maintainability]** tests/test_natural_rules_compiler.py: Logic sửa lỗi định dạng JSON (`if not json_str.startswith('{'): json_str = '{' + json_str + '}'`) quá thô sơ. Nếu AI trả về một danh sách JSON (JSON Array `[...]`), việc cố tình chèn thêm dấu ngoặc nhọn `{` ở đầu sẽ tạo ra một chuỗi JSON không hợp lệ, thay vì sửa chữa nó. Điều này gây ra lỗi parsing không đáng có. (Rule: AI_REASONING) (Trọng số: -3.0)
- **[Reliability]** tests/test_authorship.py: Việc sử dụng hardcode thư mục tạm `/tmp/test_authorship_project` mà không có cơ chế random hóa tên hoặc cleanup an toàn (race condition) khiến test case dễ bị lỗi nếu chạy song song (parallel testing) hoặc chạy trên môi trường có nhiều user. Điều này làm giảm tính cô lập của test suite. (Rule: AI_REASONING) (Trọng số: -2.0)
- **[Reliability]** src/api/routers/audit.py: Biến toàn cục `AuditState.is_running` gây ra Race Condition trong môi trường đa nhiệm. Khi nhiều Job chạy song song, hàm `run_auditor_with_capture` đặt `is_running = False` trong khối `finally`. Nếu Job A kết thúc trong khi Job B vẫn đang chạy, trạng thái hệ thống sẽ bị báo sai là 'Idle' (False), gây ảnh hưởng đến UI/UX và logic điều khiển. (Rule: AI_REASONING) (Trọng số: -5.0)
- **[Reliability]** src/api/routers/audit.py: Hàm `AuditState.reset()` xóa sạch danh sách log toàn cục (`AuditState.logs`) mỗi khi một cuộc kiểm toán mới bắt đầu. Trong mô hình FastAPI với BackgroundTasks, nếu User A đang xem log của Job A qua SSE (`/audit/logs`), và User B bắt đầu một Job mới, toàn bộ lịch sử log của User A sẽ bị xóa khỏi stream, gây mất dữ liệu hiển thị thời gian thực. (Rule: AI_REASONING) (Trọng số: -4.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `AI_REASONING` | Maintainability, Performance, Reliability, Security | 18 | -76.0 |
| `UNCHECKED_NONE_RETURN` | Reliability | 3 | -13.0 |
| `MISLEADING_NAME` | Maintainability, Performance | 2 | -4.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **LongDD** | 2817 | 34.74 | 265m |

#### 🔍 Chi tiết lỗi theo Thành viên

**LongDD** (Top 5 vi phạm nặng nhất):
- [Security] src/engine/discovery.py:105 - Cơ chế 'Code Injection by Design'. Hàm 'run_discovery' thực hiện ghi một kịch bản Python mới ('ai_precheck.py') vào thư mục đích (target_dir) và thực thi nó bằng 'subprocess.run'. Nếu người dùng có quyền ghi vào thư mục này hoặc nếu 'target_dir' là một repo không tin cậy, điều này cho phép thực thi mã tùy ý trong môi trường của Auditor. Ngoài ra, việc thực thi python3 mà không thông qua venv hiện tại có thể dẫn đến sai lệch library. (Rule: AI_REASONING)
- [Reliability] src/engine/database.py:34 - Sử dụng 'psycopg2.pool.SimpleConnectionPool' trong một kiến trúc có sử dụng Asyncio/Concurrency. Theo tài liệu của psycopg2, SimpleConnectionPool không thread-safe. Trong môi trường kiểm toán mã nguồn quy mô lớn hoặc chạy tích hợp trong web server, điều này có thể dẫn đến lỗi tranh chấp kết nối (connection race conditions) hoặc hỏng trạng thái pool nội bộ. (Rule: AI_REASONING)
- [Reliability] src/engine/dependency_checker.py:32 - Lỗi logic ánh xạ module (Short Name Collision). Hàm '_build_mappings' sử dụng tên file ngắn (basename) làm key trong 'mod_to_f'. Trong các dự án Python lớn, các file như 'models.py', 'utils.py' thường xuất hiện ở nhiều package khác nhau (vd: app1/models.py và app2/models.py). Việc chỉ lưu 'short_name' sẽ khiến ánh xạ sau ghi đè ánh xạ trước, dẫn đến việc phát hiện Circular Dependency sai lệch hoàn toàn hoặc bỏ sót các mối liên kết thực tế. (Rule: AI_REASONING)
- [Reliability] src/api/routers/audit.py:115 - Tên project được fix cứng là `"uploaded_project"` trong endpoint `/audit/process`. Khi nhiều người dùng upload code cùng lúc, `JobManager.create_job(project_name)` sẽ gây xung đột ID hoặc ghi đè trạng thái Job của nhau nếu JobManager sử dụng tên làm khóa định danh. (Rule: AI_REASONING)
- [Security] src/api/git_helper.py:78 - Biểu thức chính quy (Regex) dùng để ẩn Token trong lỗi Git (`(?<=://)[^@]+(?=@)`) có thể không lọc sạch thông tin nhạy cảm nếu cấu trúc thông báo lỗi của Git thay đổi (ví dụ: lỗi trong stderr hiển thị trực tiếp token mà không nằm trong URL). Việc lộ lọt Bitbucket Token ra log hệ thống là một rủi ro bảo mật nghiêm trọng. (Rule: AI_REASONING)
