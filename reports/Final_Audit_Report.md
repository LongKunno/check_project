# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-06 06:51:35

## ĐIỂM TỔNG DỰ ÁN: 93.09 / 100 (🏆 Excellent)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 3896
- Tổng số file: 25
- Tổng số tính năng: 3

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 1 |
| 🔥 Critical | 0 |
| ⚠️ Major | 2 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 10.0 | ✅ Tốt |
| Maintainability | 10.0 | ✅ Tốt |
| Reliability | 8.56 | ✅ Tốt |
| Security | 7.99 | ⚠️ Cần cải thiện |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `root` (LOC: 19)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `src` (LOC: 3607)
**Điểm tính năng: 92.54 / 100** (Nợ: 120m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | -10.0 | 8.44 |
| Security | -10.0 | 7.83 |

---
#### 🔹 Tính năng: `tests` (LOC: 270)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Reliability]** src/engine/auditor.py: Swallowed exception (except block has only 'pass') (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Reliability]** src/engine/dependency_checker.py: Swallowed exception (except block has only 'pass') (Rule: SWALLOWED_EXCEPTION) (Trọng số: -5.0)
- **[Security]** src/engine/natural_rules_compiler.py: Hardcoded Secret/Token/Password detected (Rule: HARDCODED_SECRET) (Trọng số: -10.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `SWALLOWED_EXCEPTION` | Reliability | 2 | -10.0 |
| `HARDCODED_SECRET` | Security | 1 | -10.0 |


### 👥 Đánh giá theo Thành viên (Last 6 Months)
| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |
|---|---|---|---|
| **longdd@liftsoft.vn** | 3896 | 93.0 | 120m |

#### 🔍 Chi tiết lỗi theo Thành viên

**longdd@liftsoft.vn** (Top 5 vi phạm nặng nhất):
- [Security] src/engine/natural_rules_compiler.py:47 - Hardcoded Secret/Token/Password detected (Rule: HARDCODED_SECRET)
- [Reliability] src/engine/auditor.py:109 - Swallowed exception (except block has only 'pass') (Rule: SWALLOWED_EXCEPTION)
- [Reliability] src/engine/dependency_checker.py:57 - Swallowed exception (except block has only 'pass') (Rule: SWALLOWED_EXCEPTION)
