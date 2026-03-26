# UI Text Selection Fix

## 1. Mô tả vấn đề
Người dùng không thể dùng chuột để bôi đen, chọn hoặc copy text trên toàn bộ giao diện Frontend. Vấn đề này làm giảm trải nghiệm người dùng (UX) khi cần trích xuất thông tin như log lỗi, kết quả audit, hoặc tên file.

## 2. Nguyên nhân (Root Cause)
Lớp CSS `select-none` của TailwindCSS đã bị áp dụng nhầm vào thẻ `<div>` gốc của ứng dụng tại file `App.jsx`. Lớp này sinh ra thuộc tính CSS `user-select: none;`, ngăn chặn mọi hành vi chọn chữ của trình duyệt trên phạm vi toàn cục.

## 3. Giải pháp (Resolution)
Xóa bỏ class `select-none` khỏi phần tử gốc của ứng dụng.

**File thay đổi:** 
- [src/App.jsx](../../dashboard/src/App.jsx)

```diff
- <div className="flex h-screen w-screen bg-[#020617] overflow-hidden select-none font-sans text-slate-200">
+ <div className="flex h-screen w-screen bg-[#020617] overflow-hidden font-sans text-slate-200">
```

## 4. Edge Cases & Gotchas
- **Các thành phần thực sự cần block selection (như Button, Icon):** Nếu các nút bấm hoặc custom component (như Drag & Drop box) bị chọn nhầm khi người dùng bấm nhanh nhiều lần (double-click), chúng ta nên áp dụng lớp `select-none` cục bộ ngay tại component đó thay vì áp dụng toàn cục trên `<body>` hoặc `#root`.
- **Phạm vi áp dụng:** Thay đổi này ảnh hưởng tức thì lên toàn bộ giao diện. Từ phiên bản này trở đi, mọi text văn bản mặc định đều có thể bôi đen.

## 5. Kết quả (Impact)
- Cho phép 100% nội dung chữ trên dashboard (bao gồm Audit results, Logs, Settings) có thể được chọn và copy/paste dễ dàng.
- Độ trễ render (Render latency): Thay đổi không làm ảnh hưởng đến hiệu ứng hay tốc độ render của React.
