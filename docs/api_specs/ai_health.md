# AI Health Check API

Kiểm tra trạng thái kết nối và tính sẵn sàng của LLM (AI Service).

## Endpoint
`GET /health/ai`

## Purpose
Xác định xem Backend có thể giao tiếp với AI Provider (OpenAI/Gemini/Ollama) hay không.

## Response Format (200 OK)
```json
{
  "status": "healthy",
  "model": "cx/gpt-5.4"
}
```

## Response Format (Error)
```json
{
  "status": "unhealthy",
  "reason": "Connection timed out"
}
```
