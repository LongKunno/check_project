# Frontend Coding Rules & Standards

Quy chuẩn lập trình cho Dashboard (React/Vite).

## 1. Công nghệ (Stack)
- **Framework**: React 18+.
- **Build tool**: Vite.
- **Styling**: Vanilla CSS (theo quy chuẩn dự án).
- **Charts**: Chart.js.

## 2. Cấu trúc Component
- Đặt tên file theo `PascalCase` (ví dụ: `AuditTracker.jsx`).
- Sử dụng Functional Component và Hooks (`useState`, `useEffect`).

## 3. Quản lý trạng thái
Ưu tiên sử dụng `useState` cho local state và `Context API` cho global state nếu cần thiết. Tránh lạm dụng Redux cho các ứng dụng quy mô trung bình.

## 4. API Core
Toàn bộ các yêu cầu HTTP tới Backend phải đi qua một bộ lọc lỗi tập trung để đảm bảo tính nhất quán của UX.

---
*Duy trì bởi Technical Architect.*
