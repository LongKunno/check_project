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

## 5. AI Cache Console
Kiểm tra khả năng quan sát, đổi policy và clear cache từ màn hình vận hành.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-CACHE-01** | Tải trạng thái cache | 1. Mở `/ai-cache`. | 1. UI gọi `GET /api/ai/cache` thành công. <br> 2. Hiển thị đúng `enabled`, `retention_days`, `entries_count`, `last_hit_at`. |
| **TC-CACHE-02** | Cập nhật toggle từng stage | 1. Tắt `deep_audit_enabled`. <br> 2. Lưu policy. | 1. UI gọi `PUT /api/ai/cache`. <br> 2. Reload màn hình vẫn giữ đúng state mới. |
| **TC-CACHE-03** | Thay đổi retention days | 1. Đặt `retention_days = 14`. <br> 2. Lưu policy. | 1. Backend chấp nhận giá trị hợp lệ `1..3650`. <br> 2. `last_cleanup_at` được cập nhật sau khi lưu. |
| **TC-CACHE-04** | Xoá toàn bộ cache | 1. Bấm nút clear cache. <br> 2. Xác nhận thao tác xoá. | 1. UI gọi `DELETE /api/ai/cache`. <br> 2. `entries_count` về `0`. <br> 3. Các run/entry cache cũ không còn trên màn hình. |

---

## 6. AI Ops Explorer & Pricing Research
Kiểm tra phần mở rộng của AI Ops để đảm bảo slice observability khớp với docs mới.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-AIOPS-01** | Nạp filter metadata | 1. Mở `/ai-ops`. <br> 2. Chọn date range có dữ liệu. | 1. UI gọi `GET /api/ai/filters/meta`. <br> 2. Bộ lọc project/source/provider/model được populate đúng. |
| **TC-AIOPS-02** | Pricing research | 1. Mở form research pricing. <br> 2. Nhập `provider`, `mode`, `model`. | 1. UI gọi `POST /api/ai/pricing/research`. <br> 2. Trả về suggestion, source label và source URL. |
| **TC-AIOPS-03** | Cost = 0 khi thiếu pricing row | 1. Xoá pricing của model đang dùng. <br> 2. Chạy một luồng AI mới. | 1. Request vẫn được log bình thường. <br> 2. Cost hiển thị `0` thay vì làm hỏng dashboard. |

---

## 7. No-DB Fallback & Persistence Boundaries
Khóa rõ hành vi khi `DATABASE_URL` không tồn tại hoặc Postgres tạm thời không reachable.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-NODB-01** | Danh sách repo vẫn hoạt động | 1. Gỡ `DATABASE_URL`. <br> 2. Mở `/repositories`. | 1. UI vẫn tải được danh sách repo từ fallback in-memory. <br> 2. Không có audit history giả lập. |
| **TC-NODB-02** | Repository scores không giả lập audit | 1. Gỡ `DATABASE_URL`. <br> 2. Mở `/project-scores`. | 1. `GET /api/repositories/scores` vẫn trả repo list. <br> 2. Các trường `latest_score`, `latest_rating`, `latest_timestamp`, `pillar_scores` là `null` nếu không có dữ liệu persist. |
| **TC-NODB-03** | Engine settings update trả lỗi rõ ràng | 1. Gỡ `DATABASE_URL`. <br> 2. Từ Settings UI thử đổi `AI Enabled`. | 1. `GET /api/settings/engine` vẫn đọc effective config từ `.env`/default. <br> 2. `PUT /api/settings/engine` trả `503` với thông điệp rõ rằng persistence không khả dụng. |

---

## 8. Baseline + Regression Gate
Xác nhận cơ chế so sánh với scan liền trước và hiển thị cảnh báo mềm hoạt động đúng.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-REG-01** | Baseline = scan liền trước | 1. Chạy scan A. <br> 2. Chạy scan B. <br> 3. Chạy scan C cùng repository. | 1. Scan B so với A. <br> 2. Scan C so với B. <br> 3. Không dùng scan cũ hơn làm baseline. |
| **TC-REG-02** | Score drop trigger warning | 1. Giảm score vượt `regression_score_drop_threshold`. <br> 2. Mở `/project-scores` hoặc `/history`. | 1. `regression_status = warning`. <br> 2. Summary line hiển thị delta score âm. |
| **TC-REG-03** | Multi-signal warning | 1. Tạo scan mới vừa giảm score vừa tăng violations. | 1. `regression_summary.triggered_signals` chứa nhiều tín hiệu. <br> 2. UI vẫn chỉ hiện một badge `Warning`, không duplicate trạng thái. |
| **TC-REG-04** | Gate off vẫn không mất baseline metadata | 1. Tắt `regression_gate_enabled` trong Settings. <br> 2. Chạy scan mới. | 1. Hệ thống vẫn tính delta baseline. <br> 2. UI hiển thị trạng thái `Gate Off` hoặc tương đương `pass` không cảnh báo cứng. |
| **TC-REG-05** | Chưa có baseline | 1. Scan repository lần đầu. | 1. `regression_status = unavailable`. <br> 2. UI hiển thị `No Baseline` thay vì lỗi hoặc cảnh báo giả. |

---

## 9. Trend Dashboard
Kiểm tra dữ liệu trend ở cả mức portfolio và repository.

| ID | Tên Test Case | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **TC-TREND-01** | Portfolio trends load | 1. Mở `/trends`. | 1. UI gọi `GET /api/trends/portfolio`. <br> 2. KPI tổng hợp và chart average score hiển thị đúng. |
| **TC-TREND-02** | Chuyển range 7/30/90 ngày | 1. Đổi bộ lọc range. | 1. UI refetch cả portfolio và repository trends với `days` tương ứng. <br> 2. Chỉ chấp nhận `7`, `30`, `90`. |
| **TC-TREND-03** | Top regressing repos | 1. Có ít nhất 2 repo đang `warning`. <br> 2. Mở card `Top regressing repositories`. | 1. Danh sách sắp theo mức regress nặng hơn lên trước. <br> 2. Có repo name và summary line rõ ràng. |
| **TC-TREND-04** | Repository empty state | 1. Không chọn repository ở sidebar. <br> 2. Mở `/trends`. | 1. Khối portfolio vẫn hoạt động. <br> 2. Khối repository hiển thị empty state hướng dẫn chọn repo. |
| **TC-TREND-05** | Regression events timeline | 1. Chọn repository có warning history. | 1. UI gọi `GET /api/trends/repository`. <br> 2. Phần `regression_events` liệt kê đúng timestamp, signals và badge trạng thái. |

---

## Ghi chú cho Pentest/Security
> [!CAUTION]
> Luôn kiểm tra tính an toàn của đường dẫn (`target_id`) để tránh lỗ hổng Directory Traversal khi gọi API History/Audit bằng các payload như `../../etc/passwd`. Hệ thống đã được cấu hình middleware chặn các ký tự này.

---
*Duy trì bởi Antigravity AI.*
