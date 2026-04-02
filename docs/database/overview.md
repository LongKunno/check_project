# Database - Tổng quan

Hệ thống sử dụng **PostgreSQL** làm cơ sở dữ liệu chính để lưu trữ lịch sử kiểm toán. PostgreSQL được lựa chọn (thay thế SQLite) nhờ khả năng xử lý đa luồng (Concurrency), loại bỏ hoàn toàn hiện tượng File Lock khi chạy Audit song song, và chuẩn bị cho các nâng cấp Vector Database sau này.

## Kiến trúc Dữ liệu
Dữ liệu được tổ chức theo mô hình quan hệ cơ bản kèm JSON payload để tối ưu hóa tốc độ truy xuất. Mọi thông tin chi tiết về điểm số (Scoring) được đóng gói dưới dạng JSON.

## Vị trí lưu trữ
Trong môi trường Docker Compose: Service `db` chạy ở cổng `:5432` nội bộ.
Dữ liệu thực tế được ánh xạ qua Docker Volume: `pgdata:/var/lib/postgresql/data`
> [!NOTE]
> Từ bản V4, cơ chế mount trực tiếp file `auditor_v2.db` của SQLite vào container Backend đã hoàn toàn bị loại bỏ để bảo toàn dữ liệu đồng bộ trên PostgreSQL.

## Các cấu trúc bảng (Schema) mới

Hệ thống hiện tại lưu trữ 2 bảng chính đóng vai trò nòng cốt. Dưới đây là Sơ đồ quan hệ thực thể (ER Diagram) minh họa trúc dữ liệu:

```mermaid
erDiagram
    PROJECT_RULES ||--o{ AUDIT_HISTORY : "áp_dụng_khi_quét"
    
    PROJECT_RULES {
        string target_id PK "Khóa chính (Lookup Key)"
        text natural_text "Yêu cầu bằng ngôn ngữ tự nhiên"
        json compiled_json "JSON String (AST/Regex Rules)"
        json disabled_core_rules "Danh sách ID Core Rule bị tắt"
        json custom_weights "Dictionary trọng số (Weight Override)"
    }
    
    AUDIT_HISTORY {
        string id PK "Khóa chính (Job/Audit ID)"
        string target_id FK "Liên kết quy tắc dự án"
        float final_score "Điểm tổng kết"
        json result_data "Toàn bộ báo cáo vi phạm"
        string timestamp "Thời gian quét"
    }
```

### 1. Bảng `audit_history`
Lưu trữ lịch sử tất cả các phiên kiểm toán thành công (Bao gồm file diff, logs lỗi, và metadata phiên quét).
- `id` (SERIAL PRIMARY KEY) - Khóa chính.
- `timestamp` (TIMESTAMP) - Thời gian quét mặc định tĩnh.
- `total_loc` (INTEGER), `violations_count` (INTEGER), `score` (REAL) - Các chỉ số điểm.
- `pillar_scores`, `full_json` (TEXT JSON) - Dữ liệu payload chi tiết.

### 2. Bảng `project_rules`
Lưu trữ các luật cấu hình được người dùng chỉ định qua tính năng Ngôn ngữ tự nhiên. 
- `id` (SERIAL PRIMARY KEY)
- `target_id` (TEXT) - Unique lookup key.
- `natural_text` (TEXT) - Yêu cầu bằng ngôn ngữ tự nhiên.
- `compiled_json` (TEXT) - Lưu trữ dưới dạng JSON string.
- `disabled_core_rules` (TEXT) - JSON Array lưu danh sách ID Core Rule bị tắt.
- `custom_weights` (TEXT) - JSON Dictionary lưu trữ trọng số (Weight Override) của từng luật cụ thể.

---
*Duy trì bởi LongDD.*
