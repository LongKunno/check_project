# AI Static Analysis - Release V1.0.0 (Framework V3)

Dự án này là một nền tảng phân tích tĩnh thông minh được thiết kế để đánh giá chất lượng, bảo mật và hiệu năng của các dự án phần mềm. Phiên bản 1.0.0 tích hợp đầy đủ Web Dashboard, Core Engine mạnh mẽ và hệ thống Deployment qua Docker.

## 🌟 Kiến trúc Hệ thống (System Architecture)

Dự án được cấu trúc theo mô hình Micro-service tối giản:

1. **Frontend Dashboard (`/dashboard`)**: 
   - Ứng dụng Single Page (SPA) xây dựng bằng **React + Vite**, hoạt động với cấu trúc siêu phân tầng bề mặt **Hero Grid 4 Cột** tối ưu hiển thị Data-Dense cho màn hình rộng. 
   - Cung cấp giao diện trực quan với hệ thống **Chart.js** chuyên sâu: Biểu đồ năng lực toàn cảnh (Radar), Tỷ trọng vi phạm (Doughnut), Cột mức độ siêu nghiêm trọng (Bar) và tính năng định vị nhanh **Top 5 Tệp Tin Nhiều Lỗi Nhất**. Hỗ trợ upload mã nguồn (nhiều files) trực tiếp từ trình duyệt hoặc nạp Repo qua Remote URL.
2. **Backend API (`/src/api`)**: 
   - Phát triển bằng **FastAPI**, cung cấp các endpoint RESTful để nhận/xử lý source code và truy vấn kết quả.
   - Hỗ trợ xử lý dự án lớn (đã bypass giới hạn Starlette để nhận lên tới 100,000 files cùng lúc).
3. **Core Auditor Engine (`/src/engine`)**: 
   - Bộ mã lõi chạy ngầm sử dụng Python. Hoạt động trên 5 bước: Khám phá tài nguyên (Discovery) -> Quét chuyên sâu (Scanning) -> Xác thực tự động bằng AST/Regex (Verification) -> Tổng hợp (Aggregation) -> Báo cáo (Reporting).
4. **Cơ sở dữ liệu (Database)**: 
   - Sử dụng **SQLite** (`auditor_v2.db`) để lưu trữ vững chắc toàn bộ lịch sử điểm số, metrics (LOC) và các tiêu chí vi phạm cho từng lần kiểm toán.

---

## 🧭 Cốt lõi của Bộ Máy Kiểm Toán (Core Engine)

Hệ thống hoạt động dựa trên nguyên tắc "Chỉ phân tích tĩnh" (**Static-Only**), đảm bảo an toàn và tối đa tốc độ quét. Đánh giá chia thành 4 trụ cột (Pillars) trọng điểm:

1. **Hiệu năng (Performance - 30%)**: Tối ưu hóa Database/BigQuery, quản lý bộ nhớ, độ trễ API, hiệu suất loop/nhóm dữ liệu.
2. **Bảo trì (Maintainability - 25%)**: Các mã thừa (Code smells), tuân thủ kiến trúc, quy ước code (ví dụ PEP8, Type Hints), và tài liệu giải thích.
3. **Độ tin cậy (Reliability - 25%)**: Quản trị ngoại lệ bắt buộc, độ bao phủ mã nguồn theo logic, quản lý Null/Undefined, tính ổn định kết nối.
4. **Bảo mật (Security - 20%)**: Ngăn rò rỉ secret/key, kiểm soát xác thực & phân quyền (Auth), hạn chế Injection (SQLi/XSS), bảo vệ phụ thuộc gói (Dependencies).

---

## 🚀 Hướng dẫn Quản trị (Project Management)

Hệ thống được thiết kế để chạy mượt mà thông qua Docker Compose và script khởi động nhanh gọn. Không cần phải nhớ các câu lệnh Docker dài dòng.

### Để chạy dự án nhanh chóng:
Chỉ cần gọi script quản lý:
```bash
./manage.sh
```
Hệ thống sẽ bật lên một menu tương tác:
1. `Start (Fast)`: Khởi chạy dự án nền web nhanh không qua build lại (dùng Docker Compose).
2. `Start (Rebuild)`: Khởi tạo, cài đặt lại toàn bộ gói dependency và chạy dịch vụ (+ Rebuild image).
3. `Build Only`: Chỉ build các Docker image mà không chạy.
4. `Stop`: Tắt toàn bộ hệ thống ngay lập tức.
5. `Status`: Xem các cổng (ports) và containers đang hoạt động.
6. `Logs`: Xem màn hình console của backend và frontend trực tiếp.

### Cổng dịch vụ khả dụng (Sau khi start):
- **Web Dashboard (Vite HMR Mode)**: [http://localhost:3000](http://localhost:3000)
- **Backend API Server**: [http://localhost:8000](http://localhost:8000)
- **API Swagger/OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠 Chế độ Hoạt động (Usage Modes)

1. **Dashboard UI (Khuyên dùng)**: Kéo thả các tệp tin trong thư mục mã nguồn vào luồng Upload của Web App. Phân tích trực quan.
2. **Terminal CLI (Kiểm toán nội bộ)**: 
   Chạy code quét trực tiếp không qua UI đối với thư mục bất kỳ:
   ```bash
   python3 main.py /duong/dan/toi/thu_muc_code/
   ```
   *Báo cáo Markdown chi tiết sẽ được tự động xuất vào thư mục `/reports/Final_Audit_Report.md`.*

---

*Khung đánh giá và chấm điểm này dựa trên các tiêu chuẩn quốc tế thực tế bao gồm ISO/IEC 5055:2021, ISO/IEC 25010 và các chuẩn OWASP/CWE.*
