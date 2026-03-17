---
phase: 01-foundation
plan: 02
subsystem: infra
tags: [node-telegram-bot-api, dotenv, telegram, polling, dedup]

# Dependency graph
requires:
  - phase: 01-foundation plan 01
    provides: storage.js with readExpenses/appendExpense/popExpense, package.json with all deps, .env.example, .gitignore
provides:
  - index.js: Telegram long-polling bot with composite-key dedup guard
  - claude.js: Phase 2 stub for Anthropic SDK integration
  - prompts.js: Phase 2 stub for system prompt strings
  - tests/dedup.test.js: unit tests for dedup guard (5 tests)
  - tests/bot.test.js: smoke tests for bot module (2 tests)
affects: [02-claude-integration, 03-commands]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "require.main === module guard: bot polling starts only when run directly, enabling require-based unit testing"
    - "Composite dedup key chatId:messageId (update_id not available on Message object in node-telegram-bot-api)"
    - "Export internal functions with _ prefix for testability: _dedupCheck, _processedMessages"

key-files:
  created:
    - index.js
    - claude.js
    - prompts.js
    - tests/dedup.test.js
    - tests/bot.test.js
  modified:
    - package.json

key-decisions:
  - "Dedup key is chatId:messageId composite (not update_id) — update_id is on the Update object, not the Message object node-telegram-bot-api exposes to event handlers"
  - "require.main === module guard used instead of NODE_ENV check — cleaner, no env var required for testability"
  - "npm test script uses glob pattern 'tests/*.test.js' not 'tests/' — Node v24 test runner does not resolve directory paths"

patterns-established:
  - "Stub files pattern: 'use strict' + Phase N comment block + module.exports = {}"
  - "TDD with node:test built-in: RED (write tests), GREEN (write code), run full suite"

requirements-completed:
  - FOUNDATION-BOT
  - FOUNDATION-STUBS

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 1 Plan 02: Bot Entry Point and Phase 2 Stubs Summary

**Telegram long-polling bot skeleton with Set-based chatId:messageId dedup guard, require.main guard for testability, and claude.js/prompts.js stubs completing the 4-file structure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T18:47:18Z
- **Completed:** 2026-03-17T18:50:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- index.js: fully functional bot entry point with dotenv-first, token validation, polling (when run directly), composite dedup guard, error handling, and testable exports
- 7 new tests: 5 dedup unit tests + 2 bot smoke tests — full suite 15/15 green
- claude.js and prompts.js stubs complete the 4-file project structure (index.js, storage.js, claude.js, prompts.js)
- Fixed npm test script for Node v24 compatibility (Rule 3 deviation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Dedup guard tests and bot entry point** - `dc6ced9` (feat + test TDD)
2. **Task 2: Create Phase 2 stub files** - `153f7e0` (feat)

**Plan metadata:** pending (docs commit below)

_Note: TDD task had a combined commit (RED tests + GREEN implementation in one commit since tests failed until index.js existed)_

## Files Created/Modified
- `index.js` - Bot entry point: dotenv-first, token guard, dedup Set, polling (require.main guard), exports for testing
- `tests/dedup.test.js` - 5 unit tests for dedup guard: first call returns false, duplicate returns true, different keys return false, key format verified
- `tests/bot.test.js` - 2 smoke tests: syntax check via node -c, exports check
- `claude.js` - Phase 2 stub: Anthropic SDK integration placeholder
- `prompts.js` - Phase 2 stub: system prompt strings placeholder
- `package.json` - Fixed test script glob pattern for Node v24

## Decisions Made
- Used `require.main === module` guard for testability instead of `NODE_ENV` check — cleaner pattern requiring no env setup
- Composite dedup key `chatId:messageId` confirmed correct (RESEARCH.md Pitfall 1: update_id is on Update object, not Message)
- Placeholder text `"Bot aktif! Fitur expense logging segera hadir."` locked in as specified by CONTEXT.md

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed npm test script for Node v24**
- **Found during:** Task 1 (running full suite verification)
- **Issue:** `node --test tests/` resolves `tests` as a module, not a directory, in Node v24.11.1 — throws MODULE_NOT_FOUND
- **Fix:** Changed package.json test script from `node --test tests/` to `node --test 'tests/*.test.js'`
- **Files modified:** package.json
- **Verification:** `npm test` runs all 15 tests successfully
- **Committed in:** dc6ced9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for `npm test` to work. No scope creep.

## Issues Encountered
None beyond the Node v24 test runner path resolution issue (handled as Rule 3 deviation above).

## User Setup Required
None - no external service configuration required for this plan. Running the bot requires a valid `TELEGRAM_TOKEN` in `.env`, but that is pre-existing setup from Plan 01.

## Next Phase Readiness
- 4-file structure complete: index.js, storage.js, claude.js, prompts.js
- Full test suite (15 tests) green
- Phase 2 can immediately fill in claude.js (Anthropic SDK) and prompts.js (system prompts)
- index.js message handler stub ready to be replaced with real Claude API calls in Phase 2

---
*Phase: 01-foundation*
*Completed: 2026-03-17*
