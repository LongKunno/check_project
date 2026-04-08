---
name: fullstack_tech_lead
description: Master Skill tổng hợp quy chuẩn cao nhất cho cả Python/FastAPI, React/Vite, và tư duy phát triển.
---

# Kỹ năng: Fullstack Tech Lead (God-Tier Coding)

## Ngữ cảnh
Đây là tệp Skill tối thượng (Master Skill) tổng hợp các thông lệ lập trình (Best Practices) tiêu chuẩn nhất đang trending trên GitHub. AI bắt buộc phải "nạp" cấu hình này làm bộ não nền tảng cho mọi phiên làm việc mà không cần User nhắc lại.

## 1. Tư duy Hoạt động (Chain of Thought Mindset)
- **Cấm Nhả Code Rác/Lười Biếng:** TUYỆT ĐỐI KHÔNG sinh ra code chứa các bình luận lười như `// TODO: Implement later` hoặc `pass`. Mã nguồn sinh ra phải ở cấp độ Production-Ready (Sẵn sàng chạy thực tế).
- **Tư Duy Chậm (Defensive Programming):** Trước khi đâm đầu sửa code, luôn ý thức về Rủi ro hồi quy (Regression Risks). 
- **Bắt Lỗi Chủ Động:** Mọi khối I/O (Đọc file, Truy vấn DB, Gọi API LLM) đều phải được bọc bằng `try...except Exception as e` và phải log lại cảnh báo (Ví dụ: `logger.error`). Cấm nuốt lỗi im lặng.

## 2. Tiêu chuẩn Backend (Python / FastAPI)
- **Typing Strict (Đánh Kiểu Cứng):** Bắt buộc đánh Type Hints đầy đủ cho TẤT CẢ các hàm. Khai báo import `from typing import Dict, List, Optional, Any`. Trả về kiểu rõ ràng (`-> T`).
- **Pydantic V2:** Ưu tiên dùng `BaseModel` và `Field` của Pydantic để Validate in/out thay vì parse JSON thô chay.
- **Async I/O Mastery:** 
  - Phải dùng `async def` và `await` cho mọi giao tiếp Network/Disk.
  - Sử dụng `await asyncio.gather(*tasks)` để xử lý đồng thời (Concurrent) thay vì dùng vòng lặp `for` nướng thời gian của Server.
  - NGHIÊM CẤM dùng `time.sleep` (bắt buộc dùng `asyncio.sleep`). Không chạy các task CPU-Bound (Nén file to, xử lý chuỗi khổng lồ) ở Main Event Loop.
- **Guard Clauses (Thoát Sớm):** Hạn chế lồng khối lệnh `if-else` sâu quá 2 tầng. Hễ đầu vào sai, phải ném lỗi hoặc return ngay trên đỉnh khối hàm.

## 3. Tiêu chuẩn Frontend (React / Vite)
- **Named Exports Only:** Bắt buộc sử dụng `export const ComponentName = ...`. CẤM sử dụng `export default` để tránh tên Component bị lạc trôi gây khó dò tìm qua nhiều tệp.
- **Destructuring Props:** Giải nén props ngay ở cửa ngõ chữ ký hàm `({ data, onClick, id }) => {}`. Không dùng object `props.data`.
- **Ám Ảnh Về Re-render:** 
  - KHÔNG BAO GIỜ truyền một Inline Object (`{{a: 1}}`) hay Inline Function (`() => {}`) trực tiếp vào Props của Component con.
  - Phải tối ưu hóa bộ nhớ biến qua `useMemo` và `useCallback`.
- **Memory Leak Protection:** Trong `useEffect`, hễ có thiết lập `setInterval`, `addEventListener` hay `Websocket`, CỨNG RẮN TRẢ VỀ hàm dọn dẹp `return () => clearInterval(...)`.
