# Code Discovery Engine (Khám phá tài nguyên)

Tính năng này chịu trách nhiệm thu thập và phân loại toàn bộ tài nguyên trong project mục tiêu.

**Source Code**: [discovery.py](../../src/engine/discovery.py)

## Cách hoạt động

### Phase 1: Xác định Source Directory & Xây dựng bản đồ Django Apps

1. **Source Directory Detection**: Quét root của project để tìm thư mục source chính từ danh sách ưu tiên:
    - Thứ tự ưu tiên: `source_code` > `code` > `src` > `app` > `backend` > `api` > `growme_app` > `growme_api`
    - Engine chọn thư mục **đầu tiên** tìm được và chỉ quét bên trong đó.

2. **Django App Mapping** (Mới - v1.1):
    - Engine quét toàn bộ cây thư mục bên trong source directory để xây dựng **bản đồ Django Apps**.
    - Một thư mục được nhận diện là Django App nếu chứa ít nhất 1 trong các file: `models.py`, `views.py`, `apps.py`.
    - Bản đồ này được sử dụng ở Phase 2 để gán feature chính xác.

### Phase 2: Scan & Gán Feature cho từng file

3. **Duyệt cây thư mục**: Sử dụng `os.walk` kết hợp `followlinks=True` để duyệt qua project.
    - **Symlink Support**: Đảm bảo Auditor không bỏ sót các thư mục được liên kết ảo.
    - **Deterministic Order**: Dirs và files luôn được sắp xếp theo alphabet để đảm bảo kết quả nhất quán.

4. **Lọc (Filtering)**: Loại bỏ các thư mục rác (venv, node_modules, .git) dựa trên cấu hình `EXCLUDE_DIRS` ở mọi cấp độ.

5. **Nhận diện file**: Chỉ xử lý các file có phần mở rộng hợp lệ (`.py`) theo quy chuẩn Python-Centric.

6. **Feature Mapping (Deep Django App Detection)**: 
    - Từ thư mục của mỗi file, engine **đi ngược lên** cây thư mục để tìm **Django App gần nhất** chứa nó.
    - Tên feature = `parent_context/app_name`, với các thư mục trung gian (`code/`, `src/`, `app/`) được bỏ qua (transparent dirs).
    - **Fallback**: Nếu không tìm thấy Django App, sử dụng folder cấp 1 như trước.

7. **Số liệu LOC**: Tính toán tổng số dòng code vật lý (Physical Rows) của các tệp Python được tìm thấy.

## Ví dụ Feature Mapping

### Dự án có nhiều Django Apps (GRM APP)
```
source_code/
  └── growme_app/
        └── code/
              ├── F5_2_Reporting/     → Feature: "growme_app/F5_2_Reporting"
              ├── F4_3_3_Performance_Alert/ → Feature: "growme_app/F4_3_3_Performance_Alert"
              └── __LP_Library/       → Feature: "growme_app/__LP_Library"
  └── growme_api/
        └── code/
              ├── F1_1_Auth_API/      → Feature: "growme_api/F1_1_Auth_API"
              └── F5_2_Reporting/     → Feature: "growme_api/F5_2_Reporting"
```

### Dự án đơn giản (Check Project)
```
src/
  ├── config.py               → Feature: "src_root"
  ├── api/                    → Feature: "api"
  └── engine/                 → Feature: "engine"
```

## Transparent Dirs

Các thư mục trung gian sau sẽ bị loại bỏ khỏi tên feature để giữ tên ngắn gọn:
- `code/`
- `src/`
- `app/`

Ví dụ: `source_code/growme_app/code/F5_2_Reporting` → `growme_app/F5_2_Reporting` (thay vì `growme_app/code/F5_2_Reporting`)

---
*Duy trì bởi LongDD.*
