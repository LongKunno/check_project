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

### Component Hierarchy (Post-Refactor 2026-04-14)

```mermaid
graph TD
    APP["App.jsx<br/>Routing + Hooks Composition<br/>≈470 LOC"] --> SB[Sidebar.jsx<br/>Navigation]
    APP --> AV["AuditView.jsx<br/>Dashboard Orchestrator<br/>≈435 LOC<br/>Lazy-loaded"]
    APP --> RM["RuleManager.jsx<br/>Rule CRUD<br/>≈969 LOC<br/>Lazy-loaded"]
    APP --> RB["RuleBuilder.jsx<br/>AI Rule Builder<br/>≈816 LOC<br/>Lazy-loaded"]
    APP --> HV["HistoryView.jsx<br/>Audit History<br/>Lazy-loaded"]
    APP --> SV["SettingsView.jsx<br/>Settings + Repo CRUD<br/>Lazy-loaded"]
    
    APP -.-> H1[useRepositories.js<br/>Repo state + API]
    APP -.-> H2[useAuditState.js<br/>Audit state + SSE]

    AV --> VL["ViolationLedger.jsx<br/>3-tier violation display<br/>≈600 LOC"]
    AV --> CR[ChartsRow.jsx<br/>Doughnut + Bar charts]
    AV --> RBT[RuleBreakdownTable.jsx<br/>Rule breakdown table]
    AV --> TL[TeamLeaderboard.jsx<br/>Member scores table]
    AV --> AS[AuditSidebar.jsx<br/>Info + Top files]
    AV --> TLogs[TerminalLogs.jsx<br/>SSE log stream]

    RM --> RMP["RuleManagerParts.jsx<br/>WeightInput, KpiCard,<br/>RuleCard, PillGroup, etc."]
    RB --> RBP["RuleBuilderParts.jsx<br/>Stepper, Terminal,<br/>VisualRuleConfigurator"]
```

### Cấu trúc Thư mục

| Thư mục | Chứa | Mô tả |
|---------|------|-------|
| `dashboard/src/hooks/` | `useRepositories.js`, `useAuditState.js` | Custom hooks tách business logic |
| `dashboard/src/components/views/` | `AuditView`, `SettingsView` | View-level components |
| `dashboard/src/components/audit/` | `ViolationLedger`, `ChartsRow`, `RuleBreakdownTable`, `TeamLeaderboard`, `AuditSidebar` | Audit sub-components |
| `dashboard/src/components/nlre/` | `RuleManager`, `RuleBuilder`, `RuleManagerParts`, `RuleBuilderParts` | Rule management |
| `dashboard/src/components/ui/` | `TerminalLogs`, `EmptyState`, `HeroCard`, `Pagination` | Reusable UI primitives |

### LOC Summary (Trước → Sau Refactor)

| Component | Trước | Sau | Giảm |
|-----------|-------|-----|------|
| `App.jsx` | 912 | 470 | 48% |
| `AuditView.jsx` | 1,771 | 435 | **75%** |
| `RuleManager.jsx` | 1,444 | 969 | 33% |
| `RuleBuilder.jsx` | 1,216 | 816 | 33% |
| **Tổng "God Objects"** | **5,343** | **2,690** | **50%** |

### Bundle Size (Production — 2026-04-14)

| Chunk | Size | Gzip |
|-------|------|------|
| `index.js` (core) | 448 KB | 147 KB |
| `AuditView.js` | 35 KB | 9 KB |
| `RuleManager.js` | 33 KB | 9 KB |
| `RuleBuilder.js` | 36 KB | 10 KB |
| `proxy.js` (chart libs) | 130 KB | 43 KB |

---
*Cập nhật: 2026-04-14 — Phase 2 Frontend Decomposition*

