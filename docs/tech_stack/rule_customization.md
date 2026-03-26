# Hướng dẫn Tùy chỉnh Quy tắc (Rule Customization)

Hệ thống AI Static Analysis (V1.0.0) cho phép bạn tùy chỉnh các quy tắc kiểm tra thông qua file cấu hình `src/engine/rules.json`.

## 1. Cấu trúc file rules.json

File này bao gồm hai phần chính: `regex_rules` (kiểm tra bằng biểu thức chính quy) và `ast_rules` (kiểm tra bằng cây cú pháp trừu tượng).

### Regex Rules
Dùng để tìm kiếm các mẫu văn bản đơn giản.
```json
{
  "id": "RULE_ID",
  "pattern": "regex_pattern",
  "pillar": "PillarName",
  "reason": "Mô tả lỗi",
  "weight": -float_value
}
```

### AST Rules
Dùng cho các kiểm tra logic phức tạp.
- **max_function_length**: Giới hạn độ dài hàm.
- **complexity**: Giới hạn độ phức tạp Cyclomatic.
- **dangerous_functions**: Danh sách các hàm cấm sử dụng.

## 2. Cách thêm quy tắc mới

### Ví dụ: Thêm kiểm tra "TODO" comments
Nếu bạn muốn hệ thống cảnh báo khi thấy comment TODO:
1. Mở `src/engine/rules.json`.
2. Thêm vào mảng `regex_rules`:
```json
{
  "id": "TODO_FOUND",
  "pattern": "TODO:",
  "pillar": "Maintainability",
  "reason": "Found a TODO comment that needs resolution",
  "weight": -0.1
}
```

## 3. Lưu ý quan trọng
- Sau khi chỉnh sửa `rules.json`, bạn không cần khởi động lại server nếu đang chạy ở chế độ debug (`--reload`).
- Trọng số (`weight`) nên là số âm để tính vào điểm phạt.
- Các Trụ cột (`pillar`) hợp lệ: `Performance`, `Maintainability`, `Reliability`, `Security`.
