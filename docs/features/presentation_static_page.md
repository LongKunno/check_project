# Meeting Materials (Static Presentation Pack)

`Meeting Materials` là một module frontend tĩnh, dùng để tập hợp các deck HTML phục vụ review kỹ thuật. Module này không phụ thuộc database hay API backend; toàn bộ danh sách deck được hardcode ngay trong dashboard.

## 1. Mô tả chức năng

- Hiển thị danh sách card dẫn tới các deck Reveal.js trong `dashboard/public/presentations/`.
- Mỗi card mở deck ở tab mới qua `target="_blank"`.
- Phù hợp cho các buổi `tech leads review`, release walkthrough và handoff nội bộ.
- **Không sử dụng Database, không sử dụng API Backend.**

## 2. Cấu trúc dữ liệu

Mỗi phần tử trong mảng `presentations` của `PresentationsStaticView.jsx` giữ nguyên contract:

| Field | Type | Mô tả |
|---|---|---|
| `id` | string | Mã định danh duy nhất |
| `title` | string | Tiêu đề deck |
| `description` | string | Mô tả ngắn nội dung |
| `date` | string | Ngày cập nhật deck theo ISO `YYYY-MM-DD` |
| `url` | string | URL public của file HTML |
| `gradient` | string | Tailwind gradient classes cho card |
| `accentColor` | string | Màu glow khi hover |
| `borderColor` | string | Màu viền card |
| `tagColor` | string | Tailwind classes cho badge CTA |

## 3. Kiến trúc plug-and-play

- **Zero Database:** không cần bảng dữ liệu mới.
- **Zero API:** không cần endpoint FastAPI.
- **Decoupled State:** module chỉ render danh sách deck, không chạm vào luồng audit runtime.

### Các file liên quan

| File | Vai trò |
|---|---|
| `dashboard/src/components/views/PresentationsStaticView.jsx` | Index page, source of truth cho danh sách card |
| `dashboard/src/App.jsx` | Khai báo route `/presentations` |
| `dashboard/src/components/layout/Sidebar.jsx` | Menu điều hướng "Presentations" |
| `dashboard/public/presentations/` | Thư mục chứa các deck HTML Reveal.js |
| `dashboard/public/presentations/review-pack.css` | Shared theme cho toàn bộ release deck |

## 4. Bộ deck hiện tại

### 1. Audit Engine — Core Architecture
- **File:** `dashboard/public/presentations/audit-engine.html`
- **URL:** `/presentations/audit-engine.html`
- **Vai trò:** deck nền tảng cho toàn hệ thống
- **Nội dung chính:** system topology, 5-step audit pipeline, scoring model, runtime boundaries, review checklist

### 2. NLRE & Rule Manager — Control Plane
- **File:** `dashboard/public/presentations/nlre-rule-manager.html`
- **URL:** `/presentations/nlre-rule-manager.html`
- **Vai trò:** deck chuyên đề cho rule control plane
- **Nội dung chính:** 3-tier rule architecture, global/project overrides, Rule Builder flow, reset strategy, edge cases quan trọng

### 3. AI Ops & Cache — Telemetry Console
- **File:** `dashboard/public/presentations/ai-ops-cache.html`
- **URL:** `/presentations/ai-ops-cache.html`
- **Vai trò:** deck vận hành AI telemetry
- **Nội dung chính:** AI Ops overview, pricing/budget controls, request explorer, AI cache console, demo flow và giới hạn v1

## 5. Quy ước nội dung

- Style mặc định: **EN heading + VI body**.
- Mỗi deck nên giữ quy mô khoảng `6-7 slides`, đủ ngắn cho review kỹ thuật 10-15 phút.
- Không nhồi trùng nội dung giữa các deck:
  - `Audit Engine` chỉ giữ phần nền tảng.
  - `NLRE & Rule Manager` tập trung vào rules và override behavior.
  - `AI Ops & Cache` tập trung vào telemetry, budget, cache, vận hành.

## 6. Cách thêm deck mới

1. Tạo file HTML mới trong `dashboard/public/presentations/`.
2. Link tới shared stylesheet `review-pack.css` để giữ cùng visual language cho cả pack.
3. Thêm một object mới vào mảng `presentations` trong `dashboard/src/components/views/PresentationsStaticView.jsx`.

```javascript
const presentations = [
  {
    id: "pres-new",
    title: "New Deck Title",
    description: "Mô tả ngắn nội dung buổi review.",
    date: "2026-04-23",
    url: "/presentations/new-deck.html",
    gradient: "from-blue-500 to-cyan-400",
    accentColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.25)",
    tagColor: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  },
];
```

## 7. Hướng dẫn gỡ bỏ

1. Gỡ route `/presentations` trong `dashboard/src/App.jsx`.
2. Gỡ nav item `Presentations` trong `dashboard/src/components/layout/Sidebar.jsx`.
3. Xoá `dashboard/src/components/views/PresentationsStaticView.jsx`.
4. Xoá thư mục `dashboard/public/presentations/`.
5. Gỡ file tài liệu này khỏi `mkdocs.yml` nếu cần.
