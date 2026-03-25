# Real-time Audit Streaming

Tính năng Real-time Audit cho phép người dùng theo dõi tiến độ và chi tiết quá trình quét mã nguồn (Static Analysis) ngay lập tức trên màn hình Dashboard mà không cần phải chờ đợi quá trình hoàn tất hay F5 lại trang tải liên tục (Polling).

## 🚀 Cơ chế hoạt động (Server-Sent Events)

Hệ thống sử dụng giao thức **SSE (Server-Sent Events)** để đẩy log từ Server xuống Client một chiều (unidirectional):

1. **Khởi tạo kết nối**: Khi quá trình audit bắt đầu (qua Remote Git Repository), Frontend kết nối tới endpoint SSE (`/api/audit/logs`) thông qua đối tượng `EventSource`.
2. **Góp nhặt Log (Log Intercepting)**: Tại `src/api/api_server.py`, một `AuditLogHandler` (custom logging handler) được gắn vào root logger. Handler này bắt toàn bộ output từ hệ thống phân tích và đẩy vào một bộ đệm vòng (ring buffer) `AuditState.logs` (chứa tối đa 500 dòng).
3. **Streaming Data**: Hàm generator `stream_audit_logs` liên tục quét mảng `AuditState.logs` mỗi 0.5s. Nếu có log mới, nó đóng gói dưới dạng bản tin SSE (`data: <message>\n\n`) và gửi xuống Client.
4. **Hiển thị**: Client (Dashboard) nhận dữ liệu qua `onmessage` và cập nhật giao diện Termnial UI theo thời gian thực.
5. **Hủy/Đóng kết nối**: Client ngắt kết nối khi tab đóng hoặc nhận được tín hiệu hoàn thành. Backend cũng hỗ trợ API `/audit/cancel` để chủ động dừng tiến trình qua cờ hiệu `AuditState.is_cancelled`.

## 📂 Thành phần mã nguồn liên quan

- Trạng thái toàn cục (State Container): [`src/api/audit_state.py`](../../src/api/audit_state.py)
- API endpoint và Logger Interceptor: [`src/api/api_server.py`](../../src/api/api_server.py)
