# Trang tĩnh Web Thuyết Trình (Static Presentation Page)

Trang Web Thuyết Trình là một tính năng Frontend hoàn toàn tách biệt, được thiết kế theo mô hình cắm-rút (Plug and Play) nhằm tối giản hóa việc lưu trữ các URL được sử dụng trong các buổi họp với cấp quản lý.

## 1. Mô tả Chức năng

- Hiển thị danh sách 3-4 thẻ Card chứa link web thuyết trình.
- Dữ liệu được hardcode trực tiếp trong biến `presentations` (array) bên trong Component React.
- Click vào Card sẽ mở URL đích trong tab trình duyệt mới (`target="_blank"`).
- **Không sử dụng Database, không sử dụng API Backend.**

## 2. Cấu trúc Dữ liệu

Mỗi phần tử trong mảng `presentations` chứa:

| Field         | Type   | Mô tả                                      |
|---------------|--------|---------------------------------------------|
| `id`          | string | Mã định danh duy nhất                       |
| `title`       | string | Tiêu đề buổi thuyết trình                   |
| `description` | string | Mô tả ngắn nội dung                         |
| `date`        | string | Ngày thuyết trình (ISO format: YYYY-MM-DD)  |
| `url`         | string | URL đích dẫn tới web thuyết trình           |
| `gradient`    | string | Tailwind gradient classes cho màu card       |
| `accentColor` | string | CSS rgba color cho glow effect               |
| `borderColor` | string | CSS rgba color cho viền card                 |
| `tagColor`    | string | Tailwind classes cho badge "Open"            |

## 3. Thiết kế Giao diện

- Sử dụng class `glass-card` có sẵn trong design system (`index.css`).
- Animation staggered xuất hiện qua `framer-motion` (đã có sẵn trong dự án).
- Gradient accent bar trên đỉnh mỗi card + glow orb khi hover.
- Responsive grid: 1 cột (mobile) → 2 cột (tablet) → 3 cột (desktop).

## 4. Kiến trúc Plug-and-Play

Khác với các Component khác trong hệ thống:

1. **Zero Database:** Không yêu cầu tạo bảng dữ liệu trên PostgreSQL.
2. **Zero API:** Không cần tạo Endpoint Controller từ FastAPI.
3. **Decoupled State:** Không nằm trong luồng Global State, không tác động vào tiến trình lưu dữ liệu kiểm toán hiện có.

### Các file liên quan

| File | Vai trò |
|------|---------| 
| `dashboard/src/components/views/PresentationsStaticView.jsx` | Component chính — Index page (source of truth) |
| `dashboard/src/App.jsx` | Khai báo Route `/presentations` |
| `dashboard/src/components/layout/Sidebar.jsx` | NavItem menu "Presentations" |
| `dashboard/public/presentations/` | Thư mục chứa các file HTML thuyết trình (Reveal.js) |

## 5. Các trang thuyết trình hiện có

### Audit Engine — System Overview
- **File:** `dashboard/public/presentations/audit-engine.html`
- **URL truy cập:** `/presentations/audit-engine.html`
- **Công nghệ:** Reveal.js 5.1 (CDN) + Custom CSS (Midnight Aurora theme)
- **Nội dung:** 6 slides trình bày kiến trúc hệ thống, 5-Step Pipeline, AI Gatekeeper & NLRE, Scoring Mechanism
- **Điều hướng:** Dùng phím mũi tên ← → hoặc click nút điều hướng ở góc phải dưới

### Thêm trang thuyết trình mới

1. Tạo file HTML mới trong `dashboard/public/presentations/` (copy `audit-engine.html` làm template).
2. Mở file `dashboard/src/components/views/PresentationsStaticView.jsx`, thêm object mới vào mảng `presentations`:

```javascript
const presentations = [
  {
    id: 'pres-new',
    title: 'Tiêu đề buổi họp mới',
    description: 'Mô tả nội dung buổi thuyết trình.',
    date: '2026-04-15',
    url: '/presentations/ten-file-moi.html',
    gradient: 'from-blue-500 to-cyan-400',
    accentColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  // ... các items khác
];
```

### Bảng màu gợi ý cho gradient

| Tông màu | `gradient`                        | `accentColor`                    |
|----------|-----------------------------------|----------------------------------|
| Xanh dương | `from-blue-500 to-cyan-400`     | `rgba(59, 130, 246, 0.15)`      |
| Tím        | `from-violet-500 to-fuchsia-400`| `rgba(139, 92, 246, 0.15)`      |
| Xanh lá    | `from-emerald-500 to-teal-400`  | `rgba(16, 185, 129, 0.15)`      |
| Hồng       | `from-rose-500 to-pink-400`     | `rgba(244, 63, 94, 0.15)`       |
| Cam         | `from-amber-500 to-orange-400` | `rgba(245, 158, 11, 0.15)`      |

---

## 6. Uninstall Guide (Hướng dẫn tháo gỡ an toàn)

Thực hiện đúng **4 bước** sau để gỡ bỏ hoàn toàn tính năng mà không ảnh hưởng tới hệ thống:

### Bước 1: Gỡ Route trong `dashboard/src/App.jsx`

Xoá dòng import:
```javascript
const PresentationsStaticView = React.lazy(() => import('./components/views/PresentationsStaticView'));
```

Xoá khối Route:
```jsx
<Route path="/presentations" element={...} />
```

Xoá `/presentations` khỏi điều kiện ẩn header (dòng chứa `location.pathname.startsWith`).

### Bước 2: Gỡ Menu trong `dashboard/src/components/layout/Sidebar.jsx`

Xoá icon `MonitorPlay` khỏi dòng import `lucide-react`.

Xoá object trong mảng `navItems`:
```javascript
{ path: '/presentations', label: 'Presentations', icon: MonitorPlay, ... }
```

### Bước 3: Xoá file nguồn

```bash
rm dashboard/src/components/views/PresentationsStaticView.jsx
rm -rf dashboard/public/presentations/
```

### Bước 4: Cập nhật Documentation

Xoá file `docs/features/presentation_static_page.md` và gỡ entry tương ứng trong `mkdocs.yml`.

Sau 4 bước này, tính năng biến mất hoàn toàn khỏi hệ thống.
