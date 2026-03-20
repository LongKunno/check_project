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

---
*Duy trì bởi Technical Architect.*
