# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)

**Thời gian báo cáo:** 2026-04-06 01:55:21

## ĐIỂM TỔNG DỰ ÁN: 87.49 / 100 (🥈 Tốt)

### 📊 Chỉ số dự án (Project Metrics)
- Tổng LOC: 4967
- Tổng số file: 72
- Tổng số tính năng: 9

### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)
| Mức độ | Số lượng |
|---|---|
| 🔥 Blocker | 2 |
| 🔥 Critical | 0 |
| ⚠️ Major | 12 |
| ℹ️ Minor | 15 |
| ℹ️ Info | 77 |

### 🛡️ Đánh giá 4 Trụ cột Dự án
| Trụ cột | Điểm (Thang 10) | Trạng thái |
|---|---|---|
| Performance | 10.0 | ✅ Tốt |
| Maintainability | 8.33 | ⚠️ Cần cải thiện |
| Reliability | 6.9 | ⚠️ Cần cải thiện |
| Security | 8.93 | ✅ Tốt |

### 🧩 Chi tiết theo Tính năng (Feature Breakdown)
#### 🔹 Tính năng: `source_code_root` (LOC: 67)
**Điểm tính năng: 99.5 / 100** (Nợ: 2m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -0.5 | 9.8 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `F91_Auth` (LOC: 407)
**Điểm tính năng: 92.33 / 100** (Nợ: 43m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -3.0 | 8.93 |
| Reliability | -5.0 | 7.5 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `F92_Advertiser` (LOC: 21)
**Điểm tính năng: 100.0 / 100** (Nợ: 0m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | 0 | 10.0 |
| Reliability | 0 | 10.0 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `__Common` (LOC: 1624)
**Điểm tính năng: 89.18 / 100** (Nợ: 126m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -1.5 | 9.64 |
| Reliability | -24.0 | 5.04 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `__LP_Library` (LOC: 206)
**Điểm tính năng: 94.36 / 100** (Nợ: 26m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -1.5 | 9.43 |
| Reliability | -4.0 | 7.89 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `ad_compass` (LOC: 701)
**Điểm tính năng: 85.5 / 100** (Nợ: 147m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -5.5 | 8.2 |
| Reliability | 0 | 10.0 |
| Security | -10.0 | 5.0 |

---
#### 🔹 Tính năng: `crontab_management` (LOC: 819)
**Điểm tính năng: 79.84 / 100** (Nợ: 155m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -28.0 | 4.72 |
| Reliability | -8.0 | 6.52 |
| Security | 0 | 10.0 |

---
#### 🔹 Tính năng: `nt_assistance` (LOC: 358)
**Điểm tính năng: 87.33 / 100** (Nợ: 105m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -3.0 | 8.93 |
| Reliability | 0 | 10.0 |
| Security | -10.0 | 5.0 |

---
#### 🔹 Tính năng: `sample_app` (LOC: 764)
**Điểm tính năng: 88.17 / 100** (Nợ: 78m)

| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|
| Performance | 0 | 10.0 |
| Maintainability | -4.5 | 8.47 |
| Reliability | -10.0 | 6.0 |
| Security | 0 | 10.0 |

---

### 🚨 Top 10 Vi phạm tiêu biểu
- **[Maintainability]** source_code/check_migration.py: Print statement found in production code. Use logger instead. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** source_code/F91_Auth/views.py: Large block of commented-out code detected. Should be removed and tracked via Git. (Rule: COMMENTED_OUT_CODE) (Trọng số: -1.0)
- **[Maintainability]** source_code/F91_Auth/views.py: Print statement found in production code. Use logger instead. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** source_code/F91_Auth/handle/login.py: Print statement found in production code. Use logger instead. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** source_code/F91_Auth/handle/login.py: Print statement found in production code. Use logger instead. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Reliability]** source_code/F91_Auth/handle/login.py: External API call without timeout parameter (Rule: NO_TIMEOUT_SET) (Trọng số: -5.0)
- **[Maintainability]** source_code/F91_Auth/handle/user_data.py: Print statement found in production code. Use logger instead. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** source_code/__Common/custom_logger.py: Print statement found in production code. Use logger instead. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Maintainability]** source_code/__Common/utils/handle_date.py: Print statement found in production code. Use logger instead. (Rule: PRINT_STATEMENT) (Trọng số: -0.5)
- **[Reliability]** source_code/__Common/viewsets/response_status.py: Function uses a mutable default argument (e.g. list or dict). This can cause unexpected state retention across calls. (Rule: MUTABLE_DEFAULT_ARGS) (Trọng số: -4.0)

### 📈 Thống kê theo Luật (Rule Breakdown)
| Rule ID | Trụ cột | Số lượng | Tổng phạt |
|---|---|---|---|
| `PRINT_STATEMENT` | Maintainability | 76 | -38.0 |
| `UNUSED_IMPORT` | Maintainability | 12 | -6.0 |
| `MUTABLE_DEFAULT_ARGS` | Reliability | 9 | -36.0 |
| `COMMENTED_OUT_CODE` | Maintainability | 3 | -3.0 |
| `HARDCODED_SECRET` | Security | 2 | -20.0 |
| `SWALLOWED_EXCEPTION` | Reliability | 2 | -10.0 |
| `NO_TIMEOUT_SET` | Reliability | 1 | -5.0 |
| `FORGOTTEN_TODO` | Maintainability | 1 | -0.5 |

