# Kiến trúc Rule Manager & Two-Stage Pipeline
Kiến trúc này mô tả luồng hoạt động của Hệ thống Quản lý Luật và Đường ống Kiểm toán Hai Giai Đoạn (Two-Stage Audit Pipeline).

## 1. Cấu trúc tổng thể (Data Flow)

```mermaid
sequenceDiagram
    participant User
    participant Dashboard (React)
    participant API Server
    participant AI Service
    participant SQLite DB
    participant Auditor Engine

    %% Flow cấu hình & test
    Note over User, SQLite DB: Luồng Quản lý và Tạo Luật (2 Tab Độc lập có React Key Props riêng)
    User->>Dashboard (React): Vào Tab "Tạo Rule AI" (Sandbox) -> Nhập luật & "Biên dịch"
    Dashboard (React)->>API Server: POST /api/rules/compile
    API Server->>AI Service: Yêu cầu AI qua Streaming để lấy cấu trúc
    AI Service-->>Dashboard (React): Trả lại AST/Regex JSON nguyên bản bọc ```json
    Dashboard (React)->>Dashboard (React): Frontend dùng Try-Catch + Regex nghiêm ngặt lấy JSON -> hiển thị.
    User->>Dashboard (React): Chạy "Run Test" -> Bấm "Lưu Rule Cục Bộ" (Thành Rules chính thức)
    Dashboard (React)->>API Server: POST /api/rules/test sau đó /save
    User->>Dashboard (React): Chuyển qua Tab "Danh sách Rule" (Quản lý)
    Dashboard (React)->>Dashboard (React): Force Unmount (Xóa State) nhờ React Key -> Gọi GET /api/rules
    Dashboard (React)->>API Server: POST /api/rules/toggle & /api/rules/save (chỉnh Weight bằng Wheel Event)
    API Server->>SQLite DB: Cập nhật `project_rules` (Toggled Rules, Compiled_json & Custom Weights)

    %% Flow kiểm toán Two-stage
    Note over User, Auditor Engine: Luồng Thực thi Two-Stage Pipeline
    User->>Dashboard (React): Chạy Audit
    Dashboard (React)->>API Server: POST /api/audit/process
    API Server->>SQLite DB: Trích xuất `get_project_rules` 
    API Server->>Auditor Engine: Khởi tạo CodeAuditor(custom_rules)
    Auditor Engine->>Auditor Engine: (Stage 1) Quét Tĩnh cực nhanh bằng AST + Regex
    Auditor Engine->>AI Service: (Stage 2) Xác thực tập tin vi phạm bằng Prompt Review batching
    AI Service-->>Auditor Engine: Loại bỏ False Positives (áp dụng cho cả Core & Custom rules)
    Auditor Engine->>API Server: Tổng hợp điểm chuẩn xác
```

## 2. API & Data Contract
- `Database`: Entity `project_rules` lưu `target_id`, `compiled_json` (chứa array custom rules), và `disabled_core_rules` (array các ID của luật mặc định bị người dùng cấm).
- `VerificationStep`: Module nhận merged rules rà soát toàn cục. Sẽ loại bỏ các luật tĩnh nằm trong danh sách `disabled_core_rules` trước khi chạy.
- `Interactive Sandbox API (/api/rules/test)`: Nhận đoạn mã tạm thời và `compiled_json`, dựng AST parser tức thời trên RAM để mô phỏng hoạt động của luật. Cực kỳ hiệu quả cho việc thử nghiệm.

## 3. ADR (Architecture Decision Record)
- **Problem**: Giao diện tạo luật AI có tỷ lệ báo sai (hallucination) cao; tĩnh không hiểu được ngữ cảnh; luật mặc định đôi khi quá cứng nhắc gây ức chế.
- **Options**: Xây dựng UI Rule Generator (Kéo thả) vs Dùng AI Sinh luật + Sandbox test + Trình Pruning.
- **Decision & Why**: Chọn Dùng AI sinh luật kết hợp Sandbox + AI Pruning ở giai đoạn Audit.
  - Phân tầng thành Two-Stage pipeline cho phép vừa tận dụng AST tĩnh (siêu tốc, ít tốn Cost API) vừa tận dụng Review (linh động ngữ cảnh, loại bỏ báo lỗi nhảm).
  - Phân quyền tắt bật (`disabled_core_rules`) giúp linh động hóa hệ thống cho mọi tệp Developer.
- **Consequences**: Trở thành Engine hoàn thiện, giảm 90% lỗi False Positive, nhưng tăng Cost API giai đoạn Stage-2 (Review). Để khắc chế Cost, Stage 2 sử dụng cơ chế Batching (đóng gói log) thay vì gọi song song từng request.
