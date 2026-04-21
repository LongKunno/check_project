# Python Coding Rules & Standards

Chào mừng bạn đến với bộ quy chuẩn lập trình Python (V1.0.0) của dự án. Đây là các quy tắc bắt buộc để đảm bảo mã nguồn luôn đạt chất lượng cao nhất.

## 1. Nguyên tắc Tổng quát (General Principles)
- **Zen of Python**: Tuân thủ triết lý `import this`.
- **Explicit over Implicit**: Luôn ưu tiên viết code tường minh.
- **Clean Code**: Hàm không nên quá 150 dòng, Class không nên quá 500 dòng.

## 2. Quy chuẩn Định danh (Naming Conventions)
- **Variables/Functions**: Sử dụng `snake_case` (ví dụ: `get_total_loc`).
- **Classes**: Sử dụng `PascalCase` (ví dụ: `CodeAuditor`).
- **Constants**: Sử dụng `UPPER_SNAKE_CASE` (ví dụ: `MAX_RETRIES`).
- **Private members**: Bắt đầu bằng dấu gạch dưới (ví dụ: `_internal_method`).

## 3. Type Hinting (Bắt buộc)
Mọi hàm mới phải có Type Hinting cho cả tham số đầu vào và kết quả trả về.
```python
def process_audit(target_dir: str, depth: int = 1) -> Dict[str, Any]:
    # logic here
    pass
```

## 4. Documentation (Docstrings)
Sử dụng chuẩn **Google Docstring Format** cho mọi Public Class/Method.
```python
def calculate_score(punishment: float, loc: int) -> float:
    """
    Tính toán điểm dựa trên mức phạt và tổng số dòng code.

    Args:
        punishment (float): Tổng điểm phạt của các lỗi tìm thấy.
        loc (int): Tổng số dòng code của project.

    Returns:
        float: Điểm số đã chuẩn hóa (0-10).
    """
    pass
```

## 5. Xử lý Lỗi (Error Handling)
- Tránh sử dụng `try: ... except: pass`.
- Luôn log lỗi bằng module `logging`, không dùng `print` ở môi trường production.
- Định nghĩa các Exception tùy chỉnh nếu cần thiết.

## 6. Testing Requirement
- Mọi logic tính toán (Scoring, Discovery) phải có unit test đi kèm.
- Sử dụng `pytest` làm framework kiểm thử chính.

## 7. Môi trường thực thi (Execution Environment)
- **Bắt buộc**: Toàn bộ code Python phải được chạy bên trong Docker Container (service `backend`).
- **Lý do**: Đảm bảo tính nhất quán (Consistency) của điểm số và tránh xung đột thư viện giữa các máy (Environment Parity).
- **Hành động**: Luôn chạy `./manage.sh rebuild` sau khi chỉnh sửa `requirements.txt`.

---
*Duy trì bởi LongDD.*
