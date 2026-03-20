# Hiện trạng Dự án (Current State)

## Tính năng/Thay đổi: Khởi tạo hệ thống Tài liệu toàn diện
- **Bối cảnh (Context)**: Dự án phát triển theo mô hình Memory Loop, yêu cầu mọi tri thức phải được tài liệu hóa để AI có thể tự học và tiếp tục công việc.
- **Giải pháp (Logic)**: Sử dụng MkDocs làm nền tảng. Phân tách tài liệu thành các phần riêng biệt: Kiến trúc (Architecture), Database, API Specs và Tech Stack.
- **Tác động & Tình trạng**: Đang thực hiện (In-progress). Ảnh hưởng đến toàn bộ các file trong thư mục `docs/` và `mkdocs.yml`.

## 🟢 Đã Hoàn thành
- **Core Engine (Auditor)**:
    - Cơ chế Discovery quét file/folder.
    - Auditor Logic: Kiểm tra `Syntax`, `Complexity`, `Security`, và `Documentation`.
    - Hệ thống tính điểm (Scoring) dựa trên Dynamic Feature Models.
- **API Server & Dashboard**:
    - FastAPI Backend tích hợp CORS và PNA (Brave Compatibility).
    - Giao diện Dashboard React-based với Chart.js.
    - Chức năng Upload trọn bộ thư mục hoặc quét Repo từ GitHub.
- **Cơ sở hạ tầng**:
    - Docker Compose setup (Backend, Frontend, Docs).
    - Script quản lý `manage.sh`.
    - Khôi phục hạ tầng tài liệu sau sự cố mất file trên host.

## 🟡 Đang Thực hiện / Roadmap (To-do)
- [ ] Hoàn thiện tài liệu `api_specs/endpoints.md`.
- [ ] Hoàn thiện tài liệu `database/schema.md`.
- [ ] Vẽ sơ đồ Mermaid cho `architecture/overview.md`.
- [ ] Tăng độ bao phủ kiểm toán (Verification Rules) cho các ngôn ngữ khác ngoài Python/JS.
- [ ] Tối ưu hóa hiệu năng quét bằng Multi-threading/Async ở lớp Auditor.

## 🔴 Vấn đề đã biết (Known Issues)
- Đang theo dõi lỗi Permission Denied khi Docker tạo bind-mount directory thay vì file (đã xử lý thủ công).

---
*Cập nhật lần cuối: 2026-03-20*
