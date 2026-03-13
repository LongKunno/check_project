# Project Roadmap: AI Static Analysis as a Platform

This document outlines the strategic directions for evolving this auditor from a script into a comprehensive Code Quality Platform (CQP).

## Phase 1: Core Automation (Current)
- [ ] **Multi-Step Engine**: Full implementation of the 5-step auditor protocol.
- [ ] **Violation Ledger**: Structured logging of all identified issues with code snippets.
- [ ] **Standardized Reports**: High-fidelity Markdown reports with normalized scoring.

## Phase 2: Integration & Ecosystem
- **GitHub Actions / GitLab CI Bot**: 
    - Automatically comment on PRs with the audit score.
    - Block merges if the score falls below a certain threshold (e.g., < 70/100).
- **IDE Extensions**: 
    - VS Code extension to provide "Audit-as-you-type" feedback based on the V3 ruleset.
- **REST API**: 
    - Wrap the auditor in a FastAPI service to allow remote scanning of zipped repositories or git URLs.

## Phase 3: Advanced Intelligence & Self-Healing
- **Self-Healing PRs**: 
    - Use LLMs to automatically generate "Remediation PRs" for common issues (e.g., replacing `.iterrows()` with vectorization, fixing bare exceptions).
- **Historical Analysis**: 
    - Track project health over time. Provide heatmaps showing which components are accumulating technical debt.
- **Natural Language Querying**: 
    - "Audit Chat" - Ask questions about the audit report: *"Why did the security score drop in the last 3 commits?"*

## Phase 4: Enterprise Features
- **Custom Rule Engine**: 
    - Allow teams to define their own Pillar weights and custom Regex/AST rules via a YAML config.
- **Compliance Mapping**: 
    - Automatically map audit findings to specific ISO or SOC2 compliance controls.
- **Dashboard UI**: 
    - A premium React-based dashboard for CTOs/Managers to view the health of all organization projects.
