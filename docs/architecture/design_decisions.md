# Architecture Decision Records (ADR)

Tất cả các quyết định thiết kế cốt lõi của hệ thống được ghi nhận tại đây theo quy chuẩn ADR.

## ADR-001: Chuyển đổi sang Dynamic Feature-based Scoring

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Hệ thống cũ sử dụng mô hình 4 trụ cột (4-pillar) cố định cho toàn bộ dự án. Điều này khiến việc đánh giá các dự án lớn trở nên khó khăn vì điểm số bị loãng, không chỉ rõ được module/tính năng nào đang gặp lỗi nghiêm trọng.

### Giải pháp (Options & Decision & Why)
**Giải pháp**: Áp dụng mô hình tính điểm phân cấp (Hierarchical Scoring).
1. Phân loại file theo thư mục (Features).
2. Tính điểm 4 trụ cột cho TỪNG Feature.
3. Tính trung bình cộng điểm các Feature để ra điểm dự án.

**Tại sao?**: Giúp Dashboard hiển thị trực quan module nào "đỏ" (nhiều lỗi/chất lượng kém), thuận tiện cho các Technical Architect và Tech Lead rà soát nhanh.

### Hệ quả (Consequences)
- **Tích cực**: Tăng độ chi tiết của báo cáo lên 400%.
- **Thử thách**: Yêu cầu Engine Auditor phải thực hiện bước Aggregation phức tạp hơn (Map file -> Feature).

---

## ADR-002: Hỗ trợ PNA cho trình duyệt Brave

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Brave Shields và các trình duyệt dựa trên Chromium mới thắt chặt chính sách **Private Network Access (PNA)**, chặn các request từ web public (hoặc localhost 3000) tới API local (8000).

### Giải pháp (Options & Decision & Why)
Bổ sung `Access-Control-Allow-Private-Network: true` vào header của mọi response và xử lý Preflight (OPTIONS) chính xác.

---

## ADR-003: Phân vùng đánh giá qua thư mục `source_code`

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Ở một số dự án, mã nguồn quan trọng (features) nằm sâu trong thư mục `source_code`, trong khi các thư mục ở root chứa cấu hình, tài liệu hoặc file phụ trợ. Engine Discovery cũ quét toàn bộ root dẫn đến việc nhận diện sai các thư mục không chứa code là "Features".

### Giải pháp (Options & Decision & Why)
**Quyết định**: Ưu tiên thư mục `source_code` làm gốc nếu nó tồn tại.
- Nếu thấy `source_code`: Chỉ quét bên trong nó. Feature name = subdirs of `source_code`.
- Nếu không thấy: Quét như cũ.

**Tại sao?**: Giúp lọc nhiễu tự động và tập trung đánh giá vào đúng khu vực chứa logic nghiệp vụ chính của dự án.

---

## ADR-004: Khôi phục Mô hình 4 Trụ cột và Nâng cao bộ Quy tắc kiểm tra (Case Checks)

### Trạng thái (Status)
**Accepted** (2026-03-20)

### Vấn đề (Problem)
Mô hình rating A-E của SonarQube tuy chuyên nghiệp nhưng có thể gây khó hiểu cho người dùng đã quen với thang điểm 10. Tuy nhiên, kiến thức về Severity và Technical Debt từ SonarQube lại rất hữu ích để làm phong phú thêm bộ quy tắc kiểm tra.

### Giải pháp (Options & Decision & Why)
**Quyết định**: 
1. Quay lại sử dụng thang điểm 0-10 cho 4 trụ cột (Performance, Maintainability, Reliability, Security).
2. Tích hợp Technical Debt và Severity từ SonarQube vào metadata của các quy tắc để làm "Case Checks" chuyên sâu hơn.
3. Bổ sung các quy tắc kiểm tra mới như CORS, Unused Imports, và Print Statements.

**Tại sao?**: Giữ được sự đơn giản, trực quan của điểm số 0-10 nhưng vẫn tận dụng được chiều sâu phân tích của các công cụ hàng đầu như SonarQube.

### Hệ quả (Consequences)
- **Tích cực**: Dashboard dễ hiểu hơn, bộ quy tắc kiểm tra mạnh mẽ và đa dạng hơn.
- **Thử thách**: Duy trì sự cân bằng giữa điểm phạt (Punishment) và Nợ kỹ thuật (Debt) để điểm số phản ánh đúng thực tế.

---
*(Bổ sung các ADR mới khi có quyết định kiến trúc lớn).*
