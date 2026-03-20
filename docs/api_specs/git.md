# API - Audit Git Repository

Sử dụng để yêu cầu server clone một Git repository từ xa và tiến hành quy trình kiểm toán.

- **Endpoint**: `/audit/repository`
- **Method**: `POST`
- **Content-Type**: `application/json`

## Payload JSON
```json
{
  "repo_url": "https://github.com/user/project",
  "username": "Optional",
  "token": "Optional GitHub PAT",
  "id": "Optional Pre-configured Repository ID"
}
```

## Lưu ý
Hệ thống sẽ clone project vào thư mục `/tmp/` của server, thực hiện kiểm toán và sau đó tự động dọn dẹp để đảm bảo an ninh và hiệu năng.

---
*Duy trì bởi Technical Architect.*
