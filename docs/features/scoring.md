# Hierarchical Scoring System (Hệ thống tính điểm)

Tính năng này chuyển đổi các vi phạm kỹ thuật thành các con số định lượng để quản lý chất lượng dự án dựa trên 4 trụ cột chính.

## 1. Bốn Trụ cột Chất lượng
Hệ thống đánh giá dự án dựa trên:
- **Performance (Hiệu năng)**: Tối ưu hóa thực thi và sử dụng tài nguyên.
- **Maintainability (Khả năng bảo trì)**: Độ sạch của code, cấu trúc module.
- **Reliability (Độ tin cậy)**: Khả năng xử lý lỗi và độ ổn định.
- **Security (Bảo mật)**: Các nguy cơ về hổng bảo mật và dữ liệu nhạy cảm.

## 2. Cách tính điểm (Thang điểm 10)
1. **Trọng số (Weighting)**: Mỗi loại vi phạm được gán một trọng số âm (ví dụ: Hardcoded Secret -5, Print statement -0.5).
2. **Điểm số trụ cột (Pillar Score)**:
   Công thức: `Điểm = 10 / (1 + (|Tổng trọng số| / K_FACTOR))`
   *(K_FACTOR được chuẩn hóa theo số dòng code để đảm bảo công bằng).*

## 3. Thông tin bổ trợ (Technical Debt)
Bên cạnh điểm số 0-10, hệ thống còn cung cấp chỉ số **Nợ kỹ thuật (Technical Debt)** tính bằng phút để giúp đội ngũ kỹ thuật ước lượng nỗ lực cần thiết để cải thiện mã nguồn.

## 4. Đặc tả tính điểm theo Thành viên (Member Scoring)
Hệ thống tính toán riêng biệt hiệu suất cá nhân của từng thành viên:
- Chỉ đánh giá mã nguồn được viết trong **6 tháng gần nhất** (sử dụng `git blame --since="6 months"`). Lỗi trên code cũ sẽ được bỏ qua cho member nhưng vẫn tính cho toàn dự án.
- Điểm cá nhân được chuẩn hóa theo tỷ lệ Tổng dòng code (LOC) mà thành viên đó đóng góp trong kỳ tính toán.

> [!WARNING]
> **Edge Cases & Gotchas về Member Scoring**
> Tính năng tính điểm thành viên **bắt buộc** phải đọc dữ liệu từ thư mục `.git` (Git History). 
> - Nếu sử dụng chức năng Upload Local Folder trên Dashboard, do trình duyệt web bỏ qua thư mục ẩn `.git`, thông tin đánh giá Member sẽ tự động bị rỗng (ẩn form).
> - Tính năng Remote Repository Clone đã được cấu hình lệnh `--shallow-since=6.months` để chứa đủ thông tin chạy lệnh `git blame`. KHÔNG ĐƯỢC CHỦ ĐỘNG xóa thư mục `.git` này trong script. Thư mục `.git` đã được tự động loại trừ khỏi việc quét file ở `ai_precheck.py` để tối ưu tài nguyên.

---
*Duy trì bởi Technical Architect.*
