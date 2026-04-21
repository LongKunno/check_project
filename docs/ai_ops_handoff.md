# AI Ops v1 Handoff Note

## Business Goal
- Expose AI spend, token usage, request history, pricing, and budget controls in one place.
- Make budget blocking visible and auditable across realtime, batch, health, rules, and fix-suggestion flows.
- Give reviewers one merge-ready slice with stable API shapes and verification evidence.

## Completed In This Slice
- Added stable `ai_summary` extraction for audit history/detail and surfaced it in dashboard history + audit views.
- Expanded AI Ops overview with breakdowns by `source`, `provider`, `model`, and `mode`.
- Added `date range` filtering to AI Ops overview/series/request explorer.
- Added request-detail jump metadata for `job_id`, `audit_id`, and `history_id` when available.
- Hardened pricing validation so rows must include `provider`, `mode`, and `model`; default currency remains `USD`.
- Annotated audit-scoped AI requests with saved history/audit references after audit persistence.
- Kept raw payload retention default-off.
- Added targeted telemetry/API tests and stabilized regression tests around upload audit flows.

## Intentional v1 Limits
- No historical backfill for pre-deploy AI activity.
- Pricing catalog remains the only cost source.
- If a model is missing from pricing catalog, requests still log and cost stays `0`.
- Raw payload retention stays disabled by default pending security sign-off.

## API Surface
- `GET /ai/overview`
- `GET /ai/usage/series`
- `GET /ai/requests`
- `GET /ai/requests/{request_id}`
- `GET /ai/pricing`
- `PUT /ai/pricing`
- `GET /ai/budget`
- `PUT /ai/budget`

## Post-Deploy Config
- Populate pricing catalog for each active `provider + mode + model`.
- Set daily/monthly budget if hard-stop is required.
- Leave raw payload retention off unless explicitly approved.
- Expect only newly generated AI requests after deploy to appear in AI Ops.

## Verification Run
- `docker compose exec -T backend pytest tests/ -q`
- `npm run build` in `dashboard/`

## Result
- Backend regression: `174 passed`
- Frontend build: passed

## Demo Script
1. Open AI Ops overview and confirm spend, requests, and token totals.
2. Drill into one AI request and inspect provider/model/status/detail metadata.
3. Enable hard-stop budget, trigger a new AI flow, and confirm blocked-budget visibility.

## Known Limitations
- No backfill for historical AI requests before this telemetry rollout.
- Cost shows `0` until matching pricing rows are configured.
- Screenshots for PR were not generated in this pass.
