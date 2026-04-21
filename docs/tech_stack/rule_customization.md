# Hướng dẫn Tùy chỉnh Quy tắc (Rule Customization)

Hệ thống AI Static Analysis (V1.0.0) quản lý toàn bộ cấu hình quy tắc kiểm tra tại một nơi duy nhất là file `src/engine/rules.json` (Áp dụng kiến trúc **Single Source of Truth**). Mỗi luật kiểm toán đều được định nghĩa theo **Unified Rule Schema** gồm 3 phương pháp phát hiện khác nhau: Regex, AST, và AI.

## 1. Cấu trúc Unified Rule Schema

Mỗi rule được định nghĩa dưới dạng một object đơn nhất trong mảng `rules`:

```json
{
  "id": "RULE_ID",
  "pillar": "Security | Performance | Maintainability | Reliability",
  "category": "Security | Performance | Maintainability | Reliability",
  "severity": "Info | Minor | Major | Critical | Blocker",
  "debt": 15,
  "reason": "Mô tả ngắn gọn về lỗi này",
  "weight": -5.0,

  "regex": {
    "pattern": "biểu_thức_chính_quy_ở_đây"
  },

  "ast": {
    "type": "bare_except | swallowed_exception | max_function_length | complexity | max_parameters | n_plus_one_query | circular_dependency | missing_timeout | missing_with_open | dangerous_functions",
    "limit": 80
  },

  "ai": {
    "prompt": "Câu hỏi/hướng dẫn cho AI để xác nhận hoặc bác bỏ vi phạm."
  }
}
```

**Lưu ý quan trọng:**
- Nếu một phương pháp không áp dụng được thì để `null` (không bỏ qua key).
- Một rule có thể vừa có `regex` vừa có `ai` (Regex bắt trước, AI xác nhận sau).
- AI sẽ nhận `ai.prompt` làm câu hỏi để đánh giá xem vi phạm có phải là **False Positive** không.

---

## 2. Các loại AST Rule (`ast.type`) hỗ trợ

| ast.type | Mô tả | Tham số thêm |
|---|---|---|
| `bare_except` | Khối `except:` không có kiểu cụ thể | _(không có)_ |
| `swallowed_exception` | Khối `except` chỉ có `pass` | _(không có)_ |
| `max_function_length` | Hàm quá dài | `"limit": 80` |
| `complexity` | Cyclomatic Complexity quá cao | `"limit": 12` |
| `max_parameters` | Hàm có quá nhiều tham số | `"limit": 7` |
| `n_plus_one_query` | Gọi DB/API trong vòng lặp | _(không có)_ |
| `circular_dependency` | Import vòng tròn (project-level) | _(không có)_ |
| `missing_timeout` | Gọi HTTP không có `timeout` | _(không có)_ |
| `missing_with_open` | Dùng `open()` ngoài `with` | _(không có)_ |
| `dangerous_functions` | Danh sách hàm cấm dùng | `"targets": [{"name": "eval", "reason": "..."}]` |

---

## 3. Ví dụ thêm rule mới hoàn chỉnh

### Ví dụ A: Rule thuần Regex (không cần AST hay AI)
```json
{
  "id": "TODO_FOUND",
  "pillar": "Maintainability",
  "category": "Maintainability",
  "severity": "Info",
  "debt": 5,
  "reason": "TODO comment chưa được giải quyết",
  "weight": -0.5,
  "regex": { "pattern": "#\\s*TODO" },
  "ast": null,
  "ai": null
}
```

### Ví dụ B: Rule Regex + AI (AI hậu kiểm để chống False Positive)
```json
{
  "id": "SENSITIVE_LOG",
  "pillar": "Security",
  "category": "Security",
  "severity": "Major",
  "debt": 20,
  "reason": "Logging thông tin nhạy cảm (email, phone, token...)",
  "weight": -4.0,
  "regex": { "pattern": "(?i)log(ger)?\\.(info|debug|warning|error)\\(.*?(email|phone|token|password).*?\\)" },
  "ast": null,
  "ai": {
    "prompt": "Xác nhận đoạn code này có đang in ra thông tin nhạy cảm thật (email/phone/token của người dùng) vào file log không? Nếu chỉ log ID hoặc thông tin ẩn danh thì loại bỏ."
  }
}
```

### Ví dụ C: Rule thuần AST
```json
{
  "id": "MISSING_TIMEOUT",
  "pillar": "Reliability",
  "category": "Reliability",
  "severity": "Major",
  "debt": 30,
  "reason": "Gọi HTTP không có timeout",
  "weight": -5.0,
  "regex": null,
  "ast": { "type": "missing_timeout" },
  "ai": null
}
```

---

## 4. Lưu ý quan trọng
- Không xóa bất kỳ key nào (`regex`, `ast`, `ai`). Nếu không dùng thì để `null`.
- Các Trụ cột (`pillar`/`category`) hợp lệ: `Performance`, `Maintainability`, `Reliability`, `Security`.
- Sau khi chỉnh sửa `rules.json`, không cần khởi động lại server nếu chạy ở chế độ `--reload`.
- Điểm phạt (`weight`) phải là số âm để tính vào tổng mức phạt.
- **Best Practice (Chống False Positive):** Để hệ thống không tóm nhầm các từ khoá nằm trong vùng comment/văn bản giải thích, hãy ưu tiên sử dụng `ast` thay vì `regex` bất cứ lúc nào có thể (ví dụ: bắt lỗi hàm cấm thì nên đẩy vào cấu trúc `dangerous_functions` thay vì gõ text regex). Sử dụng `ai` nếu cấu trúc logic buộc phải đánh giá qua ngữ cảnh.

