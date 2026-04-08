---
name: test_driven_development
description: Quy chuẩn viết Test Tự động trước khi báo cáo hoàn thành (TDD). 
---

# Kỹ năng: Test-Driven Development (TDD)
Dự án yêu cầu Đảm bảo Chất lượng tuyệt đối. Bất kì tính năng Lõi (Core Engine) hay API Backend nào đều phải đi kèm với Test coverage.

## Vòng lặp Phát triển Bắt buộc:
1. **Red-Green-Refactor:** 
   - KHÔNG ĐƯỢC báo cáo "Đã viết xong code" nếu chưa có file test kiểm định trong thư mục `tests/`.
   - Nếu User yêu cầu `viết hàm phân tích file Python`, bạn phải viết file `test_python_analyzer.py` trước tiên dựa trên API Contract.
2. **Kỹ thuật Mock AsyncIO:**
   - Trong quá trình test, tuyệt đối không trỏ vào API OpenAI thực (để tránh mất tiền và token). BẮT BUỘC dùng `unittest.mock.AsyncMock` hoặc `pytest-asyncio` để giả lập JSON trả về từ API AI Service (như trong ADR-006).
3. **Môi trường Test:**
   - Chạy test phải thông qua container `backend`. Cú pháp mồi để test: `docker compose exec backend pytest tests/[tên_file_test] -v`.
   - Lỗi thì tự fix, PASS 100% xanh lè mới được khoe với User.
