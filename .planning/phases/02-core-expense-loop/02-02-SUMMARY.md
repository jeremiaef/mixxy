---
phase: 02-core-expense-loop
plan: "02"
subsystem: bot
tags: [telegram, routing, storage, claude, expense-logging]

# Dependency graph
requires:
  - phase: 02-01
    provides: processMessage from claude.js (intent classification + data extraction + reply generation)
  - phase: 01-foundation
    provides: storage.js with appendExpense/popExpense, index.js with dedup guard
provides:
  - "Functional end-to-end expense logging: natural language -> Claude -> storage -> Telegram reply"
  - "/hapus command: routes to storage.popExpense directly, names deleted item in reply"
  - "formatAmount helper: IDR integer -> human-readable (35000->35rb, 1500000->1.5jt)"
  - "Error fallback: Waduh, ada error. Coba lagi ya."
affects: [03-expense-reporting, any phase that calls index.js handler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command routing: check for /hapus BEFORE processMessage to avoid unnecessary API call"
    - "formatAmount: plain integer -> rb/jt notation using divide-by-1000 or divide-by-1000000"
    - "Export private helpers as _prefixed for testability without mocking (e.g., _formatAmount)"

key-files:
  created: []
  modified:
    - index.js
    - tests/bot.test.js

key-decisions:
  - "/hapus checked before processMessage — guarantees no Anthropic API call for delete command"
  - "formatAmount exported as _formatAmount for direct unit testing without integration complexity"
  - "Non-text messages (stickers, photos) silently ignored with !msg.text guard"

patterns-established:
  - "Pattern: /hapus guard before Claude routing prevents accidental API calls for slash commands"
  - "Pattern: formatAmount centralises amount display — all user-facing amounts go through this"

requirements-completed: [CORE-04]

# Metrics
duration: 1min
completed: 2026-03-17
---

# Phase 2 Plan 02: Message Handler Routing Summary

**Telegram bot fully wired: /hapus routes to storage directly, all other text routes through Claude to storage with casual Bahasa confirmation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T19:27:21Z
- **Completed:** 2026-03-17T19:28:30Z
- **Tasks:** 1 of 2 automated (Task 2 is checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments
- index.js now routes /hapus directly to storage.popExpense — zero Claude API calls for deletions
- /hapus reply names deleted item explicitly: "Dihapus: {description} {amount} ({category})"
- Natural language expenses route through processMessage -> appendExpense -> sendMessage
- formatAmount helper converts plain IDR integers to human-readable rb/jt notation
- Error handler catches failures and sends "Waduh, ada error. Coba lagi ya." fallback
- Non-text messages (stickers, photos) silently ignored
- Full test suite: 25 tests pass including 3 new formatAmount tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire index.js message handler with /hapus and Claude routing** - `66d175c` (feat)

**Plan metadata:** pending final commit

## Files Created/Modified
- `/workspaces/mixxy/index.js` - Full message routing: /hapus -> storage, all other text -> Claude -> storage -> reply
- `/workspaces/mixxy/tests/bot.test.js` - Extended with formatAmount describe block (3 tests)

## Decisions Made
- /hapus guard placed before processMessage call — guarantees no Anthropic API call for the delete command (follows plan exactly)
- formatAmount exported as _formatAmount for direct unit testing (follows plan pattern established in Plan 01)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all tests passed on first run.

## User Setup Required
None for this plan. Bot requires TELEGRAM_TOKEN and ANTHROPIC_API_KEY in .env for Task 2 human verification.

## Next Phase Readiness
- Complete end-to-end expense loop implemented
- Awaiting Task 2 human verification: user types expenses in Telegram, verifies /hapus, off-topic redirect, and roast behavior
- Once verified, Phase 2 is complete and Phase 3 (expense reporting) can begin

---
*Phase: 02-core-expense-loop*
*Completed: 2026-03-17*
