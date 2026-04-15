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
   - **Pillar Scores Display (2026-04-15)**: Hiển thị điểm chi tiết 4 trụ cột chất lượng (Performance, Maintainability, Reliability, Security) ngay trên bảng leaderboard dưới dạng **Stacked Mini Pillar Bars**. Mỗi trụ cột có:
     - Badge chữ viết tắt color-coded: `P` (Cyan), `M` (Violet), `R` (Blue), `S` (Rose)
     - Điểm số (thang 10) + thanh progress bar animated (staggered entrance)
     - Dữ liệu lấy từ `pillar_scores` trong `audit_history` thông qua API `GET /api/repositories/scores`
     - Hiển thị "—" cho project chưa scan
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
   - **High-Speed Fetching UX (V2 - Mới)**: Áp dụng cơ chế Background Fetching (Stale-While-Revalidate) và TopProgressBar. Loại bỏ hoàn toàn chớp khung xương (Skeleton Flicker) ở các lần chuyển phân trang hoặc Refetching. Rút gọn độ trễ của Page Transitions từ 0.3s xuống 0.2s loại bỏ blur cho tốc độ chuyển trang "Snappy" tức thì.
   - Chi tiết: Xem [UI Overhaul Documentation](../features/ui_overhaul.md)

 8. **Frontend Architecture Refactor (2026-04-14)**:
    - **Hooks Pattern**: Tách business logic từ `App.jsx` (912 → 470 LOC) thành custom hooks:
      - `useRepositories.js` — Quản lý state repos, fetch từ API, smart auto-selection dựa trên audit history.
      - `useAuditState.js` — Quản lý state audit phức tạp: `data`, `error`, `uploadProgress`, `history`, `fixSuggestions`.
    - **AuditView Decomposition** (1,771 → 435 LOC, giảm 75%):
      - `ViolationLedger.jsx` (~600 LOC) — Self-contained component với internal filter/group/expand state.
      - `ChartsRow.jsx` — Violation Distribution (Doughnut) + Impact Severity (Bar) charts.
      - `RuleBreakdownTable.jsx` — Bảng rule breakdown với sticky header.
      - `TeamLeaderboard.jsx` — Member scores table, sorted by score.
      - `AuditSidebar.jsx` — Audit info panel + Top Problematic Files.
    - **RuleManager Decomposition** (1,444 → 969 LOC, giảm 33%):
      - `RuleManagerParts.jsx` — WeightInput, KpiCard, PillGroup, ToggleSwitch, RuleCard, DiffCard + metadata constants (PILLAR_META, SEVERITY_META).
    - **RuleBuilder Decomposition** (1,216 → 816 LOC, giảm 33%):
      - `RuleBuilderParts.jsx` — Templates, JsonHighlight, Stepper, StreamingTerminal, VisualRuleConfigurator.
    - **Cấu trúc thư mục**:
      - `dashboard/src/hooks/` — Custom hooks (useRepositories, useAuditState)
      - `dashboard/src/components/audit/` — Audit sub-components (ViolationLedger, ChartsRow, RuleBreakdownTable, TeamLeaderboard, AuditSidebar)
      - `dashboard/src/components/nlre/` — Rule management (RuleManager, RuleBuilder, RuleManagerParts, RuleBuilderParts)
 9. **Repository Management (2026-04-14)**:
    - **Trang riêng** tại route `/repositories` — card-based grid layout hiện đại.
    - **Sidebar entry** trong section "Global Views" — truy cập nhanh không phụ thuộc repo context.
    - KPI Row: Total Repos, Active, Providers (auto-detect GitHub/Bitbucket/GitLab).
    - Search bar lọc theo tên, URL, ID.
    - Modal form: thêm/sửa repository với validation.
    - Backend: API `POST/PUT/DELETE /api/repositories` + auto-seed từ `config.py`.
    - File: `dashboard/src/components/views/RepositoryView.jsx`
 10. **Engine Configuration Runtime (2026-04-14)**:
     - Chuyển `AI_ENABLED` và `TEST_MODE_LIMIT_FILES` từ .env sang **Settings UI** (runtime, không restart).
     - Bảng `system_config` (key-value store) trong PostgreSQL.
     - API: `GET/PUT /api/settings/engine`.
     - UI trong `SettingsView.jsx`: Toggle AI ON/OFF, Number input cho file limit, Test AI Connection button.
     - Backend đọc DB trước, fallback `.env`: `get_ai_enabled()`, `get_test_mode_limit()` trong `config.py`.
 11. **Authentication Toggle (2026-04-14)**:
      - Thêm biến `AUTH_REQUIRED` cho phép **bật/tắt** yêu cầu đăng nhập Google OAuth runtime.
      - **Khi bật (mặc định):** Bắt buộc đăng nhập qua Google OAuth, kiểm tra whitelist email.
      - **Khi tắt:** Bypass xác thực, tạo anonymous user, phù hợp cho local dev / demo.
      - **Backend:**
        - Biến `.env`: `AUTH_REQUIRED=true` (default).
        - Config: `AUTH_REQUIRED` trong `src/config.py`, getter `get_auth_required()`.
        - API public: `GET /api/auth/config` — trả `{"auth_required": true/false}` (không cần token).
        - API settings: `GET/PUT /api/settings/engine` — thêm field `auth_required`.
      - **Frontend:**
        - `AuthContext.jsx`: Gọi `/api/auth/config` khi mount, nếu `false` → tạo anonymous user, bypass login. Hàm `logout()` khi auth tắt sẽ không redirect `/login`. Expose `isAnonymous` flag.
        - `ProtectedRoute.jsx`: Kiểm tra `authRequired` từ context, nếu `false` → render children trực tiếp.
        - `SettingsView.jsx`: Toggle switch với icon Lock/LockOpen, cảnh báo amber khi tắt auth.
        - `Sidebar.jsx`: Ẩn nút logout khi `isAnonymous = true` (user ẩn danh không cần đăng xuất).
      - **Cảnh báo bảo mật:** Khi tắt, hiển thị warning banner trên Settings UI.

 12. **Multi-Level Reset System (2026-04-15)**:
      - Thay thế Danger Zone cũ (chỉ có 2 nút Reset All) bằng hệ thống **7 cấp reset** cho Global (3 levels) và Project (4 levels).
      - **GLOBAL** (badge xanh dương):
        - 🟡 **Reset Toggles**: Reset `disabled_core_rules` — bật lại tất cả rules đã tắt
        - 🟠 **Reset Weights**: Reset `custom_weights` — đưa trọng số về mặc định
        - 🔴 **Reset All Global**: Xóa toàn bộ row `GLOBAL` trong DB
      - **PROJECT** (badge xanh lá):
        - 🟡 **Reset Overrides**: Reset `disabled_core_rules` + `enabled_core_rules` — đồng bộ với Global
        - 🟠 **Reset Weights**: Reset `custom_weights` chỉ cho project
        - 🟣 **Reset Custom Rules**: Xóa `compiled_json` + `natural_text` — giữ core rule overrides
        - 🔴 **Reset All Project**: Xóa toàn bộ row project (nuclear option)
      - **API mới:** `POST /api/rules/reset` — nhận `{ target, level }` thay vì `DELETE /api/rules`
      - **Backend:** `AuditDatabase.partial_reset_project_rules(target_id, level)` — UPDATE từng cột thay vì DELETE row
      - **UI:** Mỗi level có emoji + badge màu riêng, double-confirm (4s timeout)
      - **Files:** `SettingsView.jsx`, `src/api/routers/rules.py`, `src/engine/database.py`

---
*Duy trì bởi LongDD.*

