# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-20 09:07:55

## ĐIỂM TỔNG DỰ ÁN: 97.19 / 100 (🏆 Excellent)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 500
- Tổng số file: 2
- Tổng số tính năng: 2

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 1 |
| 🔥 Critical | 0 |
| ℹ️ Minor | 1 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 10.0 | ✅ Tốt |
| Maintainability | 9.41 | ✅ Tốt |
| Reliability | 10.0 | ✅ Tốt |
| Security | 9.33 | ✅ Tốt |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `auth` (LOC: 100)
**Điểm tính năng: 93.34 / 100** (Nợ: 60m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | -5.0 | 6.67 |

---
#### 🔹 Tính năng: `payments` (LOC: 400)
**Điểm tính năng: 98.15 / 100** (Nợ: 10m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -2.0 | 9.26 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Security]** auth/login.py: Test reason (Rule: HARDCODED_SECRET) (Trọng số: -5.0)
- **[Maintainability]** payments/pay.py: Test reason (Rule: MISSING_DOCSTRING) (Trọng số: -2.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `HARDCODED_SECRET` | Security | 1 | -5.0 |
| `MISSING_DOCSTRING` | Maintainability | 1 | -2.0 |

