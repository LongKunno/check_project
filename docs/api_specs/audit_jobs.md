# Chi tiết API: Hệ thống Background Jobs (V1.0.0)

Tài liệu thiết kế cấu trúc API theo chuẩn RESTful cho tiến trình chạy ngầm (Kiểm toán Code không đồng bộ).

## 1. `GET /audit/jobs/{job_id}`
Lấy trạng thái và kết quả của một tiến trình đã được giao. Dùng cho cơ chế Long-Polling từ Frontend Hook `useAuditJob`.

- **Method**: `GET`
- **URL Params**:
  - `job_id` (string, required): Mã UUID định danh của Background Job.
- **Response**: Trả về Object `JobStatus` (Pydantic).
  - **200 OK (Đang chạy)**:
    ```json
    {
      "job_id": "84a7e93b-12...",
      "status": "RUNNING",
      "message": "Đang quét AST V1.0.0...",
      "result": null,
      "started_at": 172948123.0,
      "target": "sp-integrate"
    }
    ```
  - **200 OK (Thành công)**:
    ```json
    {
      "job_id": "84a7e93b-12...",
      "status": "COMPLETED",
      "message": "Quét thành công",
      "result": { "status": "success", "metrics": {...}, "scores": {...} },
      "started_at": 172948123.0,
      "ended_at": 172948300.0,
      "target": "sp-integrate"
    }
    ```
  - **404 Not Found**: Lỗi nếu `job_id` đã bị hủy rác hoặc sai.

## 2. `GET /audit/jobs/{job_id}/logs`
Đăng ký nhận Log trực tiếp (Server-Sent Events) dành riêng cho một tiến trình nền. Không bị nhiễu chéo khi có nhiều Job chạy song song.

- **Method**: `GET`
- **Returns**: Stream Header `text/event-stream`.
- **Cấu trúc Sự kiện**: 
  - `data: Đang vào Phase 2... \n\n`
  - Tín hiệu đóng kết nối: `data: [END_OF_STREAM] \n\n`

## 3. `POST /audit/batch` (Mới)
Gửi yêu cầu quét hàng loạt nhiều dự án. Trả về một `job_id` chung dạng batch. Tiến trình sẽ chạy ngầm tuần tự qua từng dự án, bất chấp việc tab trình duyệt bị đóng.

- **Method**: `POST`
- **Body**:
  ```json
  {
    "project_ids": ["project-1", "project-2"]
  }
  ```
- **Response**: Trả về `job_id` dùng để theo dõi tiến độ. Gửi kèm trạng thái.
  ```json
  {
    "status": "started",
    "job_id": "99b7e93b-12...",
    "message": "Bắt đầu quét hàng loạt."
  }
  ```

## 4. `GET /audit/batch/active` (Mới)
Truy xuất nhanh Job Batch hiện đang chạy nền. Được sử dụng để khôi phục kết nối luồng Terminal Logs và cập nhật lại giao diện khi người dùng tải lại trang (reload).

- **Method**: `GET`
- **Response**:
  - Nếu có tiến trình:
    ```json
    {
      "has_active": true,
      "job_id": "99b7e93b-12...",
      "job": { ...JobStatus Object... }
    }
    ```
  - Nếu không có:
    ```json
    {
      "has_active": false
    }
    ```

## 5. Kiến trúc Cội Nguồn
Tất cả các API tạo quy trình quét trước (Vd: `POST /audit/repository`, `POST /audit/process` và `POST /audit/batch`) đều đẩy tiến trình quét vào `fastapi.BackgroundTasks` và hoàn trả tín hiệu lập tức nhằm đảm bảo tính bền bỉ dù kết nối HTTP bị cắt. Theo dõi quá trình qua Job ID.
