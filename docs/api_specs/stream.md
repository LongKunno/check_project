# Audit Stream (SSE) Specification

Hệ thống hỗ trợ truyền tải trạng thái/log của quá trình phân tích mã nguồn theo thời gian thực (Real-time) thông qua Server-Sent Events (SSE).

## GET `/audit/logs`

Mở luồng kết nối SSE một chiều từ Server tới Client. Client nên sử dụng API `EventSource` của trình duyệt để lắng nghe.

### Request
- **URL Params**: None
- **Headers**:
  - `Accept: text/event-stream`

### Response (200 OK)
- **Content-Type**: `text/event-stream; charset=utf-8`
- **Cache-Control**: `no-cache`
- **Connection**: `keep-alive`

### Định dạng Dữ liệu (Message Format)

Server trả về các khối dữ liệu dưới dạng plain text tuân thủ chuẩn SSE. Mỗi tin nhắn có tiền tố `data: ` và kết thúc bằng hai dấu xuống dòng `\n\n`.

**Ví dụ một luồng sự kiện (Event Stream):**
```text
data: INFO:root:Bắt đầu quét thư mục /tmp/audit_upload_xyz

data: INFO:src.engine.discovery:Tìm thấy 125 file mã nguồn.

data: WARNING:src.engine.auditor:Phát hiện lỗ hổng SQL Injection tại src/db.py

data: INFO:src.engine.auditor:Quá trình kiểm toán hoàn thành!
```

### Cách tiêu thụ (Usage Example - Frontend)
```javascript
const eventSource = new EventSource("http://localhost:8000/audit/logs");

eventSource.onmessage = function(event) {
    console.log("Log mới từ server:", event.data);
    // Cập nhật giao diện terminal
};

eventSource.onerror = function(err) {
    console.error("Lỗi kết nối SSE:", err);
    eventSource.close();
};
```
