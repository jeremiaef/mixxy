---
phase: 03-commands-and-reporting
plan: 02
subsystem: api
tags: [anthropic, tool-use, intent-routing, rekap, bahasa-indonesia]

# Dependency graph
requires:
  - phase: 02-core-expense-loop
    provides: processMessage with EXPENSE_TOOL, prompts.js with SYSTEM_PROMPT and EXPENSE_TOOL

provides:
  - REKAP_TOOL exported from prompts.js with name 'report_intent' and enum ['rekap_bulan', 'rekap_minggu']
  - processMessage returns { intent, isExpense, expense?, reply? } on all 4 code paths
  - Claude API call now passes 2 tools: log_expense and report_intent
  - SYSTEM_PROMPT extended with rekap routing instructions in Bahasa Indonesia

affects:
  - 03-commands-and-reporting (index.js needs to branch on result.intent to call summary functions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tool name discriminator: check b.name === 'report_intent' vs 'log_expense' before treating any tool_use block"
    - "Intent field on all return paths: expense, redirect, rekap_bulan, rekap_minggu — consumer branches on result.intent"
    - "TDD with mock client pattern: REKAP_BULAN_RESPONSE / REKAP_MINGGU_RESPONSE mocks added alongside existing mocks"

key-files:
  created: []
  modified:
    - prompts.js
    - claude.js
    - tests/claude.test.js

key-decisions:
  - "REKAP_TOOL passed alongside EXPENSE_TOOL — Claude selects tool by name; no regex needed for rekap intent detection"
  - "intent field added to all 4 return paths (expense, redirect, rekap_bulan, rekap_minggu) for clean consumer branching in index.js"
  - "Existing EXPENSE_TOOL detection changed from generic tool_use find to name-specific find (b.name === 'log_expense') to handle two-tool API"

patterns-established:
  - "Tool-name discriminator pattern: response.content.find(b => b.type === 'tool_use' && b.name === 'specific_name')"

requirements-completed: [SUMM-02, SUMM-03]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 3 Plan 02: Intent Routing via report_intent Tool Summary

**REKAP_TOOL added to Anthropic API call so natural language rekap requests route to rekap_bulan/rekap_minggu intents instead of regex, with processMessage returning intent field on all 4 code paths**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T20:26:41Z
- **Completed:** 2026-03-17T20:28:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- REKAP_TOOL defined in prompts.js with name 'report_intent', enum ['rekap_bulan', 'rekap_minggu'], and required 'type' field
- SYSTEM_PROMPT extended with Bahasa Indonesia instructions for rekap routing (panggil report_intent, JANGAN log_expense)
- processMessage updated to detect report_intent tool block by name and return { intent: 'rekap_bulan'|'rekap_minggu', isExpense: false }
- All 4 return paths now include intent field: 'expense', 'redirect', 'rekap_bulan', 'rekap_minggu'
- 7 new tests covering rekap_bulan, rekap_minggu, backward-compat intent fields, and two-tool API assertion

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend prompts.js with REKAP_TOOL and updated SYSTEM_PROMPT** - `6af1665` (feat)
2. **Task 2: Extend claude.js processMessage to detect report_intent and return intent field** - `11c49dd` (feat)

_Note: TDD tasks — tests written (RED) then implementation (GREEN) in single commits per task_

## Files Created/Modified
- `prompts.js` - Added REKAP_TOOL constant, extended SYSTEM_PROMPT with rekap routing instructions, exported REKAP_TOOL
- `claude.js` - Imported REKAP_TOOL, added to tools array, replaced generic tool detection with name-specific discriminator, added intent field to all return paths
- `tests/claude.test.js` - Added REKAP_BULAN_RESPONSE and REKAP_MINGGU_RESPONSE mocks, added 7-test describe block for rekap intents, updated tools.length assertion from 1 to 2

## Decisions Made
- REKAP_TOOL passed alongside EXPENSE_TOOL — Claude selects tool by name; no regex needed for rekap intent detection
- intent field added to all 4 return paths for clean consumer branching in index.js (plan 03-04)
- Existing tool detection changed from generic `find(b => b.type === 'tool_use')` to name-specific `find(b => b.name === 'log_expense')` to handle two-tool API response

## Deviations from Plan

None - plan executed exactly as written.

Note: `tests/summary.test.js` showed a pre-existing failure (Cannot find module '../summary.js') before this plan's changes — verified by git stash test run. This is out of scope; summary.js was created by plan 03-01 and the test now passes cleanly.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- processMessage now returns intent field on all paths — index.js (plan 03-04) can branch on result.intent to call buildMonthlySummary or buildWeeklySummary
- All 47 tests passing with no regressions

---
*Phase: 03-commands-and-reporting*
*Completed: 2026-03-17*
