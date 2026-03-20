# Hierarchical Scoring System (Hệ thống tính điểm)

Tính năng này chuyển đổi các vi phạm kỹ thuật thành các con số định lượng để quản lý chất lượng dự án.

## Cách hoạt động
1. **Trọng số (Weighting)**: Mỗi loại lỗi được gán một trọng số âm (ví dụ: Security -5, Documentation -1).
2. **Điểm số trụ cột (Pillar Score)**:
   Công thức: `Điểm = 10 / (1 + (|Trọng số| / K_FACTOR))`
   *(Chuẩn hóa theo mỗi 1000 dòng code).*
3. **Tính điểm phân cấp**:
   - Tính điểm cho từng Tính năng (Feature).
   - Điểm tổng dự án là trung bình cộng điểm của các Tính năng.

---
*Duy trì bởi Technical Architect.*
