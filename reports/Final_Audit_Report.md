# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-15 14:24:59

## ĐIỂM TỔNG DỰ ÁN: 86.98 / 100 (🥈 Good)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 5446
- Tổng số file: 21
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 0 |
| ⚠️ Major | 9 |
| ℹ️ Minor | 34 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 9.24 | ✅ Tốt |
| Maintainability | 9.11 | ✅ Tốt |
| Reliability | 6.53 | ⚠️ Cần cải thiện |
| Security | 9.39 | ✅ Tốt |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `src_root` (LOC: 192)
**Điểm tính năng: 88.25 / 100** (Nợ: 100m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -1.5 | 9.43 |
| Reliability | -16.0 | 4.84 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `api` (LOC: 1888)
**Điểm tính năng: 82.76 / 100** (Nợ: 165m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -4.0 | 9.04 |
| Maintainability | -5.5 | 8.96 |
| Reliability | -18.0 | 6.11 |
| Security | -4.0 | 8.25 |

---
#### 🔹 Tính năng: `engine` (LOC: 3366)
**Điểm tính năng: 89.28 / 100** (Nợ: 230m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -5.0 | 9.31 |
| Maintainability | -7.5 | 9.18 |
| Reliability | -23.0 | 6.87 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** src/engine/auditor.py: Import 'time' might be unused (AST). AI Note: Trong tệp /tmp/git_audit_qqcb6law/repo/src/engine/auditor.py, dòng 'import time' được khai báo bên trong phương thức 'run' nhưng biến 'time' không được sử dụng ở bất kỳ đâu trong phạm vi phương thức hoặc tệp này. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Performance]** src/engine/database.py: N+1 Query Pattern Detected (DB/API Call inside a loop). Found 'cursor.execute()' inside loop.. AI Note: Trong tệp /tmp/git_audit_qqcb6law/repo/src/engine/database.py, hàm 'save_repositories' thực hiện lặp qua danh sách 'repositories' và gọi 'cursor.execute' cho mỗi phần tử để thực hiện lệnh INSERT. Đây là mô hình N+1 Query điển hình và có thể được tối ưu hóa bằng cách sử dụng 'executemany' để cải thiện hiệu suất. (Rule: N_PLUS_ONE) (Trọng số: -5.0)
- **[Reliability]** src/engine/dependency_checker.py: Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Trong tệp /tmp/git_audit_qqcb6law/repo/src/engine/dependency_checker.py, khối lệnh bắt ngoại lệ 'Exception' quá chung chung. Mặc dù có ghi chú là bỏ qua lỗi phân tích cú pháp cho các tệp không chuẩn, việc bắt mọi loại lỗi (bao gồm cả lỗi logic hoặc lỗi hệ thống không mong muốn) mà không log lại là một rủi ro về độ tin cậy. (Rule: BARE_EXCEPT) (Trọng số: -2.0)
- **[Reliability]** src/engine/dependency_checker.py: Swallowed exception (except block has only 'pass'). AI Note: Trong tệp /tmp/git_audit_qqcb6law/repo/src/engine/dependency_checker.py, ngoại lệ được bắt và bỏ qua hoàn toàn bằng lệnh 'pass' mà không có hành động xử lý, ghi log hoặc ném lại lỗi. Ngay cả khi đây là hành động có chủ đích, việc 'nuốt' ngoại lệ trong im lặng mà không ghi lại vết tích để debug sau này vẫn được coi là một lỗi về Reliability. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Reliability]** src/config.py: Swallowed exception (except block has only 'pass'). AI Note: Việc bắt mọi Exception và 'pass' khi xử lý cấu hình mà không có log hoặc giá trị mặc định rõ ràng là lỗi Reliability. Nếu 'val' bị None hoặc có kiểu dữ liệu lạ, nó sẽ âm thầm lỗi, gây khó khăn cho việc debug cấu hình. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Maintainability]** src/engine/auditor.py: Function too long (God Object anti-pattern): _step_aggregation (> 150 lines). AI Note: Một hàm dài hơn 150 dòng vi phạm nguyên tắc Single Responsibility và gây khó khăn cho việc bảo trì, kiểm thử. Đây là một True Positive về mặt Maintainability. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Reliability]** src/engine/auditor.py: Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Bắt Exception chung chung khi trích xuất snippet code mà không xử lý gì là lỗi. Mặc dù có vẻ là để tránh crash khi hiển thị giao diện, nhưng việc không log lại lỗi (ví dụ: IndexError hoặc FileNotFoundError) khiến lập trình viên không biết tại sao snippet không hiển thị. (Rule: BARE_EXCEPT) (Trọng số: -2.0)
- **[Reliability]** src/engine/auditor.py: Swallowed exception (except block has only 'pass'). AI Note: Tương tự vi phạm #3, việc sử dụng 'except Exception: pass' là quá rộng và che giấu các vấn đề tiềm ẩn trong logic xử lý chuỗi/mảng. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Reliability]** src/config.py: Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Đây là lỗi thật (True Positive). Việc bắt ngoại lệ 'Exception' là quá chung chung (broad exception). Trong đoạn mã này, nếu 'val' không phải là chuỗi (ví dụ: None), nó sẽ gây ra AttributeError. Việc sử dụng Exception có thể vô tình che giấu các lỗi hệ thống hoặc lỗi lập trình nghiêm trọng khác thay vì chỉ xử lý lỗi chuyển đổi dữ liệu cấu hình. (Rule: BARE_EXCEPT) (Trọng số: -2.0)
- **[Reliability]** src/config.py: Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except). AI Note: Đây là lỗi thật (True Positive). Khi thực hiện ép kiểu 'int(val)', mã nguồn chỉ nên bắt các ngoại lệ cụ thể như 'ValueError' hoặc 'TypeError'. Việc bắt toàn bộ 'Exception' vi phạm nguyên tắc Reliability vì nó làm giảm khả năng kiểm soát các lỗi phát sinh không mong muốn. (Rule: BARE_EXCEPT) (Trọng số: -2.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `AI_REASONING` | Reliability, Security | 13 | -25.0 |
| `PEP8_MODULE_LEVEL_IMPORTS` | Maintainability | 10 | -15.0 |
| `BARE_EXCEPT` | Reliability | 5 | -10.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 3 | -15.0 |
| `NAIVE_DATETIME` | Reliability | 2 | -4.0 |
| `UNCHECKED_NONE_RETURN` | Reliability | 2 | -10.0 |
| `UNUSED_IMPORT` | Maintainability | 1 | -0.5 |
| `N_PLUS_ONE` | Performance | 1 | -5.0 |
| `GOD_OBJECT` | Maintainability | 1 | -2.0 |
| `MUTATING_COLLECTION_ITERATION` | Reliability | 1 | -6.0 |
| `MISLEADING_NAME` | Maintainability | 1 | -1.0 |
| `SHADOWING_BUILTINS` | Maintainability | 1 | -2.0 |
| `REDUNDANT_DB_QUERY` | Performance | 1 | -4.0 |
| `SILENT_DATA_CORRUPTION` | Reliability | 1 | -5.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **longdd@liftsoft.vn** | 5446 | 85.36 | 495m |

#### 🔍 Chi tiết lỗi theo Thành viên

**longdd@liftsoft.vn** (Top 5 vi phạm nặng nhất):
- [Reliability] src/api/routers/audit.py:273 - Vòng lặp trong `audit_batch` và `get_active_batch` duyệt qua `JobManager.jobs.items()` trực tiếp. Khi có nhiều request đồng thời, nếu một thread khác tạo job mới (gọi `create_job` -> `cleanup_old_jobs`), cấu trúc dictionary sẽ bị thay đổi, gây ra lỗi `RuntimeError: dictionary changed size during iteration`. (Rule: MUTATING_COLLECTION_ITERATION)
- [Performance] src/engine/database.py:600 - N+1 Query Pattern Detected (DB/API Call inside a loop). Found 'cursor.execute()' inside loop.. AI Note: Trong tệp /tmp/git_audit_qqcb6law/repo/src/engine/database.py, hàm 'save_repositories' thực hiện lặp qua danh sách 'repositories' và gọi 'cursor.execute' cho mỗi phần tử để thực hiện lệnh INSERT. Đây là mô hình N+1 Query điển hình và có thể được tối ưu hóa bằng cách sử dụng 'executemany' để cải thiện hiệu suất. (Rule: N_PLUS_ONE)
- [Reliability] src/engine/dependency_checker.py:66 - Swallowed exception (except block has only 'pass'). AI Note: Trong tệp /tmp/git_audit_qqcb6law/repo/src/engine/dependency_checker.py, ngoại lệ được bắt và bỏ qua hoàn toàn bằng lệnh 'pass' mà không có hành động xử lý, ghi log hoặc ném lại lỗi. Ngay cả khi đây là hành động có chủ đích, việc 'nuốt' ngoại lệ trong im lặng mà không ghi lại vết tích để debug sau này vẫn được coi là một lỗi về Reliability. (Rule: SWALLOWED_EXCEPTION)
- [Reliability] src/config.py:85 - Swallowed exception (except block has only 'pass'). AI Note: Việc bắt mọi Exception và 'pass' khi xử lý cấu hình mà không có log hoặc giá trị mặc định rõ ràng là lỗi Reliability. Nếu 'val' bị None hoặc có kiểu dữ liệu lạ, nó sẽ âm thầm lỗi, gây khó khăn cho việc debug cấu hình. (Rule: SWALLOWED_EXCEPTION)
- [Reliability] src/engine/auditor.py:371 - Swallowed exception (except block has only 'pass'). AI Note: Tương tự vi phạm #3, việc sử dụng 'except Exception: pass' là quá rộng và che giấu các vấn đề tiềm ẩn trong logic xử lý chuỗi/mảng. (Rule: SWALLOWED_EXCEPTION)
