# Tài liệu Đặc tả Test Cases Chi tiết (V2.1)

Tài liệu này cung cấp các kịch bản kiểm thử (Test Cases) chi tiết cho các tính năng cốt lõi vừa được cập nhật, giúp đảm bảo hệ thống hoạt động ổn định và chính xác theo thiết kế.

---

## 1. Batch Audit (Scan All) - Quét hàng loạt dự án
Tính năng này cho phép quét tuần tự toàn bộ các dự án đã cấu hình từ màn hình Portfolio.

| ID | Tên Test Case | Các bước thực hiện (Pre-conditions) | Kết quả mong đợi (Expected Results) |
| :--- | :--- | :--- | :--- |
| **TC-BA-01** | Kích hoạt Scan All | 1. Mở `/project-scores`. <br> 2. Nhấn nút **Scan All**. | 1. Nút chuyển sang trạng thái "Dừng" (X màu đỏ). <br> 2. Xuất hiện thanh trạng thái Audit tuần tự phía trên. <br> 3. Badge "Đang phân tích" xuất hiện trên thẻ (Card) của dự án đầu tiên. |
| **TC-BA-02** | Quét tuần tự (Queue) | 1. Chờ dự án đầu tiên hoàn thành. | 1. Dự án 1 chuyển sang trạng thái "Hoàn tất" (Badge xanh). <br> 2. Dự án 2 tự động chuyển sang "Đang phân tích" mà không cần can thiệp. |
| **TC-BA-03** | Dừng quét (Cancel Batch) | 1. Khi đang quét Package 2/N, nhấn nút **Dừng**. | 1. Backend nhận tín hiệu cancel. <br> 2. Loading spinner dừng lại. <br> 3. Các dự án chưa quét vẫn giữ nguyên trạng thái cũ. |
| **TC-BA-04** | Xử lý lỗi trong Batch | 1. Cấu hình 1 dự án có repo URL sai. <br> 2. Chạy Scan All. | 1. Dự án lỗi hiển thị Badge "Lỗi" (màu đỏ) kèm tooltip thông báo. <br> 2. Hệ thống KHÔNG dừng lại mà tiếp tục quét dự án kế tiếp trong danh sách. |

---

## 2. Real-time Logs & Terminal UI
Kiểm tra khả năng hiển thị log thời gian thực qua SSE và các tính năng tương tác của Terminal.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-LOG-01** | Kết nối SSE khi quét | 1. Bắt đầu quét một dự án. <br> 2. Quan sát khung Terminal. | 1. Log bắt đầu chảy xuống liên tục ngay khi backend bắt đầu clone. <br> 2. Trạng thái kết nối (đèn tín hiệu) báo xanh. |
| **TC-LOG-02** | Gom nhóm Accordion | 1. Quan sát cách hiển thị log các bước `[1/5]`, `[2/5]`. | 1. Các bước đã xong tự động đóng (Collapse). <br> 2. Bước hiện tại tự động mở (Expand) và cuộn xuống dưới cùng. |
| **TC-LOG-03** | Màu sắc & Định dạng | —— | 1. **Cyan**: Tên tệp tin. <br> 2. **Rose/Red**: Lỗi vi phạm. <br> 3. **Emerald/Green**: False Positive bị AI gạt bỏ. |
| **TC-LOG-04** | Thanh trạng thái log | 1. Quan sát dòng text phía trên terminal. | 1. Hiển thị đúng tên tệp đang xử lý (không bị trôi bởi log body). <br> 2. Hiệu ứng nhấp nháy/vòng lặp khi đang xử lý AI Deep Audit. |

---

## 3. Persistence & State Recovery (Reload Support)
Kiểm tra khả năng "sống sót" của dữ liệu và tiến trình sau khi tải lại trang hoặc mất kết nối.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-RES-01** | F5 khi đang Scan All | 1. Chạy Scan All. <br> 2. Khi đang quét dở, nhấn F5 (Reload) trình duyệt. | 1. Dashboard nạp lại nhưng ngay lập tức bắt lại tiến trình cũ (Polling/SSE nối tiếp). <br> 2. Tiến trình quét không bị reset về 0 mà tiếp tục từ dự án hiện tại. |
| **TC-RES-02** | Persistence dự án gần nhất | 1. Quét hoàn tất dự án "A". <br> 2. Tắt trình duyệt, mở lại trang Dashboard (`/`). | 1. Trang `/` tự động chuyển hướng về `/project-scores`. <br> 2. Hệ thống tự động chọn dự án "A" (do mới nhất) và nạp kết quả của nó vào Dashboard mặc định. |
| **TC-RES-03** | Khôi phục Terminal Log | 1. Reload trang khi terminal đang chạy. | 1. Terminal nạp lại các dòng log cũ (buffer 500 dòng) từ backend để người dùng nắm bắt ngữ cảnh đã qua. |

---

## 4. Smart Initial Selection (Dashboard Default)
Kiểm tra logic tự động lựa chọn dự án thông minh để tối ưu UX.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-SEL-01** | Chọn dự án theo History | 1. Dự án "X" có lần đánh giá lúc 10:00. <br> 2. Dự án "Y" có lần đánh giá lúc 10:30. <br> 3. Mở Dashboard. | 1. Sidebar Project Selector tự động chọn "Y". <br> 2. Màn hình Audit hiển thị toàn bộ chỉ số của dự án "Y". |
| **TC-SEL-02** | Fallback khi chưa có History | 1. (Xóa sạch DB) <br> 2. Mở Dashboard. | 1. Hệ thống tự động chọn dự án đầu tiên trong danh sách `CONFIGURED_REPOSITORIES`. <br> 2. Dashboard hiển thị trạng thái "Chưa có dữ liệu/Cần quét". |
| **TC-SEL-03** | Điều hướng từ Project Card | 1. Tại `/project-scores`, click vào card dự án "Z". | 1. Màn hình chuyển sang `/audit`. <br> 2. Sidebar update selection thành dự án "Z". |

---

## Ghi chú cho Pentest/Security
> [!CAUTION]
> Luôn kiểm tra tính an toàn của đường dẫn (`target_id`) để tránh lỗ hổng Directory Traversal khi gọi API History/Audit bằng các payload như `../../etc/passwd`. Hệ thống đã được cấu hình middleware chặn các ký tự này.

---
*Duy trì bởi Antigravity AI.*
