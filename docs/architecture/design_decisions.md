# Architecture Decision Records (ADR)

Tất cả các quyết định thiết kế cốt lõi của hệ thống được ghi nhận tại đây theo quy chuẩn ADR.

## ADR-001: Chuyển đổi sang Dynamic Feature-based Scoring

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Hệ thống cũ sử dụng mô hình 4 trụ cột (4-pillar) cố định cho toàn bộ dự án. Điều này khiến việc đánh giá các dự án lớn trở nên khó khăn vì điểm số bị loãng, không chỉ rõ được module/tính năng nào đang gặp lỗi nghiêm trọng.

### Giải pháp (Options & Decision & Why)
**Giải pháp**: Áp dụng mô hình tính điểm phân cấp (Hierarchical Scoring).
1. Phân loại file theo thư mục (Features).
2. Tính điểm 4 trụ cột cho TỪNG Feature.
3. Tính trung bình cộng điểm các Feature để ra điểm dự án.

**Tại sao?**: Giúp Dashboard hiển thị trực quan module nào "đỏ" (nhiều lỗi/chất lượng kém), thuận tiện cho các Technical Architect và Tech Lead rà soát nhanh.

### Hệ quả (Consequences)
- **Tích cực**: Tăng độ chi tiết của báo cáo lên 400%.
- **Thử thách**: Yêu cầu Engine Auditor phải thực hiện bước Aggregation phức tạp hơn (Map file -> Feature).

---

## ADR-002: Hỗ trợ PNA cho trình duyệt Brave

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Brave Shields và các trình duyệt dựa trên Chromium mới thắt chặt chính sách **Private Network Access (PNA)**, chặn các request từ web public (hoặc localhost 3000) tới API local (8000).

### Giải pháp (Options & Decision & Why)
Bổ sung `Access-Control-Allow-Private-Network: true` vào header của mọi response và xử lý Preflight (OPTIONS) chính xác.

---

## ADR-003: Phân vùng đánh giá qua thư mục `source_code`

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Ở một số dự án, mã nguồn quan trọng (features) nằm sâu trong thư mục `source_code`, trong khi các thư mục ở root chứa cấu hình, tài liệu hoặc file phụ trợ. Engine Discovery cũ quét toàn bộ root dẫn đến việc nhận diện sai các thư mục không chứa code là "Features".

### Giải pháp (Options & Decision & Why)
**Quyết định**: Ưu tiên thư mục `source_code` làm gốc nếu nó tồn tại.
- Nếu thấy `source_code`: Chỉ quét bên trong nó. Feature name = subdirs of `source_code`.
- Nếu không thấy: Quét như cũ.

**Tại sao?**: Giúp lọc nhiễu tự động và tập trung đánh giá vào đúng khu vực chứa logic nghiệp vụ chính của dự án.

---

## ADR-004: Khôi phục Mô hình 4 Trụ cột và Nâng cao bộ Quy tắc kiểm tra (Case Checks)

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Mô hình rating A-E của SonarQube tuy chuyên nghiệp nhưng có thể gây khó hiểu cho người dùng đã quen với thang điểm 10. Tuy nhiên, kiến thức về Severity và Technical Debt từ SonarQube lại rất hữu ích để làm phong phú thêm bộ quy tắc kiểm tra.

### Giải pháp (Options & Decision & Why)
**Quyết định**: 
1. Quay lại sử dụng thang điểm 0-10 cho 4 trụ cột (Performance, Maintainability, Reliability, Security).
2. Tích hợp Technical Debt và Severity từ SonarQube vào metadata của các quy tắc để làm "Case Checks" chuyên sâu hơn.
3. Bổ sung các quy tắc kiểm tra mới như CORS, Unused Imports, và Print Statements.

**Tại sao?**: Giữ được sự đơn giản, trực quan của điểm số 0-10 nhưng vẫn tận dụng được chiều sâu phân tích của các công cụ hàng đầu như SonarQube.

### Hệ quả (Consequences)
- **Tích cực**: Dashboard dễ hiểu hơn, bộ quy tắc kiểm tra mạnh mẽ và đa dạng hơn.
- **Thử thách**: Duy trì sự cân bằng giữa điểm phạt (Punishment) và Nợ kỹ thuật (Debt) để điểm số phản ánh đúng thực tế.

---

## ADR-005: Tích hợp AI Hybrid & Ổn định điểm số (Score Stability)

### Trạng thái (Status)
**Proposed** (2026-03-20)

### Vấn đề (Problem)
Việc sử dụng trực tiếp AI (LLM) để chấm điểm code (ví dụ: "Cho tôi biết điểm số bảo mật của file này") thường dẫn đến sự thiếu ổn định: cùng một file có thể nhận các điểm số khác nhau trong các lần quét khác nhau. Điều này vi phạm tính tin cậy của một công cụ quản lý chất lượng.

### Giải pháp (Options & Decision & Why)
**Quyết định**: Áp dụng mô hình **Hybrid AI-Static Analysis**.

1. **Static Analysis as Primary (Xương sống)**: Các công cụ deterministic (AST, Regex) vẫn là nguồn phát hiện lỗi chính. Mỗi lỗi được gán một "Trọng số âm" (Penalty Weight) cố định.
2. **AI as Contextual Validator (Bộ lọc ngữ cảnh)**: AI không trực tiếp đưa ra điểm số. AI chỉ trả lời câu hỏi: *"Dựa trên ngữ cảnh này, vi phạm Static Analysis vừa tìm thấy có phải là False Positive không?"*.
3. **Cơ chế ổn định (Stability Mechanism)**:
   - Nếu AI xác nhận là lỗi thật: Áp dụng 100% trọng số phạt.
   - Nếu AI xác định là False Positive: Giảm trọng số phạt về 0 hoặc một mức tối thiểu.
   - **Calibration (Hiệu chuẩn)**: Sử dụng JSON Schema (Instructor/Pydantic) để ép AI phân loại lỗi vào các nhóm Severity (Critical, High, Medium, Low) đã được định nghĩa điểm phạt sẵn trong hệ thống.

**Tại sao?**: Giữ được sự chính xác nhờ AI (giảm nhiễu) nhưng vẫn duy trì tính ổn định tuyệt đối của công thức toán học đằng sau điểm số.

### Hệ quả (Consequences)
- **Tích cực**: Điểm số ổn định, giảm tỷ lệ báo cáo sai (False Positive Rate).
- **Thử thách**: Tăng độ trễ (Latency) của quá trình quét do phải gọi API AI và tăng chi phí vận hành (Token usage).


## ADR-006: Nâng cấp xử lý Bất đồng bộ (Async I/O) cho AI Service

### Trạng thái (Status)
**Accepted** (2026-03-23)

### Vấn đề (Problem)
Luồng tích hợp AI trước đây sử dụng `ThreadPoolExecutor` với OpenAI Client đồng bộ (Synchronous). Cách tiếp cận này phân bổ các thread lãng phí trong khi chờ I/O mạng từ API, tiềm ẩn nguy cơ thắt cổ chai khi quét dự án lớn, và không tối ưu theo triết lý I/O Bound hiện đại.

### Giải pháp (Options & Decision & Why)
**Quyết định**: Áp dụng khối cơ chế `asyncio` và thư viện `AsyncOpenAI` cho các xử lý tại AI Service.
1. Chuyển đổi các API Wrapper thành `async def`.
2. Tạo Local Event Loop qua `loop.run_until_complete()` bên trong background thread của Auditor.
**Tại sao?**: Đảm bảo non-blocking tuyệt đối khi giao tiếp với API LLM. Tối thiểu hoá Memory Footprint khi concurrency scale lớn, tránh cấp phát lượng POSIX threads thừa.

### Hệ quả (Consequences)
- **Tích cực**: Tiết kiệm RAM, CPU; tăng tốc độ kiểm toán sâu (Deep Audit).
- **Thử thách**: Viết Unit Test (như `test_overall_pillars`) phải chuyển sang dùng `AsyncMock`.

---
## ADR-007: Kiến trúc Modular Scanner cho Bước Xác thực (Verification)

### Trạng thái (Status)
**Accepted** (2026-03-24)

### Vấn đề (Problem)
`VerificationStep` (Bước 3) trước đây chứa logic quét Regex và AST trộn lẫn trong một hàm duy nhất. Điều này gây khó khăn khi muốn mở rộng bộ quy tắc cho các ngôn ngữ khác hoặc thêm các phương pháp quét mới (ví dụ: Dependency check, Secret scanning) mà không làm phình to code logic chính.

### Giải pháp (Options & Decision & Why)
**Quyết định**: Tách biệt logic quét thành các lớp Scanner chuyên biệt kế thừa từ `BaseScanner`.
1. `RegexScanner`: Xử lý các quy tắc dựa trên biểu thức chính quy.
2. `PythonASTScanner`: Xử lý các quy tắc dựa trên cây cú pháp AST của Python (Complexity, Length, Dangerous funcs).
3. **Modular Rule Loading**: `rules.json` được cấu trúc lại để phân loại quy tắc cho từng Scanner.

**Tại sao?**: Đảm bảo tính Single Responsibility (SRP) và cho phép dễ dàng "cắm thêm" (plug-in) các bộ quét mới trong tương lai mà không ảnh hưởng đến luồng điều phối chính.

### Hệ quả (Consequences)
- **Tích cực**: Code sạch hơn, dễ viết Unit Test cho từng Scanner riêng biệt.
- **Thử thách**: Cần quản lý cấu trúc `rules.json` chặt chẽ hơn để các Scanner nhận diện đúng quy tắc thuộc về mình.

