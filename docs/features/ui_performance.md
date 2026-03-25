# High-Performance UI (Dark Mode)

## Tổng quan
Giao diện Code Auditor được tối ưu hóa đặc biệt để mang lại trải nghiệm nhanh, mượt mà và tập trung (Snappy & Focused) thông qua chế độ **Dark Performance Mode**.

## Các đặc điểm chính
1. **Bảng màu Slate 950:** Sử dụng tông tối sâu giúp giảm mỏi mắt và tiết kiệm năng lượng cho màn hình OLED.
2. **GPU Optimization:** 
    - Loại bỏ các hiệu ứng GPU-heavy như mesh gradient chuyển động.
    - Chuyển sang nền gradient tĩnh (static) thay vì diễn hoạt liên tục (đã giảm opacity chói của các đốm nền xuống 0.1 để người dùng tập trung hơn).
3. **Glassmorphism Tối giản:**
    - Giảm độ nhòe (Backdrop Blur) từ 40px xuống **8px - 12px**.
    - Giảm cường độ bão hòa (Saturate) để trình duyệt render nhanh hơn trên các thiết bị cấu hình thấp.
4. **Motion Stripping:**
    - Lược bỏ các hiệu ứng `floating` (bay lơ lửng) của Framer Motion.
    - Thay thế các hiệu ứng `scale` và `lift` khi hover bằng các transition CSS đơn giản (`translateY(-2px)`).
5. **High Contrast Metrics & Readability:** 
    - **Thẻ (Cards):** Độ mờ nền (opacity) tăng lên `0.85` và viền sáng hơn (`rgba(255, 255, 255, 0.12)`) giúp phân tách rõ nét với background tối sâu (`#020617`).
    - **Biểu đồ (Chart.js):** Sử dụng lưới biểu đồ (`rgba(255, 255, 255, 0.1)`) và nhãn sáng màu (`#f8fafc`) khắc phục lỗi chữ chìm (tàng hình) trên nền slate-950.
    - **TerminalLogs:** Tăng kích thước phông chữ lên `0.9rem` và sử dụng màu chữ Neon Green (`#34d399`) đảm bảo developer đọc log thoải mái trong nhiều giờ.
6. **CSS Variational Theme (Light/Dark Mode):** 
    - Nhằm hỗ trợ Giao diện sáng song song với nền Dark Mode chuẩn, hệ thống KHÔNG lạm dụng class `dark:...` của Tailwind. Thay vào đó, áp dụng tiêm biến toàn cục (CSS Variables Override) thông qua class `html.light` tại `index.css`. Giúp đảo ngược bảng màu tối thành trắng mà không can thiệp sâu vào DOM Tree.
7. **Collapsible Sidebar Layout:**
    - Di chuyển Menu và Project Selector vào thanh Tabbar dọc (Sidebar). Hỗ trợ đóng mở linh hoạt để mở rộng không gian chiều ngang.

## Lợi ích
- **Giảm tải CPU/GPU:** Giảm đáng kể hiện tượng giật lag khi cuộn trang hoặc chuyển Tab.
- **Tập trung vào dữ liệu:** Loại bỏ các yếu tố trang trí dư thừa để người dùng tập trung hoàn toàn vào kết quả Audit.
- **Tính ổn định:** Tránh các lỗi render liên quan đến bộ nhớ đồ họa khi làm việc với các Repository lớn có hàng nghìn vấn đề.
