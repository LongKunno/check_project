# API Specifications

Hệ thống AI Static Analysis cung cấp các giao diện lập trình (API) để tương tác với bộ máy kiểm toán.

## Base URL
`http://localhost:8000`

---

## 1. Audit Process (Upload)
Thực hiện kiểm toán mã nguồn bằng cách upload các file trực tiếp từ trình duyệt.

- **Endpoint**: `/audit/process`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Parameters**: 
    - `files`: Danh sách các file (hỗ trợ cấu trúc thư mục từ `webkitdirectory`).

### Response (200 OK)
```json
{
  "status": "success",
  "project_name": "my-project",
  "metrics": {
    "total_loc": 1500,
    "total_files": 25
  },
  "scores": {
    "final": 85.5,
    "rating": "🥇 A",
    "features": {
      "auth": {
        "pillars": { "Performance": 9.0, "Security": 8.5, ... },
        "final": 88.0
      }
    }
  },
  "violations": [ ... ]
}
```

---

## 2. Audit Repository (Git)
Thực hiện kiểm toán mã nguồn bằng cách clone từ Git repository.

- **Endpoint**: `/audit/repository`
- **Method**: `POST`
- **Body Content** (JSON):
```json
{
  "repo_url": "https://github.com/user/repo",
  "username": "optional_user",
  "token": "optional_token",
  "id": "optional_preconfigured_id"
}
```

---

## 3. Audit History
Lấy lịch sử các lần kiểm toán đã thực hiện.

- **Endpoint**: `/history`
- **Method**: `GET`
- **Query Params**:
    - `target` (optional): Lọc theo đường dẫn project.

---

## 4. Configured Repositories
Lấy danh sách các repository đã được cấu hình sẵn trong hệ thống.

- **Endpoint**: `/repositories`
- **Method**: `GET`
