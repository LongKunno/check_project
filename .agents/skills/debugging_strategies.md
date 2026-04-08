---
name: debugging_strategies
description: Chiến lược chống "Đoán Mò" khi hệ thống báo lỗi hoặc Crash.
---

# Kỹ năng: Bậc Thầy Săn Lỗi (Debugging Strategies)

## Nghiêm Cấm:
- CẤM phỏng đoán bừa: Khi thấy lỗi `KeyError`, `NullPointerException` hoặc `Connection Refused` từ File Log, TUYỆT ĐỐI KHÔNG sửa code ngay lập tức bằng trực giác mà không có bằng chứng.
- CẤM đẻ thêm code Rác: Đừng có thấy lỗi cái là thêm 1 đống lệnh kiện `if obj is None` để che khỏa lấp mà không trị tận gốc sự ô nhiễm của Dữ liệu.

## Chiến thuật Từng Bước BẮT BUỘC (SOP):
1. **Cô lập Lỗi (Isolate):** Dùng Terminal chạy riêng tư hàm đó chứa Log Error cụ thể. Thêm log `logger.debug()` nếu cần để in ra các giá trị Context.
2. **Kích hoạt Chéo (Reproduce):** Tạo một file Python nhỏ tạm thời (`/tmp/debug.py`) gọi độc lập cái module đó. Nếu lỗi văng ra đúng như vậy, ta đã thu hẹp được vùng phát sinh bệnh.
3. **Trao nguyên lý Code:** Soi nguyên nhân theo Thiết kế gốc ở `docs/features/`. (Ví dụ: Dự án xài Hybrid Gatekeeper, nếu chọc AST lỗi thì phải check xem rule.json có viết REGEX lỏ hay không).
4. **Viết Giải Pháp + Test Xác Nhận:** Sau khi sửa gốc bệnh, chạy lại file debug bên trên. Rác thì tự dọn.
