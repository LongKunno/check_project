# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-24 01:33:58

## ĐIỂM TỔNG DỰ ÁN: 90.9 / 100 (🏆 Excellent)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 14420
- Tổng số file: 27
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 0 |
| 🔥 Critical | 5 |
| ⚠️ Major | 5 |
| ℹ️ Minor | 27 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 10.0 | ✅ Tốt |
| Maintainability | 9.16 | ✅ Tốt |
| Reliability | 8.64 | ✅ Tốt |
| Security | 7.85 | ⚠️ Cần cải thiện |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `src_root` (LOC: 430)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `api` (LOC: 3299)
**Điểm tính năng: 96.28 / 100** (Nợ: 75m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -9.5 | 8.97 |
| Reliability | 0 | 10.0 |
| Security | -2.0 | 9.43 |

---
#### 🔹 Tính năng: `engine` (LOC: 10691)
**Điểm tính năng: 88.88 / 100** (Nợ: 610m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -23.5 | 9.19 |
| Reliability | -36.0 | 8.17 |
| Security | -40.0 | 7.28 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** src/engine/ai_telemetry.py: Function too long (God Object anti-pattern): get_overview (> 150 lines). AI Note: Thông báo cho thấy hàm get_overview vượt quá 150 dòng và độ phức tạp cyclomatic 33 > 25. Với ngưỡng như vậy, đây nhiều khả năng là vi phạm thật của maintainability (hàm quá dài/quá phức tạp), không phải báo lỗi sai. (Rule: GOD_OBJECT) (Điểm phạt: -2.0)
- **[Maintainability]** src/engine/ai_telemetry.py: Cyclomatic Complexity too high (Too many nested loops/branches): get_overview (Complexity: 33 > 25). AI Note: Cyclomatic complexity được báo là 33, cao hơn ngưỡng 25. Đây thường là dấu hiệu thật của hàm có nhiều nhánh/điều kiện và cần refactor, nên tôi xem đây là True Positive. (Rule: HIGH_COMPLEXITY) (Điểm phạt: -2.0)
- **[Maintainability]** src/engine/ai_telemetry.py: Cyclomatic Complexity too high (Too many nested loops/branches): get_filter_metadata (Complexity: 30 > 25). AI Note: Không có đủ ngữ cảnh để bác bỏ cảnh báo, và báo cáo độ phức tạp cyclomatic 30 > 25 là một vi phạm hợp lệ nếu công cụ phân tích đã đo đúng trên hàm `get_filter_metadata`. (Rule: HIGH_COMPLEXITY) (Điểm phạt: -2.0)
- **[Maintainability]** src/engine/ai_telemetry.py: Cyclomatic Complexity too high (Too many nested loops/branches): _filter_memory_rows (Complexity: 26 > 25). AI Note: Tương tự #3, cảnh báo về độ phức tạp cyclomatic 26 > 25 là hợp lệ theo số đo được cung cấp, nên xem là lỗi thật nếu kết quả phân tích tĩnh là chính xác. (Rule: HIGH_COMPLEXITY) (Điểm phạt: -2.0)
- **[Reliability]** src/engine/ai_telemetry.py: Swallowed exception (except block has only 'pass'). AI Note: Đây là một `except Exception: pass` đúng nghĩa nuốt exception im lặng: không log, không raise lại. Với đoạn snippet này không có dấu hiệu rõ ràng là chủ đích bỏ qua lỗi quan trọng, nên nên xem là lỗi thật. (Rule: SWALLOWED_EXCEPTION) (Điểm phạt: -5.0)
- **[Reliability]** src/engine/ai_telemetry.py: Swallowed exception (except block has only 'pass'). AI Note: Tương tự vi phạm #0, đây là `except Exception: pass` không xử lý gì thêm, nên exception bị nuốt im lặng. Không thấy dấu hiệu đây là bỏ qua lỗi có chủ đích. (Rule: SWALLOWED_EXCEPTION) (Điểm phạt: -5.0)
- **[Maintainability]** src/engine/auditor.py: Function too long (God Object anti-pattern): _step_ai_reasoning (> 150 lines). AI Note: Thông tin cho thấy hàm `_step_ai_reasoning` vượt quá ngưỡng 150 dòng theo rule kiểm tra. Đây là cảnh báo maintainability hợp lệ, không phải false positive dựa trên mô tả hiện có. (Rule: GOD_OBJECT) (Điểm phạt: -2.0)
- **[Maintainability]** src/engine/auditor.py: Function too long (God Object anti-pattern): _step_ai_reasoning_batch_api (> 150 lines). AI Note: Thông tin cho thấy hàm `_step_ai_reasoning_batch_api` vượt quá ngưỡng 150 dòng theo rule kiểm tra. Đây là cảnh báo maintainability hợp lệ, không phải false positive dựa trên mô tả hiện có. (Rule: GOD_OBJECT) (Điểm phạt: -2.0)
- **[Security]** src/engine/ai_telemetry.py: Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Đoạn trích chỉ cho thấy `cursor.execute(f"""...` nhưng không có dấu hiệu nào cho thấy biến do người dùng kiểm soát được nối trực tiếp vào SQL. Theo yêu cầu, chỉ coi là lỗi khi có user input được chèn thẳng bằng f-string/.format(). Với thông tin hiện có, chưa đủ căn cứ khẳng định SQL Injection. (Rule: SQL_INJECTION) (Điểm phạt: -8.0)
- **[Security]** src/engine/ai_telemetry.py: Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Chỉ thấy `cursor.execute(f"""...` nhưng chưa thấy phần nội suy biến nào từ input người dùng. F-string tự nó chưa đủ để kết luận có SQL Injection nếu không có dữ liệu không tin cậy được chèn vào câu lệnh. (Rule: SQL_INJECTION) (Điểm phạt: -8.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `PEP8_MODULE_LEVEL_IMPORTS` | Maintainability, Reliability | 9 | -13.5 |
| `AI_REASONING` | Maintainability, Reliability, Security | 6 | -10.5 |
| `SQL_INJECTION` | Security | 5 | -40.0 |
| `GOD_OBJECT` | Maintainability | 4 | -8.0 |
| `HIGH_COMPLEXITY` | Maintainability | 4 | -8.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 3 | -15.0 |
| `MISLEADING_NAME` | Maintainability | 2 | -2.0 |
| `NAIVE_DATETIME` | Reliability | 2 | -4.0 |
| `SILENT_DATA_CORRUPTION` | Reliability | 2 | -10.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **longdd@liftsoft.vn** | 13904 | 91.17 | 645m |

#### 🔍 Chi tiết lỗi theo Thành viên

**longdd@liftsoft.vn** (Top 5 vi phạm nặng nhất):
- [Security] src/engine/ai_telemetry.py:1436 - Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Đoạn trích chỉ cho thấy `cursor.execute(f"""...` nhưng không có dấu hiệu nào cho thấy biến do người dùng kiểm soát được nối trực tiếp vào SQL. Theo yêu cầu, chỉ coi là lỗi khi có user input được chèn thẳng bằng f-string/.format(). Với thông tin hiện có, chưa đủ căn cứ khẳng định SQL Injection. (Rule: SQL_INJECTION)
- [Security] src/engine/ai_telemetry.py:1505 - Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Chỉ thấy `cursor.execute(f"""...` nhưng chưa thấy phần nội suy biến nào từ input người dùng. F-string tự nó chưa đủ để kết luận có SQL Injection nếu không có dữ liệu không tin cậy được chèn vào câu lệnh. (Rule: SQL_INJECTION)
- [Security] src/engine/ai_telemetry.py:1821 - Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Đoạn mã được cung cấp không cho thấy biến đầu vào nào được nối trực tiếp vào SQL. Không có bằng chứng về việc chèn user input vào chuỗi truy vấn, nên không thể xác nhận đây là lỗi thật. (Rule: SQL_INJECTION)
- [Security] src/engine/ai_telemetry.py:1322 - Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Đoạn trích không cho thấy dữ liệu người dùng được nối trực tiếp vào câu lệnh SQL; chỉ thấy mở đầu một f-string. Nếu phần còn lại không nội suy biến vào SQL thì không phải lỗ hổng injection. Với snippet hiện tại, đây là cảnh báo chưa đủ căn cứ. (Rule: SQL_INJECTION)
- [Security] src/engine/ai_telemetry.py:1431 - Potential SQL Injection (Insecure string interpolation in DB query). AI Note: Đây là dấu hiệu SQL Injection thực sự vì câu lệnh SQL được tạo bằng f-string và chèn trực tiếp biến `{clause}` vào câu lệnh: `f"SELECT COUNT(*) AS count FROM ai_request_logs {clause}"`. Nếu `clause` có thể bị ảnh hưởng bởi input bên ngoài, truy vấn sẽ không an toàn. Nên dùng tham số hóa hoặc whitelist chặt chẽ cho phần động này. (Rule: SQL_INJECTION)
