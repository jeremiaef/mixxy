---
phase: 04-prediction-engine
plan: 01
subsystem: prediction
tags: [node-test, weighted-average, sparsity-detection, tdd, pure-js]

requires:
  - phase: 01-foundation
    provides: storage.js readExpenses contract and DATA_DIR test isolation pattern
  - phase: 02-core-expense-loop
    provides: clientOverride pattern for testability, expense data shape

provides:
  - predict.js module with buildPrediction, _selectMonthWindows, _computeCategories exports
  - tests/predict.test.js with 14 unit tests covering PRED-02, PRED-03, PRED-04
  - History gate returning { sufficient: false } for empty or <30-day expense history
  - Weighted 3-month averaging (42/33/25%) with weight re-scaling for 1 or 2 months
  - Per-category sparsity detection returning 'kurang data' for <3 distinct UTC days

affects:
  - 04-prediction-engine (phase 5 will extend predict.js with Claude classify call)
  - future /prediksi command wiring in index.js

tech-stack:
  added: []
  patterns:
    - "_selectMonthWindows(now) with UTC month arithmetic and year wraparound"
    - "_computeCategories(expenses, windows) weighted average over active windows"
    - "_options.now injection for deterministic date testing without Date mocking"
    - "WEIGHTS lookup table keyed by monthsUsed count"
    - "Old gate expense placed in November 2025 (before m-3 window) to avoid computation interference"

key-files:
  created:
    - predict.js
    - tests/predict.test.js
  modified: []

key-decisions:
  - "_options.now injection chosen for deterministic testing — no Date.now() mocking needed; consistent with established _options pattern"
  - "Old gate expense must be placed BEFORE m-3 window (November or earlier) in tests that assert specific monthsUsed counts"
  - "activeWindows filter based on presence of expenses — months with zero expenses excluded from computation and monthsUsed count"
  - "windowExpenses pre-filtered before passing to _computeCategories — sparsity counted only over active window period"

patterns-established:
  - "Pattern: _options.now Date injection for deterministic date math in buildPrediction"
  - "Pattern: activeWindows = allWindows.filter(w => at least one expense in that window)"
  - "Pattern: OLD_EXPENSE fixture date in November (before m-3) to avoid polluting monthly computations"

requirements-completed: [PRED-02, PRED-03, PRED-04]

duration: 4min
completed: 2026-03-18
---

# Phase 4 Plan 01: Prediction Engine — Core Module Summary

**Pure-JS prediction module with history gate, recency-weighted 3-month averaging (42/33/25%), and per-category sparsity detection returning 'kurang data' — proven by 14 TDD unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T09:22:03Z
- **Completed:** 2026-03-18T09:26:03Z
- **Tasks:** 2 (RED + GREEN TDD cycle)
- **Files modified:** 2

## Accomplishments

- Built `predict.js` with three exports: `buildPrediction`, `_selectMonthWindows`, `_computeCategories`
- History gate returns `{ sufficient: false }` for zero or fewer-than-30-days expense history (PRED-02)
- Weighted 3-month averaging with recency bias (42/33/25%) and re-scaling for 1 or 2 available months (PRED-03)
- Sparsity gate: categories with fewer than 3 distinct UTC transaction days return `'kurang data'` instead of a numeric estimate (PRED-04)
- 14 unit tests covering all behaviors; full 88-test suite passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Write failing tests for predict.js** - `65946cc` (test)
2. **Task 2: GREEN — Implement predict.js to pass all tests** - `f5fd2fc` (feat)

_Note: TDD tasks have two commits (test stub RED → full implementation GREEN)_

## Files Created/Modified

- `/workspaces/mixxy/predict.js` — Prediction engine module; exports buildPrediction, _selectMonthWindows, _computeCategories; no Anthropic SDK dependency
- `/workspaces/mixxy/tests/predict.test.js` — 14 unit tests; DATA_DIR isolation, UTC fixtures, Node:test style matching existing test suite

## Decisions Made

- **`_options.now` injection:** `buildPrediction` accepts `_options.now` (Date object) for deterministic date math in tests. This avoids mocking `Date.now()` globally and is consistent with the established project pattern.
- **activeWindows filtering:** Only windows with at least one expense count toward `monthsUsed`. This means if January and February have data but December has none, `monthsUsed = 2` and 56/44% weights apply.
- **Pre-filtering windowExpenses:** Expenses are filtered to the active window period before passing to `_computeCategories`, ensuring sparsity counts only reflect the active history window.
- **OLD_EXPENSE fixture placement:** Tests that assert specific `monthsUsed` values need the gate-passing expense in November 2025 (before m-3, December 2025) to avoid polluting the December monthly total or expanding `monthsUsed` unexpectedly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test fixture OLD_EXPENSE date causing monthsUsed inflation**

- **Found during:** Task 2 (GREEN phase — running tests)
- **Issue:** `OLD_EXPENSE = '2025-12-01T...'` placed the gate-passing expense inside the December 2025 (m-3) window. This caused `monthsUsed` to include December in tests 7/8/10 where only January+February (or only February) data was intended, resulting in `monthsUsed: 3` instead of `2`, and `83650` instead of `83400` for the 3-month weighted test.
- **Fix:** Changed `OLD_EXPENSE` to `'2025-11-15T08:00:00.000Z'` (November 2025, before all 3 active windows). Documented reason with comment in test file.
- **Files modified:** `tests/predict.test.js`
- **Verification:** All 14 tests pass after fix; correct values (83400, 91200, 100000) confirmed.
- **Committed in:** `f5fd2fc` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test fixture)
**Impact on plan:** Necessary fixture correction; no scope creep; plan logic unchanged.

## Issues Encountered

None beyond the test fixture date alignment issue documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `predict.js` module is ready for Phase 5 to wire into the `/prediksi` Telegram command handler
- Interface contract stable: `{ sufficient: false }` or `{ sufficient: true, monthsUsed: N, categories: { cat: number | 'kurang data' } }`
- `clientOverride` parameter already in position at index 2 for Phase 5 Claude classify integration
- `monthsUsed` field available for Phase 5 hedged language generation
- No blockers; full test suite green

## Self-Check: PASSED

All created files confirmed present. All task commits confirmed in git log.

---
*Phase: 04-prediction-engine*
*Completed: 2026-03-18*
