---
trigger: always_on
---

# 1. KIỂM TRA NGỮ CẢNH DỰ ÁN (INITIALIZATION CHECK)
Ngay khi bắt đầu một phiên làm việc, bạn phải tự động kiểm tra xem thư mục gốc của dự án có chứa thư mục `docs/` hay không. Tùy thuộc vào kết quả, hãy áp dụng TẬP LUẬT tương ứng dưới đây.

Nếu phát hiện thư mục `docs/`, bạn lập tức kích hoạt chế độ "Technical Architect". Toàn bộ trí nhớ, tiến độ và quyết định kỹ thuật của dự án được lưu trữ dưới dạng tài liệu MkDocs trong thư mục `docs/`. 

Lúc này, bạn PHẢI tuân thủ QUY TẮC AN TOÀN BẮT BUỘC (ở Trường hợp A) VÀ TOÀN BỘ các quy chuẩn dưới đây:

## QUY TRÌNH CHECK-IN / CHECK-OUT (MEMORY LOOP)
- **Trước khi code:** TỰ ĐỘNG đọc toàn bộ file trong `docs` để nắm bối cảnh. Cần kiểm tra kĩ nếu dự án có docker thì cần thực hiện các lệnh ở trong docker, trừ các trường hợp bắt buộc chạy ở ngoài.
- **Sau khi code (CRITICAL RULE):** NGHIÊM CẤM AI (Assistant) báo cáo "hoàn thành" chức năng hoặc kết thúc giao tiếp nếu chưa thực hiện bước rà soát và update thư mục `docs/`. Bạn PHẢI đối chiếu những thay đổi trong source code với tài liệu hiện tại, sau đó tự động update/tạo mới file `.md` tương ứng. Nếu vi phạm, phiên làm việc sẽ bị đánh giá là THẤT BẠI nghiêm trọng.
- **Bảo vệ MkDocs:** Khi tạo file `.md` mới, phải cập nhật file `mkdocs.yml` (`nav` section).

## QUY CHUẨN TÀI LIỆU HÓA (LIVING DOCUMENTATION V4)

### 1. Update thông tin thay đổi của tính năng (`docs/features`)
Chi tiết, chính xác để Ai có thể dọc hiểu mà không cần đọc code

### 2. API & Database Specifications
- **API (`docs/api_specs/`)**: Rõ ràng Endpoint, Method, Mục đích, Params, và JSON Response Format (200/400/500).
- **Database (`docs/database/`)**: Mô tả Schema bằng bảng và nêu rõ các mối quan hệ.

### 3. Tài liệu Kiến trúc (`docs/architecture/`)
Mọi component hoặc luồng dữ liệu mới phải có:
- **Data Flow**: BẮT BUỘC dùng Mermaid diagram để trực quan hóa.
- **Interface/Contract**: Input/Output rõ ràng giữa các service.
- **Security & Performance**: Giới hạn hiệu năng và bảo mật.

### 4. Quy tắc ADR (Architecture Decision Records)
- Problem, Options, Decision & Why, Consequences.

### 5. Ngôn ngữ, Số liệu & Liên kết
- Cấm cảm tính, bắt buộc định lượng (VD: Giảm độ trễ từ 500ms -> 100ms).
- Liên kết Source Code BẮT BUỘC dùng đường dẫn tương đối (Relative path).

### 6. ĐẶC QUYỀN MỞ RỘNG & LÀM RÕ (PROACTIVE CLARIFICATION)
Bên cạnh các cấu trúc bắt buộc trên, bạn được KHUYẾN KHÍCH tự do thêm các heading, section hoặc ghi chú mới vào tài liệu nếu điều đó giúp việc giải thích kiến trúc hoặc code trở nên trực quan, chi tiết và dễ hiểu hơn. 

Các phần bạn NÊN chủ động bổ sung khi thấy cần thiết:
- **Edge Cases & Gotchas:** Các trường hợp ngoại lệ, lỗi tiềm ẩn, rủi ro race-condition và cách phòng tránh.
- **Code Snippets / Examples:** Thêm các đoạn code mẫu (Usage Examples) minh họa cách gọi một Service, cách dùng một hàm tiện ích (Utils), hoặc cách chạy test.
- **Troubleshooting / FAQ:** Cách debug nếu service này chết, hoặc cách kiểm tra log trên server.
- **Sơ đồ bổ trợ:** Nếu logic quá phức tạp, đừng ngại vẽ thêm nhiều sơ đồ Mermaid (State Diagram, Class Diagram) để giải thích từng bước.
