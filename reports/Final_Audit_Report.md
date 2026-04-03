# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-03 04:55:39

## ĐIỂM TỔNG DỰ ÁN: 32.43 / 100 (🚨 Cần cải thiện ngay)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 3518
- Tổng số file: 24
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 0 |
| ⚠️ Major | 6 |
| ℹ️ Minor | 29 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 3.69 | 🚨 Nguy cơ |
| Maintainability | 5.54 | 🚨 Nguy cơ |
| Reliability | 1.01 | 🚨 Nguy cơ |
| Security | 1.83 | 🚨 Nguy cơ |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `root` (LOC: 19)
**Điểm tính năng: 61.0 / 100** (Nợ: 65m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -3.0 | 4.0 |
| Maintainability | 0 | 10.0 |
| Reliability | -18.0 | 1.0 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `src` (LOC: 3229)
**Điểm tính năng: 29.3 / 100** (Nợ: 305m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -14.0 | 3.16 |
| Maintainability | -10.0 | 5.64 |
| Reliability | -60.0 | 0.97 |
| Security | -13.0 | 1.1 |

---
#### 🔹 Tính năng: `tests` (LOC: 270)
**Điểm tính năng: 67.86 / 100** (Nợ: 85m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -6.0 | 4.0 |
| Reliability | -12.0 | 1.43 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** src/engine/ai_service.py: Import 'ValidationError' might be unused (AST). AI Note: Dựa trên phân tích AST, 'ValidationError' được import từ pydantic nhưng không được sử dụng trong logic của file. Đây là một lãng phí tài nguyên và làm giảm tính Maintainability. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Performance]** src/engine/dependency_checker.py: Cyclomatic Complexity too high (Too many nested loops/branches): detect_circular_dependencies (Complexity: 21 > 20). AI Note: Chỉ số Cyclomatic Complexity là 21, vượt quá ngưỡng cho phép (20). Điều này cho thấy hàm 'detect_circular_dependencies' đang xử lý quá nhiều điều kiện logic lồng nhau, gây khó khăn cho việc bảo trì và kiểm thử. (Rule: HIGH_COMPLEXITY) (Trọng số: -2.0)
- **[Reliability]** src/engine/dependency_checker.py: Swallowed exception (except block has only 'pass'). AI Note: Đoạn mã sử dụng 'except Exception as e: pass' để nuốt mọi lỗi xảy ra mà không ghi log hay xử lý lại. Đây là một lỗi Reliability nghiêm trọng vì nó có thể che giấu các lỗi runtime không mong muốn như KeyError hoặc TypeError. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Maintainability]** src/engine/dependency_checker.py: Import 'logging' might be unused (AST). AI Note: Thư viện 'logging' được import nhưng không xuất hiện trong các lời gọi hàm phía dưới. Đây là lỗi import thừa theo kết quả phân tích AST. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Performance]** src/engine/scanners.py: Cyclomatic Complexity too high (Too many nested loops/branches): scan (Complexity: 24 > 20). AI Note: Độ phức tạp Cyclomatic (Cyclomatic Complexity - CC) đạt mức 24, vượt qua ngưỡng cho phép là 20. Đây là một lỗi thật (True Positive) vì trong các engine quét mã, hàm 'scan' thường là hàm điều phối chính. Khi hàm này xử lý quá nhiều logic (vòng lặp duyệt rules, duyệt file, các điều kiện rẽ nhánh cho từng loại cây AST), nó trở nên cực kỳ khó bảo trì và kiểm thử. Mặc dù được xếp vào trụ cột Performance, nhưng CC cao thường tỷ lệ thuận với việc thực thi nhiều chỉ thị rẽ nhánh trong bytecode, có thể làm chậm quá trình quét khi xử lý codebase lớn. (Rule: HIGH_COMPLEXITY) (Trọng số: -2.0)
- **[Performance]** src/engine/scanners.py: Cyclomatic Complexity too high (Too many nested loops/branches): _check_calls (Complexity: 24 > 20). AI Note: Vi phạm này là lỗi thật (True Positive). Phương thức '_check_calls' có CC là 24, cho thấy nó đang chứa quá nhiều logic lồng nhau hoặc các chuỗi if-elif dày đặc để kiểm tra các loại node (ast.Name, ast.Attribute) và các tham số hàm. Trong phân tích tĩnh, việc gộp quá nhiều logic kiểm tra vào một hàm duy nhất không chỉ gây khó khăn cho việc bảo trì mà còn ảnh hưởng đến hiệu suất thực thi do chi phí kiểm tra điều kiện liên tục. Phương thức này nên được tách nhỏ thành các hàm phụ trợ hoặc sử dụng pattern Visitor chuyên biệt. (Rule: HIGH_COMPLEXITY) (Trọng số: -2.0)
- **[Reliability]** src/api/audit_state.py: Sử dụng Class Variables (is_cancelled, is_running) để quản lý trạng thái trong môi trường đa luồng (FastAPI/Uvicorn) dẫn đến lỗi logic nghiêm trọng. Nếu một Request gọi AuditState.cancel(), toàn bộ các tiến trình Audit khác của tất cả người dùng khác sẽ bị dừng do dùng chung vùng nhớ Class-level. (Rule: AI_REASONING) (Trọng số: -7.0)
- **[Reliability]** src/api/api_server.py: Ép kiểu int() trực tiếp từ biến môi trường OS (PORT) mà không có khối try/except bảo vệ. Nếu giá trị PORT bị cấu hình sai (vd: 'abc'), server sẽ crash ngay khi khởi động. Đây là lỗi Unsafe type coercion trên input bên ngoài. (Rule: SILENT_DATA_CORRUPTION) (Trọng số: -5.0)
- **[Reliability]** src/api/audit_state.py: Race Condition & Data Loss: Hàm JobManager.create_job thực hiện cls.legacy_logs.clear() mỗi khi có một Job mới được tạo. Trong môi trường API có nhiều người dùng cùng lúc, việc khởi tạo Job A sẽ xóa sạch toàn bộ log đang hiển thị của Job B nếu hai Job này bắt đầu gần nhau. (Rule: AI_REASONING) (Trọng số: -6.0)
- **[Security]** src/api/git_helper.py: Việc xử lý che giấu Token trong lỗi Git chỉ sử dụng .replace(token, '***') là không triệt để. Nếu URL chứa credentials được định dạng theo cách khác hoặc token bị URL-encoded trong output của Git, thông tin nhạy cảm vẫn có thể bị leak qua Exception message trả về cho API client. (Rule: AI_REASONING) (Trọng số: -5.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `AI_REASONING` | Maintainability, Performance, Reliability, Security | 22 | -95.0 |
| `UNCHECKED_NONE_RETURN` | Reliability | 4 | -20.0 |
| `HIGH_COMPLEXITY` | Performance | 3 | -6.0 |
| `UNUSED_IMPORT` | Maintainability | 2 | -1.0 |
| `MISLEADING_NAME` | Maintainability | 2 | -4.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 1 | -5.0 |
| `SILENT_DATA_CORRUPTION` | Reliability | 1 | -5.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **LongDD** | 2734 | 23.38 | 360m |

#### 🔍 Chi tiết lỗi theo Thành viên

**LongDD** (Top 5 vi phạm nặng nhất):
- [Security] src/api/routers/audit.py:147 - The legacy '/audit' endpoint is vulnerable to Local File/Directory Information Disclosure. It accepts an arbitrary 'target' string and calls 'os.path.abspath(target)' without validation or sandboxing. An attacker could scan sensitive system directories (e.g., /etc, /root) by triggering an audit on those paths. (Rule: AI_REASONING)
- [Reliability] src/api/audit_state.py:86 - Sử dụng Class Variables (is_cancelled, is_running) để quản lý trạng thái trong môi trường đa luồng (FastAPI/Uvicorn) dẫn đến lỗi logic nghiêm trọng. Nếu một Request gọi AuditState.cancel(), toàn bộ các tiến trình Audit khác của tất cả người dùng khác sẽ bị dừng do dùng chung vùng nhớ Class-level. (Rule: AI_REASONING)
- [Reliability] src/engine/discovery.py:43 - Sử dụng 'os.walk' với tham số 'followlinks=True' mà không có cơ chế kiểm soát độ sâu hoặc kiểm tra vòng lặp symlink. Nếu thư mục mục tiêu chứa các symbolic link trỏ ngược lại thư mục cha (circular symlinks), trình quét sẽ rơi vào trạng thái đệ quy vô hạn dẫn đến treo hệ thống hoặc tràn bộ nhớ. (Rule: AI_REASONING)
- [Reliability] src/api/routers/audit.py:33 - Global process-level state pollution in 'run_auditor_with_capture'. Reassigning 'sys.stdout' to a custom stream is not thread-safe in a concurrent FastAPI environment. Multiple audit jobs will overwrite the global 'sys.stdout', causing 'Log Bleeding' where logs from one job are routed to the SSE stream of a different job. Furthermore, restoring 'sys.stdout' in a 'finally' block will prematurely stop logging for other concurrent tasks. (Rule: AI_REASONING)
- [Reliability] src/api/audit_state.py:38 - Race Condition & Data Loss: Hàm JobManager.create_job thực hiện cls.legacy_logs.clear() mỗi khi có một Job mới được tạo. Trong môi trường API có nhiều người dùng cùng lúc, việc khởi tạo Job A sẽ xóa sạch toàn bộ log đang hiển thị của Job B nếu hai Job này bắt đầu gần nhau. (Rule: AI_REASONING)
