# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

## ĐIỂM TỔNG DỰ ÁN: 11.74 / 100 (🚨 Cần cải thiện ngay)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 866
- Tổng số file: 3
- Tổng số tính năng: 1

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 1.48 | 🚨 Nguy cơ |
| Maintainability | 0.8 | 🚨 Nguy cơ |
| Reliability | 1.48 | 🚨 Nguy cơ |
| Security | 0.8 | 🚨 Nguy cơ |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `root` (LOC: 866)
**Điểm tính năng: 11.74 / 100** (Nợ: 250m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | -10.0 | 1.48 |
| Maintainability | -40.0 | 0.8 |
| Reliability | -10.0 | 1.48 |
| Security | -5.0 | 0.8 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Function too long (God Object anti-pattern): upload_and_audit (> 80 lines). AI Note: Hàm 'upload_and_audit' vượt quá 80 dòng là True Positive. Trong kiến trúc API hiện đại (đặc biệt là FastAPI), các endpoint handler nên ngắn gọn và giao logic xử lý cho tầng Service hoặc Celery/Background Tasks. Việc gộp quá nhiều logic xử lý file và điều phối vào một hàm làm giảm khả năng bảo trì. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Performance]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Cyclomatic Complexity too high (Too many nested loops/branches): upload_and_audit (Complexity: 13 > 12). AI Note: Độ phức tạp vòng đời (Cyclomatic Complexity) là 13, vượt ngưỡng 12. Đây là lỗi thật vì hàm xử lý nhiều file thường chứa các vòng lặp lồng nhau hoặc nhiều câu lệnh rẽ nhánh để kiểm tra định dạng, lưu trữ và xử lý lỗi, gây khó khăn cho việc viết unit test. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Function too long (God Object anti-pattern): audit_repository (> 80 lines). AI Note: Tương tự như vi phạm #0, hàm 'audit_repository' quá dài (> 80 dòng) chứng tỏ nó đang thực hiện quá nhiều nhiệm vụ: nhận request, clone git, điều phối task... Đây là dấu hiệu của God Object anti-pattern cần được tách nhỏ. (Rule: GOD_OBJECT) (Trọng số: -2.0)
- **[Reliability]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Swallowed exception (except block has only 'pass'). AI Note: Lỗi 'Swallowed exception' (except Exception: pass) là cực kỳ nguy hiểm trong trường hợp này. Nếu 'ast.parse' thất bại (ví dụ: code lỗi cú pháp), biến 'tree' sẽ không được khởi tạo nhưng chương trình vẫn âm thầm chạy tiếp, dẫn đến các lỗi ReferenceError rất khó debug sau đó. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Reliability]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Swallowed exception (except block has only 'pass'). AI Note: Việc bao bọc 'violations.extend(results)' trong khối try-except pass làm mất dấu vết nếu có lỗi xảy ra trong quá trình gộp dữ liệu. Điều này vi phạm nghiêm trọng trụ cột Reliability vì nó che giấu sự cố thay vì xử lý hoặc log lại để giám sát. (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Maintainability]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Import 'WEIGHTS' might be unused (AST). AI Note: Lỗi True Positive. Việc import hằng số 'WEIGHTS' nhưng không sử dụng trong file api_server.py gây dư thừa mã nguồn, làm tăng độ nhiễu khi đọc code và không tuân thủ quy tắc Clean Code. Trừ khi nó được sử dụng trong các hàm động như getattr() hoặc globals(), linter báo lỗi này là chính xác. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Import 'starlette.formparsers' might be unused (AST). AI Note: Lỗi True Positive. Theo AST (Abstract Syntax Tree), 'starlette.formparsers' không được tham chiếu trong logic xử lý của file. Trong các ứng dụng FastAPI/Starlette, form parsers thường được xử lý ngầm định hoặc thông qua dependency injection. Việc import trực tiếp mà không dùng đến là dư thừa. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Performance]** /home/long/Documents/project_private/check_project/src/api/git_helper.py: Cyclomatic Complexity too high (Too many nested loops/branches): clone_repository (Complexity: 13 > 12). AI Note: Lỗi True Positive. Hàm clone_repository nhận nhiều tham số tùy chọn (username, token, branch) và thường chứa nhiều logic kiểm tra điều kiện (if/else), xử lý lỗi (try/except) và định dạng chuỗi URL. Với độ phức tạp 13 so với ngưỡng 12, đây là một chỉ báo hợp lý cho thấy hàm này nên được refactor (tách nhỏ) để dễ kiểm thử và bảo trì. (Rule: HIGH_COMPLEXITY) (Trọng số: -5.0)
- **[Maintainability]** /home/long/Documents/project_private/check_project/src/api/git_helper.py: Import 'urllib.parse' might be unused (AST). AI Note: Lỗi True Positive. Mặc dù 'urllib.parse' thường được dùng trong git_helper để xử lý thông tin xác thực trong URL, nhưng nếu linter không tìm thấy bất kỳ lời gọi nào đến module này trong thân file, việc import là không cần thiết. Đây là lỗi phổ biến khi refactor code nhưng quên xóa các import cũ. (Rule: UNUSED_IMPORT) (Trọng số: -0.5)
- **[Maintainability]** /home/long/Documents/project_private/check_project/src/api/api_server.py: Race condition và lỗi dọn dẹp thư mục tạm: Trong endpoint 'upload_and_audit', lệnh 'shutil.rmtree(temp_dir)' nằm trong khối 'finally' của request handler chính. Do 'background_tasks.add_task' chạy bất đồng bộ ngay sau khi response được trả về, khối 'finally' sẽ xóa sạch code nguồn được upload trước khi task background kịp bắt đầu hoặc hoàn thành việc đọc file, dẫn đến lỗi FileNotFoundError khi thực hiện audit. (Rule: AI_REASONING) (Trọng số: -9.0)
