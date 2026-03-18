# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-18
**Phases:** 5 | **Plans:** 12 | **Timeline:** 2 days

### What Was Built
- Telegram bot that understands natural Bahasa Indonesia expense input via Claude tool use
- Full command suite: `/rekap`, `/budget` (global + per-category), `/hapus`, `/start`, `/help`, weekly Sunday digest
- Pure-JS prediction engine with 30-day history gate and recency-weighted 3-month averaging
- `/prediksi` command with Claude-powered tetap/variabel classification and hedged output

### What Worked
- **TDD discipline paid off** — 99 tests across all modules caught regressions immediately; zero production bugs on Railway deploy
- **Separation of concerns** — pure-JS `predict.js` data layer before Claude classification kept the AI focused purely on labeling, not arithmetic
- **clientOverride pattern** — injecting a mock Claude client in tests meant no real API calls and fast test runs throughout all phases
- **Command guard before NLP fallthrough** — placing command routing before Claude in `index.js` eliminated wasted API calls on `/prediksi`, `/rekap`, etc.
- **Wave-based execution** — GSD's wave grouping let Phase 5's two plans execute sequentially with clean handoff

### What Was Inefficient
- `/prediksi` was scoped as a "v1.1" feature in PROJECT.md but ended up shipping in v1.0 — the milestone naming drifted during development; keep milestone scope locked earlier
- SUMMARY.md one-liner extraction didn't populate (tool returned null), requiring manual grep — investigate gsd-tools `summary-extract` field name

### Patterns Established
- `clientOverride` spy pattern for testing any Claude-calling module without API calls
- Command guard block in `index.js` before NLP fallthrough (extend for all future commands)
- Per-user meta object in `storage.js` for persisting settings (budgets, onboarding state) alongside expense arrays
- `_formatAmount(n)` helper for consistent IDR display with `.` thousands separator

### Key Lessons
1. **Lock milestone scope before planning** — features discovered during development that feel "obvious" additions should go into a new milestone, not silently expand the current one
2. **Pure-JS data layer before Claude** — always compute numbers in JS, use Claude only for classification/language; this makes testing trivial and prevents hallucinated figures
3. **Test the insufficient-data paths first** — the 30-day gate UX was the first live Telegram interaction confirmed; guard clauses are user-facing features too

### Cost Observations
- Model mix: ~100% sonnet (executor + verifier)
- Sessions: ~1 continuous session
- Notable: 12 plans executed with zero retries; all 99 tests green on first Railway deploy

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 12 | First milestone — baseline established |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|--------------------|
| v1.0 | 99 | 0 (node-cron only new dep) |

### Top Lessons (Verified Across Milestones)

1. Pure-JS computation before Claude keeps tests fast and numbers trustworthy
2. Command guard pattern scales cleanly — add new commands without touching NLP flow
