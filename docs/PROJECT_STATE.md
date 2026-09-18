# PROJECT STATE — OMEGA OS v20.2

Date: 2026-09-18
Mode: single-writer store + event queue
Autonomy default: A2

## Live
- https://grok-repo.vercel.app (older v20.0 snapshot)
- Worker: https://omega-chronicle.vercel.app/api/chronicle (20.1)
- Source: https://github.com/M-AI-SELF-ADMIN/omega-os-v20

## v20.2
- `src/runtime/store.js` — one queue, sync flush, `useSyncExternalStore`
- Events: TICK / LAUNCH / APPROVE / SET_*
- Second intent queues behind a live mission; dequeues on terminal phase
- `simTick` returns sparks; world reducer does not call setState
- Approve vs tick cannot clobber (serialized reduce)
- Tests: `npm test` (engine + store) — 6 passing

## Still not real
- No FastAPI / SSE backend
- No live LLM calls
- High-risk tools emit receipts only
- This repo is not the live Vercel production alias
