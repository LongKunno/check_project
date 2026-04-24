# AI Static Analysis - Framework V3

Dự án này là một nền tảng phân tích tĩnh thông minh được thiết kế để đánh giá chất lượng, bảo mật và hiệu năng của các dự án phần mềm.

## 📖 Hệ thống Tài liệu Chính thức (Official Docs)

Toàn bộ tri thức về kiến trúc, quy tắc lập trình và lộ trình phát triển hiện đã được chuyển sang hệ thống **MkDocs**.

👉 **Truy cập ngay tại**: [http://localhost:8001](http://localhost:8001)

### Các nội dung chính trong tài liệu:
- **Trạng thái hiện tại**: Tiến độ thực tế và các vấn đề đang xử lý.
- **Kiến trúc hệ thống**: Chi tiết luồng xử lý và sơ đồ các service.
- **Quy chuẩn Tech Stack**: Các quy tắc code bắt buộc.
- **Roadmap**: Tầm nhìn phát triển trong tương lai.

## 🚀 Khởi động nhanh (Quick Start)

Dự án được quản lý hoàn toàn qua Docker Compose:

```bash
# Khởi động toàn bộ hệ thống (Backend, Frontend, Docs)
./manage.sh
```

- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:8000](http://localhost:8000)
- **Hệ thống Tài liệu**: [http://localhost:8001](http://localhost:8001)

## Lưu ý cấu hình hiện tại

- `AI_MODEL` mặc định trong `.env.example` đang là `cx/gpt-5.4-mini`.
- Dashboard gọi API qua prefix `/api/*`; nginx sẽ proxy về backend FastAPI tại `:8000`.
- Nếu thiếu `DATABASE_URL`, hệ thống chỉ fallback in-memory cho danh sách repository; audit history, rules và engine settings sẽ không được persist.
- Nếu muốn AI Ops hiển thị cost chính xác và áp budget hard-stop, cần cấu hình pricing catalog và budget policy sau khi deploy.

---
*Duy trì bởi LongDD.*
