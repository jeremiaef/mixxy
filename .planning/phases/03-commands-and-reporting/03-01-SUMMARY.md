---
phase: 03-commands-and-reporting
plan: 01
subsystem: storage, reporting
tags: [anthropic, write-file-atomic, async-mutex, node-test]

# Dependency graph
requires:
  - phase: 02-core-expense-loop
    provides: storage.js with readExpenses/appendExpense/popExpense, clientOverride pattern, DATA_DIR isolation
provides:
  - readMeta(userId) — reads {userId}_meta.json, returns {} on ENOENT
  - writeMeta(userId, meta) — atomic write via getMutex('{userId}_meta')
  - buildMonthlySummary(userId, clientOverride) — formatted IDR breakdown or empty-state string
  - buildWeeklySummary(userId, clientOverride) — returns null when no recent expenses
  - generateInsight(expenses, period, clientOverride) — Claude insight with max_tokens 512
  - _filterCurrentMonth, _filterPastWeek, _buildBreakdown — exported helpers for testing
affects:
  - 03-02 (budget alerting uses readMeta/writeMeta for budget persistence)
  - 03-03 (command handlers use buildMonthlySummary, buildWeeklySummary)
  - 03-04 (cron digest uses buildWeeklySummary null-return to skip empty digests)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - clientOverride 3rd parameter in summary functions (same pattern as claude.js)
    - Separate mutex keys for expense vs meta: '{userId}' vs '{userId}_meta'
    - null return from buildWeeklySummary signals cron to skip empty digests

key-files:
  created:
    - summary.js
    - tests/summary.test.js
  modified:
    - storage.js
    - tests/storage.test.js

key-decisions:
  - "buildWeeklySummary returns null (not empty string) for empty periods — cron can skip with simple falsy check"
  - "generateInsight uses max_tokens 512 (not 256) — insight requires more tokens than single-intent classification"
  - "Meta mutex key is '{userId}_meta' distinct from expense mutex '{userId}' — allows concurrent meta+expense writes"

patterns-established:
  - "clientOverride 3rd param: async functions accept optional clientOverride for unit-testability without mocking"
  - "Null sentinel: buildWeeklySummary returns null to signal no-op, consistent with popExpense null-on-empty"
  - "Helper exports prefixed with underscore (_filterCurrentMonth etc.) for internal test access"

requirements-completed: [SUMM-01, SUMM-03, SUMM-05, BUDG-01]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 3 Plan 1: Summary Module and Meta Storage Summary

**summary.js with IDR-formatted monthly/weekly builders and Claude insight (max_tokens 512), plus storage.js extended with atomic readMeta/writeMeta using distinct mutex keys**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T20:26:41Z
- **Completed:** 2026-03-17T20:28:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended storage.js with readMeta/writeMeta using `{userId}_meta` mutex key, separate from expense mutex
- Created summary.js with buildMonthlySummary (breakdown + insight), buildWeeklySummary (null on empty), generateInsight (max_tokens 512)
- 22 new tests across storage.test.js and summary.test.js — all 47 tests green with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend storage.js with readMeta and writeMeta** - `241f6d7` (feat)
2. **Task 2: Create summary.js with buildMonthlySummary, buildWeeklySummary, generateInsight** - `11c49dd` (feat)

_Note: TDD tasks have test (RED) written before implementation (GREEN)_

## Files Created/Modified
- `/workspaces/mixxy/storage.js` - Added readMeta, writeMeta; updated module.exports to 5 exports
- `/workspaces/mixxy/tests/storage.test.js` - Extended with 5 meta storage tests
- `/workspaces/mixxy/summary.js` - New module: buildMonthlySummary, buildWeeklySummary, generateInsight, 3 helpers
- `/workspaces/mixxy/tests/summary.test.js` - New test file: 12 tests covering all exports

## Decisions Made
- buildWeeklySummary returns null for empty periods (not empty string) — downstream cron can use `if (summary)` pattern
- generateInsight uses max_tokens: 512 — insight generation needs more tokens than intent classification (256)
- Meta mutex key `{userId}_meta` is distinct from expense mutex `{userId}` — allows concurrent meta+expense writes without deadlock

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (budget alerting) can now use readMeta/writeMeta for budget persistence
- Plan 03 (command handlers) can use buildMonthlySummary and buildWeeklySummary with clientOverride
- Plan 04 (cron digest) can use buildWeeklySummary null return to skip users with no recent activity
- All foundational data-access and formatting functions are tested and ready

---
*Phase: 03-commands-and-reporting*
*Completed: 2026-03-17*

## Self-Check: PASSED

- summary.js: FOUND
- storage.js: FOUND
- tests/summary.test.js: FOUND
- tests/storage.test.js: FOUND
- 03-01-SUMMARY.md: FOUND
- Commit 241f6d7 (Task 1): FOUND
- Commit 11c49dd (Task 2): FOUND
