# Natural Language Rule Engine (NLRE) API

Quản lý và biên dịch các "Luật đánh giá" bằng ngôn ngữ tự nhiên thành JSON cấu trúc thông qua AI Streaming.

## GET `/api/rules`
Lấy quy tắc đã lưu của dự án.
- **Phương thức:** `GET`
- **Tham số Query:** `target` (Bắt buộc) - URL hoặc ID của repository.
- **Phản hồi Thành công (200):**
```json
{
  "status": "success",
  "data": {
    "default_rules": {
      "RULE_ID": {
         "category": "Maintainability",
         "severity": "Minor",
         "debt": 10,
         "weight": -2.0,
         "reason": "Mô tả vi phạm",
         "has_regex": true,
         "has_ast": false,
         "has_ai": false,
         "regex": { "pattern": "..." },
         "ast": null,
         "ai": null
      }
    },
    "target_id": "test_target",
    "natural_text": "Cấm dùng eval",
    "compiled_json": { ... },
    "disabled_core_rules": ["BARE_EXCEPT"],
    "custom_weights": {"HARDCODED_SECRET": -2.0}
  }
}
```
- **Phản hồi không có dữ liệu (200):**
```json
{
  "status": "success",
  "data": null
}
```

## POST `/api/rules/save`
Lưu quy tắc (natural + compiled).
- **Phương thức:** `POST`
- **Body:**
```json
{
  "target": "test_target",
  "natural_text": "Cấm dùng eval",
  "compiled_json": { ... }, // Optional, có thể null nếu chỉ lưu Custom Weights
  "custom_weights": {"HARDCODED_SECRET": -2.0}
}
```
*Lưu ý: Schema được nới lỏng `compiled_json: Optional[dict]` để chặn lỗi `422 Unprocessable Entity` khi frontend gửi null.*
- **Phản hồi (200):**
```json
{
  "status": "success",
  "message": "Rules saved successfully."
}
```
- **Phản hồi lỗi (500):**
```json
{
  "detail": "Kèm chi tiết lỗi Exception"
}
```

## DELETE `/api/rules`
Xóa toàn bộ quy tắc tùy chỉnh của dự án để khôi phục về mặc định.
- **Phương thức:** `DELETE`
- **Tham số Query:** `target` (Bắt buộc) - ID dự án.
- **Phản hồi (200):**
```json
{
  "status": "success",
  "message": "Rules deleted successfully."
}
```

## POST `/api/rules/compile`
Gọi AI để streaming biên dịch JSON. (Sử dụng SSE-like Text Stream).
- **Phương thức:** `POST`
- **Body:**
```json
{
  "natural_text": "Cấm dùng eval"
}
```
- **Phản hồi (200 - Trả về dữ liệu kiểu Streaming - text/plain):**
Các chunk string giải thích luật (AI Explanation), sau đó là markdown codeblock JSON rules.
```text
Tôi hiểu yêu cầu của bạn, tôi sẽ tạo một rule cho hàm eval().
```json
  "test_case": "def foo():\n    eval('2+2')"
}
```
```

## POST `/api/rules/auto_fix`
Yêu cầu AI phân tích lỗi trả về từ Sandbox (hoặc lỗi parse) để tự động sửa chữa bộ luật JSON. (Sử dụng Streaming).

- **Phương thức:** `POST`
- **Body:**
```json
{
  "failed_json": "Bộ JSON bị lỗi hoặc muốn cải tiến",
  "test_case_code": "Đoạn mã test snippet trong sandbox",
  "error_message": "Log lỗi từ hệ thống hoặc phản hồi từ user"
}
```
- **Phản hồi (200 - text/plain Streaming):**
Trả về luồng ký tự đại diện cho đoạn mã JSON mới đã được "chữa lành" (Healed), bọc trong Markdown Codeblock.
