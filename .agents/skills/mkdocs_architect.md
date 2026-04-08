---
name: mkdocs_architect
description: Quy Trình Cập Nhật Living Documentation V4 dành cho AI Agent.
---

# Kỹ năng: Kiến trúc sư Tài liệu (Living Documentation V4)

## Ngữ cảnh
Một bộ source code chỉ thực sự sống khi nó có tài liệu đi kèm. Dự án của bạn vận hành "Living Documentation" bằng MkDocs nằm trong thư mục `docs/`. Mọi tính năng sau khi code xong mà không cập nhật tài liệu thì coi như bỏ đi.

## Quy trình Thực thi (LUÔN TUÂN THỦ):

### 1. Vòng lặp Trước khi Code (Pre-flight Check)
- Hễ User yêu cầu động vào module nào, AI **BẮT BUỘC** phải dùng tool tìm kiếm để đọc lướt qua tệp `docs/features/` hoặc `docs/architecture/` tương ứng. Thao tác này để lấy bối cảnh trước khi gỡ lỗi, tránh tẩu hỏa nhập ma.

### 2. Vòng lặp Sau khi Code (Check-out & Documenting)
- **Cấm Báo Cáo Xong Việc Sớm:** Nếu AI giải quyết xong một Issue/Feature, LUÔN LUÔN tự động nhảy sang bước bổ sung tài liệu.
- **Vẽ Sơ đồ (Mã hóa Luồng):** Nếu logic code thay đổi hướng đi của dữ liệu, bắt buộc phải sinh ra một biểu đồ `Mermaid` (ví dụ: `graph TD`, `sequenceDiagram`) nhúng vào file markdown tương ứng ở `docs/`.
- **Cấu trúc ADR:** Bất kì quyết định chuyển đổi công nghệ nào (ví dụ chuyển từ List sang Set, đổi từ For loop sang Asyncio gather) đều phải sinh ra 1 block "Architecture Decision Record" nhỏ gọn ghi rõ: Vấn đề (Problem) -> Cách giải quyết (Decision) -> Hệ quả (Consequences).

### 3. Cập nhật Menu Điều hướng
- Hễ rảnh rỗi mà tạo thêm một file `.md` mới trong thư mục `docs/`, KHÔNG BAO GIỜ được quên mở file `mkdocs.yml` ở root lên và chèn link của tệp đó vào khu vực `nav`.
