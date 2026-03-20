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
*(Bổ sung các ADR mới khi có quyết định kiến trúc lớn).*
