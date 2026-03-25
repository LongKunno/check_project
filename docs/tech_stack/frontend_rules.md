# Frontend Coding Rules & Standards

Quy chuẩn lập trình cho Dashboard (React/Vite).

## 1. Công nghệ (Stack)
- **Framework**: React 18+.
- **Build tool**: Vite.
- **Styling**: 
  - Vanilla CSS (theo quy chuẩn dự án cũ, duy trì tính tương thích).
  - Tailwind CSS (sử dụng song song cho các UI component chức năng mới, tối ưu cho bố cục layout và Glassmorphism).
- **Charts**: Chart.js.

## 2. Cấu trúc Component
- Đặt tên file theo `PascalCase` (ví dụ: `AuditTracker.jsx`).
- Sử dụng Functional Component và Hooks (`useState`, `useEffect`).

## 3. Quản lý trạng thái
Ưu tiên sử dụng `useState` cho local state và `Context API` cho global state nếu cần thiết. Tránh lạm dụng Redux cho các ứng dụng quy mô trung bình.

## 4. API Core
Toàn bộ các yêu cầu HTTP tới Backend phải đi qua một bộ lọc lỗi tập trung để đảm bảo tính nhất quán của UX.

## 5. Theme & Layout Rules (Bắt Buộc)
- KHÔNG lạm dụng prefix `dark:` của TailwindCSS để xử lý Sáng/Tối trực tiếp trong thẻ component. Để duy trì hiệu suất hoán vị CSS của kiến trúc V4, ưu tiên sử dụng màu Tailwind cố định cho Dark Mode, sau đó cấu hình đảo ngược (invert variables) thông qua gốc `html.light` trong file `index.css`.
- Các Menu thả xuống, Select Box (VD: Chọn Project) toàn hệ thống ưu tiên quy hoạch vào Sidebar để bảo vệ tính nhất quán UI/UX và không gian chiều ngang.

---
*Duy trì bởi Technical Architect.*
