# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-21 09:53:01

## ĐIỂM TỔNG DỰ ÁN: 98.26 / 100 (🏆 Excellent)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 10331
- Tổng số file: 24
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 0 |
| ⚠️ Major | 2 |
| ℹ️ Minor | 9 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 10.0 | ✅ Tốt |
| Maintainability | 9.97 | ✅ Tốt |
| Reliability | 9.51 | ✅ Tốt |
| Security | 9.66 | ✅ Tốt |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `src_root` (LOC: 328)
**Điểm tính năng: 88.06 / 100** (Nợ: 95m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -2.5 | 9.09 |
| Reliability | -14.0 | 5.17 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `api` (LOC: 2977)
**Điểm tính năng: 95.28 / 100** (Nợ: 50m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | -6.0 | 8.82 |
| Security | -4.0 | 8.82 |

---
#### 🔹 Tính năng: `engine` (LOC: 7026)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Reliability]** src/config.py: Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Dù có khả năng mục đích là fallback khi parse cấu hình thất bại, việc bắt `Exception` là quá rộng. Với đoạn `return _parse_int_setting(...)` thì các lỗi lập trình không mong muốn cũng sẽ bị che giấu chứ không chỉ lỗi parse hợp lệ như `ValueError`/`TypeError`. Vì vậy cảnh báo 'bắt ngoại lệ quá chung chung và không xử lý gì' là hợp lệ. (Rule: BARE_EXCEPT) (Điểm phạt: -2.0)
- **[Reliability]** src/config.py: Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Việc dùng `except Exception: pass` quanh `return str(val).strip()` là bắt ngoại lệ quá rộng và không xử lý gì. Nếu mục tiêu chỉ là bỏ qua giá trị không chuyển được sang chuỗi thì nên bắt ngoại lệ cụ thể hơn; còn bắt mọi `Exception` có thể che giấu lỗi bất thường từ `__str__` hoặc đối tượng lỗi. Vì vậy đây là True Positive. (Rule: BARE_EXCEPT) (Điểm phạt: -2.0)
- **[Reliability]** src/config.py: Swallowed exception (except block has only 'pass'). AI Note: Đây nhiều khả năng là lỗi thật. Khối `except Exception: pass` đang nuốt toàn bộ exception mà không log, không raise lại, cũng không giới hạn loại lỗi cụ thể. Dù trong code cấu hình đôi khi có chủ đích fallback khi parse thất bại, cách làm an toàn hơn là bắt exception cụ thể (ví dụ `ValueError`, `TypeError`) và trả về giá trị mặc định rõ ràng. Với đoạn hiện tại, mọi lỗi bất ngờ cũng bị che giấu, làm khó chẩn đoán và giảm độ tin cậy. (Rule: SWALLOWED_EXCEPTION) (Điểm phạt: -5.0)
- **[Security]** src/api/api_server.py: Middleware `_apply_browser_headers` luôn gắn `Access-Control-Allow-Private-Network: true` cho mọi response, kể cả preflight, trong khi không có kiểm tra Origin/host nội bộ tương ứng. Đồng thời parser multipart bị monkey-patch để nâng `max_files` và `max_fields` lên 10000. Kết hợp 2 quyết định này làm tăng bề mặt tấn công từ trình duyệt vào mạng private và tăng chi phí xử lý request lớn bất thường; comment nói 'hạn chế DoS' nhưng thực tế lại nới rộng giới hạn đáng kể. Đây là lỗi logic/bảo mật khó bị regex bắt vì nằm ở sự tương tác giữa header PNA, CORS và upload limits. (Rule: AI_REASONING) (Điểm phạt: -2.0)
- **[Reliability]** src/api/audit_state.py: `JobManager` giữ state toàn cục trong `jobs` và `job_logs` rồi cập nhật từ nhiều request/thread khác nhau nhưng không có bất kỳ lock/thread-safety nào. Các hàm như `create_job`, `update_job`, `request_cancel`, `log`, `cleanup_old_jobs` đều mutate shared dict/list trực tiếp. Trong môi trường FastAPI + background thread + logging handler, điều này có thể gây race condition: mất log, ghi đè trạng thái, hoặc đọc trạng thái nửa vời giữa lúc cleanup đang xóa job. (Rule: AI_REASONING) (Điểm phạt: -2.0)
- **[Reliability]** src/api/audit_state.py: `JobManager.log()` tính thứ tự log bằng `len(cls.job_logs[job_id])` rồi append và persist riêng lẻ. Khi hai luồng cùng ghi log cho cùng một job, cả hai có thể đọc cùng một độ dài trước khi append, dẫn tới duplicate/out-of-order sequence khi gọi `AuditDatabase.append_runtime_job_log(...)`. Đây là lỗi tranh chấp dữ liệu tinh vi, dễ gây sai lệch timeline/log stream mà static scan đơn giản khó nhận ra. (Rule: AI_REASONING) (Điểm phạt: -2.0)
- **[Maintainability]** src/config.py: Hàm `_db_config_available()` có tên gợi ý rằng nó kiểm tra khả năng truy cập DB, nhưng thực tế luôn `return True`. Tên gọi khiến người đọc tin rằng có probe/health-check thật, trong khi mọi getter sau đó luôn cố đọc DB và chỉ silently fallback khi exception xảy ra. Đây là tên gây hiểu lầm trực tiếp về hành vi runtime. (Rule: MISLEADING_NAME) (Điểm phạt: -1.0)
- **[Maintainability]** src/config.py: Nhiều hàm getter đặt import bên trong thân hàm như `get_ai_enabled`, `get_ai_mode`, `get_test_mode_limit`, `get_openai_batch_api_key`, `get_auth_required`... Việc này vi phạm tinh thần PEP8 E402 và làm phân mảnh dependency management. Dù đôi khi import cục bộ được dùng để tránh circular import, ở đây pattern xuất hiện dày đặc trên gần như mọi accessor cấu hình, cho thấy vấn đề kiến trúc/dependency chứ không còn là ngoại lệ cục bộ. (Rule: PEP8_MODULE_LEVEL_IMPORTS) (Điểm phạt: -1.5)
- **[Reliability]** src/config.py: `get_test_mode_limit()` đọc giá trị từ DB rồi dùng `return int(val)` trực tiếp, không áp dụng range guard như `_parse_int_setting`. Nếu DB chứa giá trị âm hoặc dữ liệu ngoài miền hợp lệ, hệ thống có thể vào trạng thái test-mode sai (ví dụ số âm) hoặc fallback im lặng khi exception xảy ra. Đây là inconsistency với chính contract comment của module, có thể làm logic giới hạn file bị sai lệch bởi dữ liệu cấu hình bên ngoài. (Rule: SILENT_DATA_CORRUPTION) (Điểm phạt: -5.0)
- **[Security]** src/api/git_helper.py: `clone_repository()` tạo `clone_url` chứa `username:token@...` rồi nếu xảy ra lỗi sẽ log `e.stderr` trước khi sanitize (`logger.error(f"Git clone failed. Command output: {e.stderr}")`). Nghĩa là secret có thể đã bị ghi vào log backend trước khi `error_msg` được che token cho người dùng cuối. Đây là rò rỉ credential tinh vi qua đường log nội bộ, đặc biệt nguy hiểm vì nhiều hệ thống tập trung log ra ngoài. (Rule: AI_REASONING) (Điểm phạt: -2.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `AI_REASONING` | Reliability, Security | 5 | -10.0 |
| `BARE_EXCEPT` | Reliability | 2 | -4.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 1 | -5.0 |
| `MISLEADING_NAME` | Maintainability | 1 | -1.0 |
| `PEP8_MODULE_LEVEL_IMPORTS` | Maintainability | 1 | -1.5 |
| `SILENT_DATA_CORRUPTION` | Reliability | 1 | -5.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **longdd@liftsoft.vn** | 1044 | 88.43 | 145m |

#### 🔍 Chi tiết lỗi theo Thành viên

**longdd@liftsoft.vn** (Top 5 vi phạm nặng nhất):
- [Reliability] src/config.py:221 - Swallowed exception (except block has only 'pass'). AI Note: Đây nhiều khả năng là lỗi thật. Khối `except Exception: pass` đang nuốt toàn bộ exception mà không log, không raise lại, cũng không giới hạn loại lỗi cụ thể. Dù trong code cấu hình đôi khi có chủ đích fallback khi parse thất bại, cách làm an toàn hơn là bắt exception cụ thể (ví dụ `ValueError`, `TypeError`) và trả về giá trị mặc định rõ ràng. Với đoạn hiện tại, mọi lỗi bất ngờ cũng bị che giấu, làm khó chẩn đoán và giảm độ tin cậy. (Rule: SWALLOWED_EXCEPTION)
- [Reliability] src/config.py:107 - `get_test_mode_limit()` đọc giá trị từ DB rồi dùng `return int(val)` trực tiếp, không áp dụng range guard như `_parse_int_setting`. Nếu DB chứa giá trị âm hoặc dữ liệu ngoài miền hợp lệ, hệ thống có thể vào trạng thái test-mode sai (ví dụ số âm) hoặc fallback im lặng khi exception xảy ra. Đây là inconsistency với chính contract comment của module, có thể làm logic giới hạn file bị sai lệch bởi dữ liệu cấu hình bên ngoài. (Rule: SILENT_DATA_CORRUPTION)
- [Reliability] src/config.py:152 - Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Dù có khả năng mục đích là fallback khi parse cấu hình thất bại, việc bắt `Exception` là quá rộng. Với đoạn `return _parse_int_setting(...)` thì các lỗi lập trình không mong muốn cũng sẽ bị che giấu chứ không chỉ lỗi parse hợp lệ như `ValueError`/`TypeError`. Vì vậy cảnh báo 'bắt ngoại lệ quá chung chung và không xử lý gì' là hợp lệ. (Rule: BARE_EXCEPT)
- [Reliability] src/config.py:167 - Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Việc dùng `except Exception: pass` quanh `return str(val).strip()` là bắt ngoại lệ quá rộng và không xử lý gì. Nếu mục tiêu chỉ là bỏ qua giá trị không chuyển được sang chuỗi thì nên bắt ngoại lệ cụ thể hơn; còn bắt mọi `Exception` có thể che giấu lỗi bất thường từ `__str__` hoặc đối tượng lỗi. Vì vậy đây là True Positive. (Rule: BARE_EXCEPT)
- [Security] src/api/api_server.py:18 - Middleware `_apply_browser_headers` luôn gắn `Access-Control-Allow-Private-Network: true` cho mọi response, kể cả preflight, trong khi không có kiểm tra Origin/host nội bộ tương ứng. Đồng thời parser multipart bị monkey-patch để nâng `max_files` và `max_fields` lên 10000. Kết hợp 2 quyết định này làm tăng bề mặt tấn công từ trình duyệt vào mạng private và tăng chi phí xử lý request lớn bất thường; comment nói 'hạn chế DoS' nhưng thực tế lại nới rộng giới hạn đáng kể. Đây là lỗi logic/bảo mật khó bị regex bắt vì nằm ở sự tương tác giữa header PNA, CORS và upload limits. (Rule: AI_REASONING)
