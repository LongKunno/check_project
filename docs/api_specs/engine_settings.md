# API: Engine Settings

Quản lý cấu hình engine runtime (AI toggle, file scan limit) — thay đổi từ UI mà không cần restart.

## `GET /api/settings/engine`

**Mục đích:** Lấy cấu hình engine hiện tại (đọc DB, fallback .env).

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "ai_enabled": false,
    "test_mode_limit_files": 1
  }
}
```

## `PUT /api/settings/engine`

**Mục đích:** Cập nhật cấu hình engine (upsert vào bảng `system_config`).

**Request Body (partial update):**
```json
{
  "ai_enabled": true,
  "test_mode_limit_files": 0
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "ai_enabled": true,
    "test_mode_limit_files": 0
  }
}
```

**Response (400):**
```json
{
  "detail": "test_mode_limit_files phải >= 0"
}
```

## Ghi chú kiến trúc

- Config lưu trong bảng `system_config` (key-value store)
- Ưu tiên đọc: **DB → .env** (fallback)
- Runtime reload: không cần restart container
- Helper functions: `get_ai_enabled()`, `get_test_mode_limit()` trong `src/config.py`
