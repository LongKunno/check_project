# Hierarchical Scoring System (Hệ thống tính điểm)

Tính năng này chuyển đổi các vi phạm kỹ thuật thành các con số định lượng để quản lý chất lượng dự án dựa trên 4 trụ cột chính.

## 1. Bốn Trụ cột Chất lượng
Hệ thống đánh giá dự án dựa trên:
- **Performance (Hiệu năng)**: Tối ưu hóa thực thi và sử dụng tài nguyên.
- **Maintainability (Khả năng bảo trì)**: Độ sạch của code, cấu trúc module.
- **Reliability (Độ tin cậy)**: Khả năng xử lý lỗi và độ ổn định.
- **Security (Bảo mật)**: Các nguy cơ về hổng bảo mật và dữ liệu nhạy cảm.

## 2. Cách tính điểm (Thang điểm 10 - V1.1.0 Architecture)

Sự chuyển đổi từ lỗi kỹ thuật sang điểm số được thực hiện thông qua quy trình gồm 3 bước nghiêm ngặt:

```mermaid
flowchart TD
    A[Mã nguồn dự án] --> B{Phân tách theo Tính Năng / Feature}
    B --> C[Phát hiện Vi phạm thô]
    C --> D(Gán trọng số lỗi âm\nVD: -5, -0.5)
    
    D --> E{Phân bổ theo\n4 Trụ Cột}
    E --> F[Performance]
    E --> G[Maintainability]
    E --> H[Reliability]
    E --> I[Security]
    
    F -->|K=2.0| J(Quy chuẩn K-Factor)
    G -->|K=4.0| J
    H -->|K=2.0| J
    I -->|K=0.5| J
    
    J --> K[Điểm Trụ cột = 10 / 1 + Phạt/K]
    K --> L[Cân Bằng Trọng Khối 4 Trụ Cột\n(Pillars Normalization)]
    L --> M[Tổng hợp = Điểm Tính Năng]
    M --> N((Weighted Average\ntheo File LOC))
    N --> O[🚀 Điểm Tổng Thể Dự Án]
```

1. **Trọng số (Weighting)**: Mỗi loại vi phạm được gán một trọng số âm (ví dụ: Hardcoded Secret -5, Print statement -0.5).
2. **Điểm số trụ cột (Pillar Score)**:
   - Công thức: `Điểm = 10 / (1 + (Điểm phạt chuẩn hóa / K_FACTOR))`
   - *Điểm phạt chuẩn hóa* được tính bằng cách chia điểm phạt tuyệt đối cho **Số ngàn dòng code an toàn (Effective LOC/1000)**.
   - **Màng lọc Laplace Smoothing:** Để ngăn chặn lỗi "chia cho 0 tiệm cận" khiến điểm sập mạch vô lý, hệ thống quy định một giới hạn ngầm định: `effective_loc = max(total_loc, 1000)`. Dù file chỉ có 5 dòng, nó vẫn sở hữu dung sai lỗi của một file 1000 dòng code.
   - **K_FACTOR Động (Dynamic):** Hệ thống áp dụng độ nhạy khác nhau tùy tính chất trụ cột:
     - `Security`: K = 0.5 (Trừ điểm cực nhanh nếu có lỗi)
     - `Reliability` / `Performance`: K = 2.0 (Tiêu chuẩn)
     - `Maintainability`: K = 4.0 (Độ dung sai lớn hơn với các lỗi chuẩn mực code)
3. **Điểm Tổng kết Dự án (Final Score)**: 
   - **Pillars Normalization:** Khối lượng 4 Trụ cột theo khai báo trong Cấu hình (`src/config.py`) luôn được chuẩn hóa (chia tỷ lệ) để chắc chắn Tổng bằng `1.0`. Cho dù User phá hỏng cấu hình (Ví dụ: Đẩy tự do cả 4 trụ cột lên 1.0 = Tổng 4.0), tính toán trần điểm 10 của Dashboard hoàn toàn không bị ảnh hưởng.
   - Không dùng trung bình cộng đơn thuần. Điểm tổng là **Trung bình có trọng số theo Kích thước Tính năng (Weighted Average by LOC)**. Một module 10,000 dòng code sẽ có sức ảnh hưởng lên điểm dự án gấp 100 lần một thư mục 100 dòng.

## 3. Thông tin bổ trợ Khấu trừ và Thống kê (Technical Debt & Statistics)
Bên cạnh điểm số 0-10, hệ thống xuất báo cáo cung cấp các chỉ số quan trọng sau để team có Action Item:
- **Nợ kỹ thuật (Technical Debt):** Tính bằng đơn vị "phút" (minutes), giúp đội ngũ ước lượng thời gian cần thiết để cải thiện mã nguồn.
- **Phân bổ Mức độ Nghiêm trọng (Severity Distribution):** Phân loại các lỗi thành 5 cấp độ: `Blocker`, `Critical`, `Major`, `Minor`, `Info`. Lỗi mang cấp độ Blocker/Critical yêu cầu khắc phục ngay lập tức trước khi deploy.
- **Thống kê Mức phạt theo Luật (Rule Breakdown):** Liệt kê chi tiết lỗi nào vi phạm nhiều nhất và tốn bao nhiêu điểm phạt, qua đó giúp team nhận dạng tư duy lập trình sai lệch phổ biến nhất hiện tại.

## 4. Đặc tả tính điểm theo Thành viên (Member Scoring)
Hệ thống tính toán riêng biệt hiệu suất cá nhân của từng thành viên:
- Chỉ đánh giá mã nguồn được viết trong **6 tháng gần nhất** (sử dụng `git blame --since="6 months"`). Lỗi trên code cũ sẽ được bỏ qua cho member nhưng vẫn tính cho toàn dự án.
- Điểm cá nhân được chuẩn hóa theo tỷ lệ Tổng dòng code (LOC) mà thành viên đó đóng góp trong kỳ tính toán.

> [!WARNING]
> **Edge Cases & Gotchas về Member Scoring**
> Tính năng tính điểm thành viên **bắt buộc** phải đọc dữ liệu từ thư mục `.git` (Git History). 
> - Tính năng Remote Repository Clone đã được cấu hình lệnh `--shallow-since=6.months` để chứa đủ thông tin chạy lệnh `git blame`. KHÔNG ĐƯỢC CHỦ ĐỘNG xóa thư mục `.git` này trong script. Thư mục `.git` đã được tự động loại trừ khỏi việc quét file ở `ai_precheck.py` để tối ưu tài nguyên.

---
*Duy trì bởi LongDD.*
