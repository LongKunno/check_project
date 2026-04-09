# Natural Language Rule Engine (NLRE) & Rule Manager

## Tổng quan
Hệ thống quản lý luật đánh giá (Rule Manager) bao gồm 3 phần chính:
1. **Luật Mặc định (Core Rules):** Các luật kỹ thuật được định nghĩa sẵn bởi hệ thống, phát hiện bằng **Regex + AST** (như SQL Injection, Code Smells...). Người dùng có thể Tắt/Bật bất cứ luật nào nếu thấy không phù hợp với dự án.
2. **Luật AI-Only (Deep Audit Rules):** Các luật chỉ có thể được phát hiện bởi AI Deep Audit — không có regex hay AST. Hệ thống **tự nhận diện** bằng quy tắc: `regex=null` + `ast=null` + `ai≠null` → AI-only rule. Chỉ cần thêm rule vào `rules.json` theo format này là tự động hoạt động, không cần sửa code.
   - Hiện tại gồm 6 luật: `UNCHECKED_NONE_RETURN`, `SILENT_DATA_CORRUPTION`, `INCONSISTENT_RETURN_TYPE`, `REDUNDANT_DB_QUERY`, `MISLEADING_NAME`, `INSECURE_RANDOM`.
3. **Luật Tùy chỉnh (NLRE):** Tính năng đột phá cho phép mô tả mong muốn thiết lập luật bổ sung bằng Tiếng Việt. AI Agent sẽ hiểu và tạo ra AST & Regex Rules.

Đặc biệt, Code Auditor sử dụng **Two-Stage Audit Pipeline**:
- **Stage 1 (Static Check):** Quét siêu nhanh bằng RegEx và AST Python.
- **Stage 2 (AI Gatekeeper):** AI làm nhiệm vụ rà soát toàn bộ các lỗi tìm được từ Stage 1 nhằm tự động gạt bỏ False Positives. Cả lỗi mặc định và lỗi tùy chỉnh đều bị kiểm tra khắt khe.
- **Stage 3 (AI Deep Audit):** AI quét sâu toàn bộ source code để tìm lỗi logic/kiến trúc. Tại bước này, các luật **AI-Only** được inject vào prompt để AI kiểm tra có hệ thống, và trả về `rule_id` cụ thể thay vì gom chung `AI_REASONING`.

## Điểm Nổi Bật của Rule Manager Mới (V2)
1. **Dễ tiếp cận:** Cung cấp sẵn kho **Prompt Templates Gallery** (VD: Cấm eval, Cấm Hardcode, Giới hạn dòng lệnh) bắt mắt và chỉ cần nhấp để tự động điền prompt.
2. **Interactive Sandbox & Streaming UX:** 
   - Giao diện tách biệt hoàn toàn giữa **Danh sách Rule** và **Tạo Rule AI**. 
   - Tích hợp hiệu ứng **Real-time Streaming (Chain-of-Thought)** hiển thị suy nghĩ của AI khi gen rule.
   - Tính năng Chạy Thử cho phép mô phỏng thực tế xem luật bắt có đúng không, hỗ trợ **Quét 3 Lớp y hệt Auditor (3-Phase Sandbox Audit)**: 
      - (1) Quét Tĩnh
      - (2) AI Gác Cổng (chống báo sai)
      - (3) AI Deep Audit (để test luật AI-Only).
3. **Smart Auto-Healing (AI Gỡ lỗi JSON):** Khả năng gửi lỗi JSON hoặc False Postives từ Test Case ngược lại cho AI thông qua nút bấm **✨ Auto Fix bằng AI**. Hệ thống sẽ tự động gen luồng stream mới khắc phục mã lỗi cấu trúc.
4. **Nâng cấp Quét Ngoại lệ (Exceptions):** Engine đã hỗ trợ phát hiện chuyên sâu cho cả `except:` (Bare except) và `except Exception:` (General Exception catch-all).
5. **Quản trị rủi ro & Trọng số (Weight Override) trực quan:**
   - Cho phép **rê chuột dồn cuộn (Scroll/Wheel)** lên ô số để tinh chỉnh Trọng số Vi phạm tăng/giảm siêu mượt mà.
   - Bất cứ luật gốc (Core Rules) nào gây phiền nhiễu đều có thể "TẮT" (Toggle).
5. **Giảm nhiễu (Zero False Positives):** Nhờ cơ chế AI Gác Cổng (Stage 2), hệ thống loại bỏ những báo cáo sai ngữ cảnh, đảm bảo tính minh bạch.
6. **Cấu hình độc lập & An toàn:** Dành riêng một trang "Cài đặt Cấu hình" chứa **Vùng Nguy Danger Zone** báo đỏ để nhanh chóng khôi phục mặc định.
7. **Tối ưu hiển thị (UI/UX):** Tích hợp tìm kiếm (Search) tốc độ cao và phân nhóm luật theo chuẩn **Pillar** (Security, Performance...) thông qua giao diện Accordion. Việc này giúp quản lý số lượng lớn luật kỹ thuật một cách dễ dàng và đỡ rối mắt.

## Hướng dẫn thao tác Rule Manager
1. Mở trang UI. Nhấp Tab `Danh sách Rule` để sửa đổi Core Rules và Custom Rules bằng thanh trượt trọng số (Mouse wheel).
2. Nhấp Tab `Tạo Rule AI` để mở Sandbox. Chọn Template mồi hoặc gõ mô tả Tiếng Việt. 
3. Nhấn **Biên dịch AI** để sinh ra JSON Rule. (Lưu ý: System sẽ check parse JSON rất nghiêm, cấm dư ngoặc).
4. Khu vực **Code Test** sẽ tự động scale chiều cao giúp bạn gõ thử mã độc, bấm *Run Test* xác nhận độ chuẩn.
5. Cuối cùng, phải ấn "Lưu Tất Cả" thì luật mới chính thức đưa vào dự án chặn lõi.
6. Khi cần làm mới toàn bộ luật của Dự án đang chấm, vào mục *Cài đặt Cấu hình* ở góc dưới cùng > *Reset (Danger Zone)*.
