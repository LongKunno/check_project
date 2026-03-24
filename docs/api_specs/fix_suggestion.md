# AI Fix Suggestion API

Yêu cầu AI đưa ra gợi ý sửa đổi mã nguồn cho một vi phạm cụ thể.

## Endpoint
`POST /audit/fix-suggestion`

## Purpose
Tăng giá trị trải nghiệm người dùng bằng cách cung cấp giải pháp khắc phục ngay lập tức thay vì chỉ báo lỗi.

## Request Body (JSON)
| Field | Type | Description |
|-------|------|-------------|
| `file_path` | string | Đường dẫn file bị lỗi |
| `snippet` | string | Đoạn mã vi phạm |
| `reason` | string | Giải thích lỗi từ Auditor |

## Response Format (200 OK)
```json
{
  "suggestion": "```python\n# Mã đã sửa\n```\n\nGiải thích..."
}
```

## Error (500)
```json
{
  "detail": "AI Service unavailable"
}
```
