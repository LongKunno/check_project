# API - Audit Upload File

> [!WARNING]
> **Deprecated UI Feature**
> Tính năng upload file từ Local đã được gỡ bỏ khỏi giao diện Frontend Dashboard để tập trung vào kiến trúc quản trị Remote Repository. 
> API này hiện tại chỉ được duy trì phục vụ **CI/CD Integration** hoặc cho các công cụ tự động (Automation scripts) đẩy code trực tiếp lên máy chủ.

Sử dụng để thực hiện việc upload trực tiếp các file từ máy local tới server để kiểm toán.

- **Endpoint**: `/audit/process`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`

## Tham số (Parameters)
| Tham số | Kiểu | Mô tả |
|---|---|---|
| `files` | Multiple Files | Danh sách các file dự án. Hỗ trợ upload toàn bộ thư mục. |

## Phản hồi mẫu (JSON Response)
```json
{
  "status": "success",
  "project_name": "project_abc",
  "scores": { "final": 8.5 },
  "violations": []
}
```

---
*Duy trì bởi LongDD.*
