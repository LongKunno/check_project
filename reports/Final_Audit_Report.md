# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-02 10:50:46

## ĐIỂM TỔNG DỰ ÁN: 99.45 / 100 (🏆 Xuất sắc)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 3411
- Tổng số file: 24
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 1 |
| ⚠️ Major | 27 |
| ℹ️ Minor | 43 |
| ℹ️ Info | 33 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 0.88 | 🚨 Nguy cơ |
| Maintainability | 2.06 | 🚨 Nguy cơ |
| Reliability | 0.48 | 🚨 Nguy cơ |
| Security | 1.09 | 🚨 Nguy cơ |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `root` (LOC: 19)
**Điểm tính năng: 1.92 / 100** (Nợ: 1394m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -71.0 | 0.14 |
| Maintainability | -52.5 | 0.37 |
| Reliability | -134.0 | 0.07 |
| Security | -14.0 | 0.18 |

---
#### 🔹 Tính năng: `src` (LOC: 3138)
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
- **[Maintainability]** src/api/api_server.py: Import 'io' might be unused (AST). AI Note: Import 'io' không được sử dụng ở bất kỳ đâu trong file /src/api/api_server.py. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Performance]** src/api/git_helper.py: Cyclomatic Complexity too high (Too many nested loops/branches): clone_repository (Complexity: 13 > 12). AI Note: Hàm 'clone_repository' có cấu trúc rẽ nhánh phức tạp với nhiều khối try-except lồng nhau và các điều kiện kiểm tra (if), dẫn đến độ phức tạp Cyclomatic thực tế vượt quá ngưỡng 12. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** src/api/git_helper.py: Import 'urllib.parse' might be unused (AST). AI Note: Import 'urllib.parse' không được sử dụng trực tiếp trong file /src/api/git_helper.py. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Performance]** src/api/routers/audit.py: Cyclomatic Complexity too high (Too many nested loops/branches): upload_and_audit (Complexity: 14 > 12). AI Note: Hàm 'upload_and_audit' chứa nhiều logic rẽ nhánh (if/else) để kiểm tra file, xử lý lỗi, và lồng ghép vòng lặp xử lý danh sách file. Việc quản lý nhiều luồng thực thi (exception handling, file type checking) khiến độ phức tạp vượt mức khuyến nghị. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Performance]** src/engine/dependency_checker.py: Cyclomatic Complexity too high (Too many nested loops/branches): detect_circular_dependencies (Complexity: 21 > 12). AI Note: Hàm 'detect_circular_dependencies' có cấu trúc lồng nhau rất phức tạp: xử lý tệp, phân tích AST, duyệt đồ thị để tìm chu trình (DFS lồng trong vòng lặp), cùng nhiều điều kiện rẽ nhánh. Độ phức tạp tính toán vượt quá ngưỡng khuyến nghị (12). (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Reliability]** src/engine/dependency_checker.py: Swallowed exception (except block has only 'pass'). AI Note: Khối 'except Exception: pass' nuốt mọi lỗi phát sinh trong quá trình phân tích AST hoặc xử lý phụ thuộc mà không có ghi nhật ký (log) hay xử lý cụ thể, điều này gây khó khăn cho việc gỡ lỗi khi có tệp bị hỏng hoặc lỗi định dạng. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Performance]** src/engine/ai_service.py: String concatenation using `+=` inside a loop is slow. Prefer `list.append()` and `''.join()`.. AI Note: Đoạn mã thực hiện nối chuỗi bằng toán tử `+=` bên trong một vòng lặp (dựa vào thụt đầu dòng và các biến i, v thường dùng trong enumerate). Trong Python, chuỗi là bất biến nên việc cộng chuỗi liên tục sẽ tạo ra nhiều đối tượng tạm thời, gây tốn bộ nhớ và giảm hiệu suất đáng kể so với việc dùng list.append() và ''.join(). (Rule: SLOW_STRING_CONCAT) (Trọng số: -3.0)
- **[Performance]** src/engine/ai_service.py: String concatenation using `+=` inside a loop is slow. Prefer `list.append()` and `''.join()`.. AI Note: Tương tự như vi phạm #0, việc nối chuỗi `items_prompt +=` diễn ra bên trong vòng lặp xử lý các kết quả (items). Đây là lỗi Performance True Positive theo quy tắc đã nêu. (Rule: SLOW_STRING_CONCAT) (Trọng số: -3.0)
- **[Performance]** src/engine/ai_service.py: String concatenation using `+=` inside a loop is slow. Prefer `list.append()` and `''.join()`.. AI Note: Đoạn mã này cũng thuộc cùng một khối logic lặp, thực hiện nối các chuỗi f-string vào biến `items_prompt`. Việc lặp lại hành động này nhiều lần trong vòng lặp là không tối ưu. (Rule: SLOW_STRING_CONCAT) (Trọng số: -3.0)
- **[Performance]** src/engine/ai_service.py: String concatenation using `+=` inside a loop is slow. Prefer `list.append()` and `''.join()`.. AI Note: Tiếp nối phần nội dung của các vi phạm trước đó, đây vẫn là hành vi nối chuỗi trong vòng lặp. Cần thay thế bằng cơ chế gom danh sách rồi mới join. (Rule: SLOW_STRING_CONCAT) (Trọng số: -3.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `PRINT_STATEMENT` | Maintainability | 32 | -16.0 |
| `AI_REASONING` | Maintainability, Performance, Reliability, Security | 14 | -54.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 11 | -55.0 |
| `SLOW_STRING_CONCAT` | Performance | 8 | -24.0 |
| `HIGH_COMPLEXITY` | Performance | 7 | -35.0 |
| `BARE_EXCEPT` | Reliability | 7 | -14.0 |
| `UNUSED_IMPORT` | Maintainability | 6 | -3.0 |
| `UNCHECKED_NONE_RETURN` | Reliability | 5 | -24.0 |
| `GOD_OBJECT` | Maintainability | 4 | -8.0 |
| `SILENT_DATA_CORRUPTION` | Reliability | 3 | -15.0 |
| `MISLEADING_NAME` | Maintainability | 2 | -6.0 |
| `TOO_MANY_PARAMS` | Maintainability | 1 | -3.0 |
| `SQL_INJECTION` | Security | 1 | -8.0 |
| `SELECT_STAR` | Performance | 1 | -2.0 |
| `FORGOTTEN_TODO` | Maintainability | 1 | -0.5 |
| `REDUNDANT_DB_QUERY` | Performance | 1 | -4.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **LongDD** | 3104 | 10.49 | 1369m |

#### 🔍 Chi tiết lỗi theo Thành viên

**LongDD** (Top 5 vi phạm nặng nhất):
- [Security] src/engine/database.py:114 - Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Câu lệnh SQL sử dụng f-string (`f'...'`) để chèn biến `query_cols` trực tiếp vào chuỗi truy vấn. Đây là hành vi nối chuỗi (string interpolation) không an toàn, có thể dẫn đến tấn công SQL Injection nếu `query_cols` bị kẻ tấn công kiểm soát hoặc chứa nội dung không được kiểm chứng. (Rule: SQL_INJECTION)
- [Security] src/api/git_helper.py:69 - Cơ chế lọc thông tin nhạy cảm trong log lỗi bị hổng. Bạn sử dụng '.replace(token, "***")' để giấu App Password, nhưng trước đó token đã được URL-encoded bằng 'urllib.parse.quote(token)'. Nếu token chứa các ký tự đặc biệt (ví dụ: #, @, :), chuỗi xuất hiện trong lỗi của Git (thường là URL thô) sẽ ở dạng encoded và phép so sánh chuỗi nguyên bản sẽ thất bại, dẫn đến việc lộ token thật vào log hệ thống. (Rule: AI_REASONING)
- [Performance] src/api/git_helper.py:12 - Cyclomatic Complexity too high (Too many nested loops/branches): clone_repository (Complexity: 13 > 12). AI Note: Hàm 'clone_repository' có cấu trúc rẽ nhánh phức tạp với nhiều khối try-except lồng nhau và các điều kiện kiểm tra (if), dẫn đến độ phức tạp Cyclomatic thực tế vượt quá ngưỡng 12. (Rule: HIGH_COMPLEXITY)
- [Performance] src/api/routers/audit.py:92 - Cyclomatic Complexity too high (Too many nested loops/branches): upload_and_audit (Complexity: 14 > 12). AI Note: Hàm 'upload_and_audit' chứa nhiều logic rẽ nhánh (if/else) để kiểm tra file, xử lý lỗi, và lồng ghép vòng lặp xử lý danh sách file. Việc quản lý nhiều luồng thực thi (exception handling, file type checking) khiến độ phức tạp vượt mức khuyến nghị. (Rule: HIGH_COMPLEXITY)
- [Performance] src/engine/dependency_checker.py:11 - Cyclomatic Complexity too high (Too many nested loops/branches): detect_circular_dependencies (Complexity: 21 > 12). AI Note: Hàm 'detect_circular_dependencies' có cấu trúc lồng nhau rất phức tạp: xử lý tệp, phân tích AST, duyệt đồ thị để tìm chu trình (DFS lồng trong vòng lặp), cùng nhiều điều kiện rẽ nhánh. Độ phức tạp tính toán vượt quá ngưỡng khuyến nghị (12). (Rule: HIGH_COMPLEXITY)
