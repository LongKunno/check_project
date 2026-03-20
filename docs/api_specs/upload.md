# API - Audit Upload File

Sử dụng để thực hiện việc upload trực tiếp các file từ máy local hoặc trình duyệt tới server để kiểm toán.

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
*Duy trì bởi Technical Architect.*
