# API: Trends

Nhóm endpoint cung cấp dữ liệu xu hướng chất lượng theo thời gian cho toàn portfolio và cho từng repository.

## `GET /api/trends/portfolio`

**Mục đích:** Tổng hợp xu hướng toàn cục trong khoảng `7`, `30` hoặc `90` ngày gần nhất.

**Query params:**

- `days` — bắt buộc thuộc một trong các giá trị `7`, `30`, `90`. Mặc định `30`.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "range_days": 30,
    "summary": {
      "scanned_repos": 6,
      "avg_latest_score": 87.4,
      "regressing_repos": 2,
      "scans_in_range": 14
    },
    "score_series": [
      { "date": "2026-04-21", "avg_score": 89.3 },
      { "date": "2026-04-22", "avg_score": 88.1 }
    ],
    "scan_volume_series": [
      { "date": "2026-04-21", "scans": 4 },
      { "date": "2026-04-22", "scans": 6 }
    ],
    "regression_series": [
      { "date": "2026-04-21", "warnings": 1 },
      { "date": "2026-04-22", "warnings": 2 }
    ],
    "latest_portfolio_pillars": {
      "Performance": 8.7,
      "Maintainability": 8.4,
      "Reliability": 8.9,
      "Security": 8.1
    },
    "top_regressing_repos": [
      {
        "id": 72,
        "target": "https://example.com/repo-1.git",
        "repo_id": "repo-1",
        "repo_name": "Repo 1",
        "score": 83.4,
        "rating": "B",
        "timestamp": "2026-04-22T10:00:00",
        "regression_status": "warning",
        "regression_summary": {
          "score_delta": -3.6,
          "violations_delta": 4,
          "triggered_signals": ["score_drop", "violations_increase"]
        }
      }
    ]
  }
}
```

## `GET /api/trends/repository`

**Mục đích:** Trả về timeline score, violations, pillar và regression events cho một repository cụ thể.

**Query params:**

- `target` — Git URL của repository, khớp với trường `url` trong cấu hình repo.
- `days` — bắt buộc thuộc một trong các giá trị `7`, `30`, `90`. Mặc định `30`.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "repo_id": "repo-1",
    "repo_name": "Repo 1",
    "target": "https://example.com/repo-1.git",
    "range_days": 30,
    "summary": {
      "total_scans": 3,
      "latest_score": 83.4,
      "latest_rating": "B",
      "latest_timestamp": "2026-04-22T10:00:00",
      "warnings_count": 1
    },
    "score_series": [
      { "timestamp": "2026-04-15T10:00:00", "score": 88.0 },
      { "timestamp": "2026-04-22T10:00:00", "score": 83.4 }
    ],
    "violations_series": [
      { "timestamp": "2026-04-15T10:00:00", "violations_count": 5 },
      { "timestamp": "2026-04-22T10:00:00", "violations_count": 9 }
    ],
    "pillar_series": [
      {
        "timestamp": "2026-04-22T10:00:00",
        "Performance": 8.1,
        "Maintainability": 7.8,
        "Reliability": 8.6,
        "Security": 7.2
      }
    ],
    "regression_events": [
      {
        "id": 72,
        "timestamp": "2026-04-22T10:00:00",
        "regression_status": "warning",
        "regression_summary": {
          "score_delta": -3.6,
          "violations_delta": 4,
          "new_high_severity_count": 1,
          "triggered_signals": [
            "score_drop",
            "violations_increase",
            "new_high_severity"
          ]
        }
      }
    ]
  }
}
```

## Error cases

**Response (400):**

```json
{
  "detail": "days chỉ hỗ trợ một trong các giá trị: 7, 30, 90"
}
```

```json
{
  "detail": "Thiếu query param target"
}
```

## Ghi chú kiến trúc

- Baseline của mỗi điểm dữ liệu là **scan liền trước** của cùng `target`.
- Regression Gate là `soft warning`, không fail batch scan hay audit job.
- `top_regressing_repos` được enrich thêm `repo_id` và `repo_name` bằng danh sách repository đang cấu hình.
- Nếu DB không có dữ liệu trong khoảng ngày đã chọn, API vẫn trả payload rỗng hợp lệ để UI render empty state.
