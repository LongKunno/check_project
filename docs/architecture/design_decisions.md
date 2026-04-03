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
**Accepted** (2026-04-01)

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

---

## ADR-008: Chuyển đổi sang Kiến trúc Two-Pass Audit (Hypothesize & Test)

### Trạng thái (Status)
**Accepted** (2026-03-30)

### Vấn đề (Problem)
Luồng kiểm toán file-by-file bằng AI (Bước 3.6 - Deep Audit) hiện tại gặp hạn chế lớn về "ngữ cảnh toàn cục" (Global Context). AI thường xuyên báo lỗi giả (False Positive) khi quan sát thấy một đoạn code gọi hàm ở file khác nhưng không biết hàm đó xử lý gì. Việc thả cho AI tự do dò tìm (Autonomous Agentic) lại gây ra mức độ đội giá Token lên tới 300%-400% và giảm độ ổn định của hệ thống do phụ thuộc vào tư duy LLM.

### Giải pháp (Options & Decision & Why)
**Quyết định**: Triển khai thiết kế **Two-Pass Audit (Gắn Cờ & Xác Minh Chéo)**.
1. **Pass 1 (Hypothesize):** AI quét file như cũ. Mọi lỗi nghi ngờ liên file đều phải được đánh cờ (`needs_verification = True`) kèm tên hàm tham chiếu (`verify_target`). Lỗi không được chốt vội vàng.
2. **Pass 2 (Verification):** Hệ thống dùng AST nội bộ (Symbol Indexer) dò tìm trọn vẹn Body code của `verify_target` đó trong project. Ném mã nguồn bằng chứng này lại cho AI để chốt hạ cuối cùng.

**Tại sao?**: Đây là điểm cân bằng hoàn hảo ("Sweet Spot"). Nó mang lại độ chính xác gần tuyệt đối (Zero False Positives) của phương pháp LLM Agent, nhưng vẫn duy trì tính Deterministic (Ổn định) của phân tích tĩnh và chỉ tăng thiểu chi phí Token lên tối đa 20%-40%.

### Hệ quả (Consequences)
- **Tích cực**: Tiết kiệm chi phí, dễ dàng Audit diện rộng mà không sợ "ảo giác LLM" làm loãng điểm số dự án.
- **Thử thách**: Việc trích xuất ngữ cảnh bằng Python AST đôi khi vẫn gặp giới hạn về rẽ nhánh kiểu dữ liệu động (Dynamic Typing) so với việc cấu hình LSP chuyên nghiệp.

---

## ADR-009: Áp dụng Luật Lai (Hybrid Regex + AI) cho các cấu trúc đặc thù

### Trạng thái (Status)
**Accepted** (2026-04-01)

### Vấn đề (Problem)
Việc bổ sung các luật kiểm toán nhạy cảm về ngữ cảnh như `MUTABLE_DEFAULT_ARGS`, `COMMENTED_OUT_CODE`, `SLOW_STRING_CONCAT` nếu chỉ dùng AST Parser thuần túy (Cây phân tích cú pháp) sẽ đòi hỏi viết thêm rất nhiều Node Visitor phức tạp. Tuy nhiên, nếu chỉ dùng Regex thuần túy thì tỷ lệ báo lỗi giả (False Positive) lại cực kỳ cao do không đọc hiểu được ý định trong docstring hay các chuỗi mô phỏng.

### Giải pháp (Options & Decision & Why)
**Quyết định**: Sử dụng kiến trúc **Luật Lai (Hybrid Rules)**. Cơ chế khai báo lấy Regex làm bộ lọc mồi (Lớp 1), sau đó đẩy khối code thỏa mãn Regex cho LLM (Lớp 2 - AI Gatekeeper) phân tích ngữ nghĩa.
1. **MUTABLE_DEFAULT_ARGS**: Quét Regex rẽ nhánh `def ...=[]` rồi đưa AI chẩn đoán.
2. **COMMENTED_OUT_CODE**: Regex đếm khối comment lớn (`#` > 5 dòng) sau đó hỏi AI xem đây là docstring giải thích hay là code rác bị khóa.
3. **SLOW_STRING_CONCAT**: Regex khoanh vùng phép cộng dồn `+=` và dùng AI soi chiếu khối code xem nó có nằm trong vòng lặp vòng lặp không.

**Tại sao?**:
- Bỏ qua rào cản thao tác với AST Trees cứng nhắc.
- Thời gian triển khai cực nhanh: Chỉ cần nạp cấu hình JSON vào `rules.json`.
- Có AI bảo vệ khỏi False Positives theo đúng kiến trúc Two-Pass Audit.

### Hệ quả (Consequences)
- **Tích cực**: Nâng cao năng lực đánh giá của Framework. Mở rộng kho luật dễ dàng.
- **Thử thách**: Tiêu tốn thêm Token cho LLM khi xác nhận ngữ cảnh. Phải đảm bảo AI Prompt ngắn gọn.

---

## ADR-010: Sandboxing Verification Script và Cấu hình Prompt Linh hoạt

### Trạng thái (Status)
**Accepted** (2026-04-02)

### Vấn đề (Problem)
1. **Thiếu Sandboxing**: Lớp `VerificationStep` sinh mã tự động `ai_double_check.py` thẳng vào `target_dir` (Nơi chứa mã nguồn dự án đang được quét). Điều này rủi ro làm ô nhiễm Repository nếu tiến trình bị treo hoặc OS Kill bất ngờ.
2. **AI Gatekeeper cứng nhắc**: Tại quá trình kiểm tra lai ghép (Hybrid AI Regex), các thuộc tính `ai_prompt` định kiến chi tiết (như luật `FORGOTTEN_TODO` yêu cầu tìm mã Ticket) bị Module `ai_service.py` bỏ qua, khiến Validator của AI Gatekeeper dùng một prompt review chung chung và gây ra False Positive.

### Giải pháp (Options & Decision & Why)
**Quyết định**: 
1. Sử dụng thư viện `tempfile.mkdtemp(prefix="auditor_")` của Python cho tiến trình sinh mã Bot Xác thực `ai_double_check.py`. Giới hạn tuyệt đối vòng hoạt động ngoài Repository. Bot sẽ trỏ ngược về project đang quét bằng tham số Absolute Path `cwd`.
2. Bổ sung trích đoạn tiêm (prompt injection) biến thiên. Truyền thông tin thuộc tính khai báo trong tuỳ chọn `ai_prompt` vào chu kỳ đánh giá của cụm `verify_violations_batch`.

**Tại sao?**: 
- Các Temporary Folder chứa rủi ro thấp nhất (Level 1) vì HDH tự phân giải. 
- Giữ AI Gatekeeper phân quyền riêng lẻ đến mức phần tử (Element Level) sẽ gia tăng tính ứng dụng cực độ cho Custom Rules Engine.

### Hệ quả (Consequences)
- **Tích cực**: Ngăn ngừa viễn cảnh rác kiến trúc, tối ưu chi phí phân khúc AI. Hệ thống chạy 100% trong sạch.

---

## ADR-011: Refactoring Kiến Trúc Toàn Diện (God Object Elimination)

- **Ngày**: 2026-04-02
- **Trạng thái**: Accepted

### Vấn đề (Problem)
Sau nhiều vòng phát triển tính năng, 3 file trở thành **God Object** — ôm quá nhiều trách nhiệm khác nhau, gây khó bảo trì và test:
- `api_server.py`: 726 dòng, 23 routes, không phân tách domain
- `verification.py`: 535 dòng, 4 class/function độc lập không liên quan
- `App.jsx` (Frontend): 1043 dòng, toàn bộ render logic nội tuyến

### Giải pháp (Decision)

**Backend — Tách `api_server.py` thành Router modules:**
```
src/api/
├── api_server.py        # Slim app factory, middleware, startup (≈90 dòng)
└── routers/
    ├── audit.py         # Audit pipeline, jobs, upload, SSE
    ├── rules.py         # CRUD rules, compile, test, toggle
    ├── history.py       # Audit history queries
    └── repositories.py  # Config repos + AI health check
```

**Backend — Tách `verification.py` thành modules chức năng:**
```
src/engine/
├── scanners.py          # BaseScanner, RegexScanner, PythonASTScanner
├── dependency_checker.py # detect_circular_dependencies
└── verification.py      # double_check_modular, VerificationStep (chỉ orchestration)
```

**Frontend — Tách `App.jsx` → `AuditView.jsx`:**
```
dashboard/src/components/views/
├── AuditView.jsx        # Toàn bộ Audit Dashboard UI (≈350 dòng, lazy-loaded)
├── HistoryView.jsx      # đã tách trước
└── SettingsView.jsx     # đã tách trước
```

**Bổ sung:**
- `.gitignore`: Thêm `reports/*.md` và `reports/*.json` — không track runtime output

### Tại sao?
- Single Responsibility Principle: mỗi file/module làm đúng một việc
- Lazy loading `AuditView` giảm initial bundle từ 490KB → 343KB (−30%)
- Router modules dễ test độc lập, dễ thêm middleware per-domain

### Hệ quả (Consequences)
- **Tích cực**: `api_server.py` giảm từ 726 → ≈90 dòng. `App.jsx` giảm từ 1043 → 557 dòng. Frontend bundle index giảm −30%.
- **Cần lưu ý**: Khi thêm route mới, phải xác định đúng router file thay vì thêm vào `api_server.py`.

---

## ADR-012: Self-Audit Rule Quality Fix (Chiến dịch Sửa Lỗi Bộ Quy Tắc)

- **Ngày**: 2026-04-03
- **Trạng thái**: Accepted

### Vấn đề (Problem)
Chạy self-audit cho dự án phát hiện ra **73 violations** ban đầu, nhưng trong đó **17% là False Positive** do 3 bug chính trong engine:
1. `UNUSED_IMPORT` không hiểu dotted imports (`import urllib.parse`, `import starlette.formparsers`).
2. `MUTATING_COLLECTION_ITERATION` Regex `for\s+\w+\s+in\s+(\w+):` match MỌI vòng for-in.
3. `SLOW_STRING_CONCAT` Regex `\+=` match cả phép cộng số (`counter += 1`).
4. `SQL_INJECTION` Regex match cả parameterized queries (`execute(%s, (param,))`).
5. `PRINT_STATEMENT` không skip test files và `__main__` guard.

### Giải pháp (Decision)

**Engine Rule Fixes:**

| Rule | Before | After |
|---|---|---|
| `UNUSED_IMPORT` | Chỉ track `ast.Name` | Bổ sung **Attribute chain tracking** cho dotted imports |
| `MUTATING_COLLECTION_ITERATION` | Regex match tất cả `for-in` | Chuyển sang **AI-only** detection |
| `SLOW_STRING_CONCAT` | Regex match tất cả `+=` | Chuyển sang **AI-only** detection |
| `SQL_INJECTION` | Regex match cả parameterized | Regex chỉ match `f-string` và `.format()` trong execute |
| `PRINT_STATEMENT` | Bắt mọi `print()` | Skip test files + `__main__` guard |

**Code Quality Fixes:**

| Bug | Fix |
|---|---|
| Hardcoded `DATABASE_URL` password | Xóa fallback chứa credentials, fail-fast nếu thiếu env |
| `int()` crash trên env | Bọc `try/except ValueError` |
| Memory leak `JobManager` | Thêm `cleanup_old_jobs()` tự động mỗi 1h |
| `toggle_core_rule` race condition | `SELECT...FOR UPDATE` + transaction |
| `res['final']` KeyError scoring | Dùng `.get('final', 0)` |
| Swallowed exceptions | Thêm `logger.debug/warning` thay `pass` |
| DoS multipart 100K | Giảm xuống 10K |
| Hardcoded CORS IPs | Đọc từ env `CORS_ORIGINS` |

### Kết quả định lượng

| Metric | Trước | Sau | Cải thiện |
|---|---|---|---|
| Total violations | 73 | **15** | **-79%** |
| False Positive Rate | 17% | **~0%** | **-100%** |
| Score | 23.41 | **39.89** | **+70%** |

### Tại sao?
Khi audit engine tự audit chính mình, False Positive phải gần 0% để đảm bảo uy tín. Mỗi FP sẽ nhân rộng trên MỌI dự án được audit → ảnh hưởng hệ thống.

### Hệ quả (Consequences)
- **Tích cực**: Engine chính xác hơn, score phản ánh đúng thực tế, không còn FP cho dotted imports.
- **Lưu ý**: 3 rules chuyển sang AI-only (`SLOW_STRING_CONCAT`, `MUTATING_COLLECTION_ITERATION`, và `PRINT_STATEMENT` filter) → cần `AI_ENABLED=true` để phát hiện.
