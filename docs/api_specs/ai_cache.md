# API: AI Cache

Quản lý runtime policy và trạng thái cache cho các bước AI audit (`validation`, `deep_audit`, `cross_check`).

## Ghi chú về endpoint

- Khi đi qua dashboard/nginx: dùng prefix `/api`, ví dụ `GET /api/ai/cache`.
- Khi gọi trực tiếp vào FastAPI backend trên cổng `8000`: path thực là `GET /ai/cache`.

## Mục đích

- Bật/tắt toàn bộ AI cache hoặc từng stage riêng lẻ.
- Theo dõi số entry hiện có, thời điểm hit gần nhất và hiệu quả tiết kiệm token/cost.
- Xoá toàn bộ cache khi cần ép hệ thống tính lại từ đầu.

## `GET /api/ai/cache`

**Mục đích:** Trả về policy hiện tại và snapshot tổng quan của cache.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "enabled": true,
    "validation_enabled": true,
    "deep_audit_enabled": true,
    "cross_check_enabled": true,
    "retention_days": 30,
    "last_cleanup_at": "2026-04-22T08:40:00+00:00",
    "entries_count": 128,
    "last_hit_at": "2026-04-22T09:12:31+00:00",
    "all_time_summary": {
      "hits": 320,
      "misses": 96,
      "writes": 96,
      "saved_input_tokens": 184220,
      "saved_output_tokens": 33840,
      "saved_cost_usd": 2.418,
      "hit_rate": 0.7692,
      "by_stage": {
        "validation": {
          "hits": 210,
          "misses": 60,
          "writes": 60,
          "saved_input_tokens": 104000,
          "saved_output_tokens": 12000,
          "saved_cost_usd": 1.02
        },
        "deep_audit": {
          "hits": 80,
          "misses": 24,
          "writes": 24,
          "saved_input_tokens": 60220,
          "saved_output_tokens": 16840,
          "saved_cost_usd": 1.11
        },
        "cross_check": {
          "hits": 30,
          "misses": 12,
          "writes": 12,
          "saved_input_tokens": 20000,
          "saved_output_tokens": 5000,
          "saved_cost_usd": 0.288
        }
      }
    }
  }
}
```

**Mô tả response:**

- `enabled`: Tắt/mở toàn bộ AI cache.
- `validation_enabled`, `deep_audit_enabled`, `cross_check_enabled`: Toggle theo từng stage.
- `retention_days`: Số ngày giữ cache trước khi cleanup.
- `last_cleanup_at`: Thời điểm cleanup gần nhất.
- `entries_count`: Tổng số bản ghi trong `ai_cache_entries`.
- `last_hit_at`: Thời điểm cache hit gần nhất.
- `all_time_summary`: Tổng hợp từ `ai_cache_runs`.
- `all_time_summary.by_stage`: Phân rã theo từng stage.

## `PUT /api/ai/cache`

**Mục đích:** Cập nhật policy theo kiểu partial update.

**Request Body:**
```json
{
  "enabled": true,
  "validation_enabled": true,
  "deep_audit_enabled": false,
  "cross_check_enabled": true,
  "retention_days": 14
}
```

**Quy tắc:**

- Chỉ cần gửi các field muốn đổi.
- `retention_days` phải nằm trong khoảng `1..3650`.
- Sau khi lưu policy, backend sẽ chạy cleanup expired entries trước khi trả response.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "enabled": true,
    "validation_enabled": true,
    "deep_audit_enabled": false,
    "cross_check_enabled": true,
    "retention_days": 14,
    "last_cleanup_at": "2026-04-22T09:20:00+00:00",
    "entries_count": 96,
    "last_hit_at": "2026-04-22T09:12:31+00:00",
    "all_time_summary": {
      "hits": 320,
      "misses": 96,
      "writes": 96,
      "saved_input_tokens": 184220,
      "saved_output_tokens": 33840,
      "saved_cost_usd": 2.418,
      "hit_rate": 0.7692,
      "by_stage": {}
    }
  }
}
```

**Response (422):**

FastAPI/Pydantic sẽ trả lỗi validation nếu `retention_days` ngoài giới hạn hoặc kiểu dữ liệu không hợp lệ.

## `DELETE /api/ai/cache`

**Mục đích:** Xoá toàn bộ dữ liệu trong `ai_cache_entries` và `ai_cache_runs`.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "enabled": true,
    "validation_enabled": true,
    "deep_audit_enabled": true,
    "cross_check_enabled": true,
    "retention_days": 30,
    "last_cleanup_at": "2026-04-22T09:25:00+00:00",
    "entries_count": 0,
    "last_hit_at": null,
    "all_time_summary": {
      "hits": 0,
      "misses": 0,
      "writes": 0,
      "saved_input_tokens": 0,
      "saved_output_tokens": 0,
      "saved_cost_usd": 0.0,
      "hit_rate": 0.0,
      "by_stage": {}
    }
  }
}
```

## Ghi chú vận hành

- `AI Cache` hiện được điều khiển từ dashboard qua route `/ai-cache`.
- Xoá cache không làm hỏng audit history đã lưu; chỉ làm các request AI kế tiếp phải tính lại từ đầu.
- Cost tiết kiệm trong `all_time_summary.saved_cost_usd` phụ thuộc pricing catalog. Nếu model chưa có giá trong `AI Ops`, giá trị có thể là `0`.
- Mặc định `.env.example` đang dùng `AI_MODEL=cx/gpt-5.4-mini`.
