# Kiến trúc Module (Module Architecture)

Tài liệu mô tả cấu trúc module hóa sau đợt refactoring ADR-011 (2026-04-02).

## Tổng quan

Hệ thống áp dụng nguyên tắc **Single Responsibility Principle** xuyên suốt cả Backend lẫn Frontend. Mỗi file/module chỉ đảm nhận đúng 1 miền trách nhiệm.

## Backend Architecture

### API Layer (`src/api/`)

```mermaid
graph TD
    A[api_server.py<br/>App Factory, Middleware<br/>≈90 LOC] --> B[routers/audit.py<br/>Upload, Scan, Jobs, SSE]
    A --> C[routers/rules.py<br/>CRUD, Compile, Test]
    A --> D[routers/history.py<br/>History Queries]
    A --> E[routers/repositories.py<br/>Repo List, AI Health]
```

| File | Trách nhiệm | Endpoints |
|------|-------------|-----------|
| `api_server.py` | App factory, CORS, startup event, Starlette monkeypatch | `GET /` |
| `routers/audit.py` | Pipeline kiểm toán, upload file, clone Git, job management | `GET/POST /audit/*`, `GET /audit/jobs/*` |
| `routers/rules.py` | CRUD quy tắc kiểm toán, biên dịch AI, sandbox test | `GET/POST/DELETE /rules/*` |
| `routers/history.py` | Truy vấn lịch sử audit | `GET /history`, `GET /history/{id}` |
| `routers/repositories.py` | Danh sách repo cấu hình, health check AI | `GET /repositories`, `GET /health/ai` |

### Engine Layer (`src/engine/`)

```mermaid
graph TD
    V[verification.py<br/>Orchestration Only] --> S[scanners.py<br/>RegexScanner, PythonASTScanner]
    V --> DC[dependency_checker.py<br/>Circular Dependency Detection]
    V --> A[auditor.py<br/>5-Step Pipeline]
    A --> SC[scoring.py<br/>Feature-based Scoring]
    A --> AI[ai_service.py<br/>LLM Integration]
    A --> DB[database.py<br/>PostgreSQL Storage]
```

| File | Trách nhiệm | Classes/Functions chính |
|------|-------------|------------------------|
| `scanners.py` | Quét mã nguồn bằng Regex và AST | `BaseScanner`, `RegexScanner`, `PythonASTScanner`, `_build_flat_meta` |
| `dependency_checker.py` | Phát hiện Circular Import cấp project | `detect_circular_dependencies` |
| `verification.py` | Điều phối: gọi scanners + dependency checker | `double_check_modular`, `VerificationStep` |

## Frontend Architecture

### Component Hierarchy

```mermaid
graph TD
    APP[App.jsx<br/>State Management, Routing<br/>≈545 LOC] --> SB[Sidebar.jsx<br/>Navigation]
    APP --> AV[AuditView.jsx<br/>Dashboard UI, Charts<br/>Lazy-loaded]
    APP --> RC[RulesConfigurator.jsx<br/>Rule CRUD + Sandbox<br/>Lazy-loaded]
    APP --> HV[HistoryView.jsx<br/>Audit History<br/>Lazy-loaded]
    APP --> SV[SettingsView.jsx<br/>System Settings<br/>Lazy-loaded]
    AV --> TL[TerminalLogs.jsx<br/>SSE Log Stream]
    AV --> CH[chartHelpers.js<br/>Chart Data Utils]
```

| Component | Dòng code | Lazy? | Trách nhiệm |
|-----------|-----------|-------|-------------|
| `App.jsx` | ≈545 | No | State management, routing, side effects |
| `AuditView.jsx` | ≈350 | Yes | Hero card, charts, violations, leaderboard |
| `RulesConfigurator.jsx` | ≈800 | Yes | Rule manager + AI sandbox |
| `HistoryView.jsx` | ≈150 | Yes | Lịch sử audit |
| `SettingsView.jsx` | ≈70 | Yes | Cài đặt hệ thống |

### Bundle Size (Production)

| Chunk | Size | Gzip |
|-------|------|------|
| `index.js` (core) | 343 KB | 114 KB |
| `AuditView.js` | 26 KB | 7 KB |
| `RulesConfigurator.js` | 56 KB | 17 KB |
| Chart libraries | 121 KB | 40 KB |

---
*Cập nhật: 2026-04-02 — ADR-011*
