# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

## ĐIỂM TỔNG DỰ ÁN: 81.46 / 100 (🥈 Tốt)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 500
- Tổng số file: 2
- Tổng số tính năng: 2

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 10.0 | ✅ Tốt |
| Maintainability | 3.33 | 🚨 Nguy cơ |
| Reliability | 10.0 | ✅ Tốt |
| Security | 1.67 | 🚨 Nguy cơ |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `auth` (LOC: 100)
**Điểm tính năng: 80.76 / 100** (Nợ: 10m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | -5.0 | 0.38 |

---
#### 🔹 Tính năng: `payments` (LOC: 400)
**Điểm tính năng: 82.15 / 100** (Nợ: 10m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -2.0 | 2.86 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Security]** /tmp/test_project_pillars/auth/login.py: HARDCODED_SECRET (Trọng số: -5.0)
- **[Maintainability]** /tmp/test_project_pillars/payments/pay.py: MISSING_DOCSTRING (Trọng số: -2.0)
