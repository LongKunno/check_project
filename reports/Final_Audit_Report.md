# BÁO CÁO KIỂM TOÁN CUỐI CÙNG (FINAL AUDIT REPORT) - V3

## Điểm số tổng quát: 56.37 / 100 (⚠️ D)

### Chỉ số dự án (Metrics)
- Tổng LOC: 639
- Tổng số file: 8

### Chi tiết theo trụ cột (Pillar Breakdown)
| Trụ cột | Trọng số | Tổng điểm phạt | Điểm quy đổi (Thang 10) |
|---|---|---|---|
| Performance | 35% | -7 | 1.54 |
| Maintainability | 25% | 0 | 10.0 |
| Reliability | 20% | 0 | 10.0 |
| Security | 20% | -3 | 2.99 |

### Top 10 Vi phạm tiêu biểu
- **[Performance]** /home/long/Documents/project_private/check_project/src/engine/database.py: SELECT * in BigQuery/SQL (Regex) (Trọng số: -2)
- **[Security]** /home/long/Documents/project_private/check_project/src/engine/verification.py: verify=False detected (Regex) (Trọng số: -3)
- **[Performance]** /home/long/Documents/project_private/check_project/src/engine/verification.py: SELECT * in BigQuery/SQL (Regex) (Trọng số: -2)
- **[Performance]** /home/long/Documents/project_private/check_project/src/engine/verification.py: Pandas .iterrows() detected (Regex) (Trọng số: -3)
