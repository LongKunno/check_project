# Interactive Dashboard & Rule Manager

Cung cấp cái nhìn 360 độ về chất lượng project và cho phép người dùng kiểm soát linh hoạt các quy tắc đánh giá bằng AI thông qua Interactive Sandbox.

## Các module cốt lõi
1. **Audit Dashboard**: 
   - Tổng quan thống kê và hiển thị điểm trụ cột (Pillars) thông qua Radar Chart, Doughnut Chart.
   - **Advanced Real-time Terminal Logs (V2 - Mới)**: Thay thế terminal log thuần text bằng giao diện giàu tính năng:
     - **Collapsible Accordion Groups**: Log tự động được gom nhóm theo từng bước kiểm toán `[1/5]`, `[3.6/5]`... Mỗi bước là một khối có thể đóng/mở, chỉ bước đang chạy được tự động mở.
     - **Progress Status Bar**: Một thanh trạng thái xuất hiện phía trên terminal, nhấp nháy tên file đang được Scanner hoặc AI xử lý theo thời gian thực. Tín hiệu `[PROGRESS]` được lọc riêng từ log của backend, không bị bơm vào body tránh spam.
     - **Color Highlighting**: Tên file → Cyan, `False Positive` → Emerald xanh, lỗi/cảnh báo → Rose đỏ, các số liệu thống kê → Amber vàng, tiêu đề bước → Violet tím.
     - **Scroll Isolation (Bugfix 2026-04-06)**: Auto-scroll log sử dụng `container.scrollTop` thay vì `scrollIntoView()` để chỉ cuộn nội bộ bên trong container log. Tránh hiện tượng toàn trang (project table) bị kéo xuống đáy mỗi khi có log mới — đặc biệt quan trọng khi `TerminalLogs` được nhúng trong `ProjectScoresView`.
   - **Violation Ledger (3-Tier Progressive Disclosure — V3)**: Thiết kế xây lại hoàn toàn với 3 tầng hiển thị:
     - **Tầng 0 (Group Headers)**: Vi phạm nhóm theo `rule_id`, mặc định collapse. Header hiển thị: Rule ID (monospace), count badge, Pillar, tổng penalty. Sắp xếp theo tổng penalty giảm dần.
     - **Tầng 1 (Compact File Rows)**: Click group → hiện danh sách file:line compact. Mỗi group chỉ hiện tối đa 5 items, có nút "Show N more". File path là HERO element — to nhất, nổi nhất.
     - **Tầng 2 (Detail Expansion)**: Click 1 file row → mở reason + code snippet + nút Fix AI. Snippet và reason ẩn cho đến khi cần.
     - **Filter Bar**: Bộ lọc theo Severity (All/Critical/Major/Minor/Info) dạng pill buttons color-coded. Search bar tìm theo tên file. Nút "Clear filters" khi không có kết quả.
     - **Expand All / Collapse All**: Toggle toàn bộ groups. Animation mở/đóng bằng Framer Motion `AnimatePresence`.
     - **Empty States**: 3 trạng thái rỗng: no violations, no git history, no filter match (với nút clear).
   - Member/Team Leaderboard: Hiển thị danh sách tác giả dự án kèm theo các thông tin: Total LOC, Score, Penalty (Được tính tổng theo các điểm vi phạm) và Debt (Nợ kỹ thuật).
2. **AI Rule Manager (Mới)**:
   - Giao diện tùy chỉnh luật. Cho phép bật/tắt luật gốc và sử dụng AI (Prompt/Natural Language) để sinh ra luật kiểm duyệt riêng (Regex/AST) cho từng dự án.
3. **Rule Builder** (Đổi tên từ "AI Sandbox" → "Rule Builder" — 2026-04-06): 
   - Môi trường tạo luật kiểm toán bằng ngôn ngữ tự nhiên (Natural Language) và kiểm thử trực tiếp bằng AI Gatekeeper Validation trước khi lưu vào dự án.
4. **Portfolio Overview (Mới)**:
   - Liệt kê và thống kê tổng số điểm, mức độ cảnh báo hiện tại của toàn bộ danh sách dự án. Màn hình giúp theo dõi sức khoẻ tổng quan của hệ thống và các service nhanh chóng nhất thông qua Project Cards.
5. **Smart Initial Selection**: 
   - Điểm vào mặc định của ứng dụng (`/`) tiếp tục giữ nguyên cấu hình điều hướng về Portfolio Overview (`/project-scores`). Tuy nhiên, ở bộ chọn dự án tổng thể của ứng dụng, hệ thống sẽ tự động quét và lựa chọn dự án vừa được chấm điểm (scan) gần nhất giúp người dùng đi tới trang chi tiết Audit Dashboard của dự án đó khi click vào một cách mượt mà nhất.
6. **Collapsible Sidebar Navigation**: 
   - Hệ thống tabbar dọc đóng gọn sát mép trái màn hình bằng Framer Motion, mở rộng tối đa không gian thao tác. 
   - *Bộ chọn Dự Án (Project Selector)* được đặt gọn trong Sidebar, đảm bảo UX thân thiện nhất.
   - **Active Glow Effect (2026-04-06)**: Sidebar items có hiệu ứng glow phát sáng khi active, color-coded theo từng menu item.
7. **UI Overhaul V1 (2026-04-06)**:
   - Design Token System: CSS variables cho spacing, radius, transitions, colors
   - Skeleton Loading: Shimmer animation thay thế spinners trên tất cả views
   - EmptyState Component: Animated empty states với floating dots và glassmorphism
   - Page Transitions: Framer Motion fade+slide+blur giữa các routes
   - Animated Score Ring: SVG circle animation trong AuditView
   - Animated Pillar Bars: Staggered entrance + glow effect
   - HistoryView: KPI cards, relative time, mini score bars
   - SettingsView: System Info, Engine Config, Quick Links sections
   - Chi tiết: Xem [UI Overhaul Documentation](../features/ui_overhaul.md)

---
*Duy trì bởi LongDD.*
