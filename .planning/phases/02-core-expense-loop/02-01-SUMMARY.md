---
phase: 02-core-expense-loop
plan: 01
subsystem: api
tags: [anthropic, claude-haiku-4-5, tool-use, bahasa-indonesia, expense-extraction]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: storage.js with appendExpense/popExpense/readExpenses and established CJS patterns

provides:
  - prompts.js with SYSTEM_PROMPT (roast personality, off-topic redirect) and EXPENSE_TOOL schema (9 categories, 4 fields)
  - claude.js with processMessage(userId, text, clientOverride) for expense extraction via Anthropic tool_use
  - tests/claude.test.js with 7 unit tests using mock Anthropic client

affects:
  - 02-02-PLAN (index.js integration: call processMessage, wire /hapus command)

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk v0.79.0"
  patterns:
    - "Dependency injection via clientOverride parameter for testability without module mocking"
    - "Single Claude API call for intent classification + data extraction + reply generation"
    - "response.content.find(b => b.type === 'tool_use') not array index — safe for multi-block responses"
    - "TDD RED/GREEN: write failing tests first, then minimal implementation to pass"

key-files:
  created:
    - prompts.js
    - tests/claude.test.js
  modified:
    - claude.js
    - package.json (added @anthropic-ai/sdk dependency)

key-decisions:
  - "claude-haiku-4-5 selected for cost and speed — adequate for structured extraction, Haiku 3 deprecated April 2026"
  - "clientOverride 3rd parameter enables test injection without module-level mocking (CJS-compatible pattern)"
  - "Single tool call does triple duty: intent classification + data extraction + reply generation"
  - "module-level defaultClient created once and reused — reads ANTHROPIC_API_KEY from env automatically"
  - "max_tokens: 256 — sufficient for tool schema overhead + 1-line reply"

patterns-established:
  - "TDD pattern: write failing tests → commit RED → implement → commit GREEN"
  - "Mock client pattern: makeMockClient(response) helper returns { messages: { create: async () => response } }"
  - "processMessage returns { isExpense, expense?, reply } — consistent shape for both paths"

requirements-completed: [CORE-01, CORE-02, CORE-03, CATEG-01, PERS-01, PERS-02, BOT-03]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 2 Plan 01: Claude Integration Layer Summary

**Anthropic tool_use integration with SYSTEM_PROMPT (Cleo-style roast + casual Bahasa Indonesia), EXPENSE_TOOL schema (9 IDR categories), and processMessage function extracting expenses from free-text via single API call**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T19:22:18Z
- **Completed:** 2026-03-17T19:24:52Z
- **Tasks:** 2 (Task 1: prompts.js, Task 2: claude.js TDD)
- **Files modified:** 4

## Accomplishments

- prompts.js exports SYSTEM_PROMPT (1084 chars) with roast instructions, casual persona, off-topic redirect, and format constraints
- EXPENSE_TOOL schema with 9-category enum, IDR conversion examples, and 4 required fields including reply
- claude.js processMessage routes tool_use responses to expense path, text-only to off-topic path — single API call handles both
- 7 unit tests all passing with mock Anthropic client; full suite 22/22 green

## Task Commits

Each task was committed atomically:

1. **Task 1: prompts.js** - `19bd367` (feat)
2. **Task 2: TDD RED — failing tests** - `f361aa6` (test)
3. **Task 2: TDD GREEN — claude.js implementation** - `84b5628` (feat)

_Note: TDD task split into RED (failing tests) and GREEN (implementation) commits_

## Files Created/Modified

- `prompts.js` — SYSTEM_PROMPT string and EXPENSE_TOOL schema exported as CJS module
- `claude.js` — processMessage(userId, text, clientOverride) using Anthropic SDK tool_use
- `tests/claude.test.js` — 7 tests with mock client injection pattern
- `package.json` — added @anthropic-ai/sdk v0.79.0 dependency

## Decisions Made

- **claude-haiku-4-5**: Fastest current model, sufficient for structured extraction, cost-effective at scale. Haiku 3 deprecated April 2026 — must not use.
- **clientOverride parameter**: CJS-compatible testability without complex module mocking. Production passes nothing (uses module-level defaultClient).
- **Single API call triple duty**: One messages.create() handles intent classification (tool_use vs text response), data extraction (tool inputs), and reply generation (reply field). No second call needed.
- **response.content.find() not content[0]**: Anthropic docs note content array order is not guaranteed when both text and tool_use blocks are present.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — npm audit warnings present from existing dependencies but unrelated to this plan's changes.

## User Setup Required

**External services require manual configuration before production use:**

- Add `ANTHROPIC_API_KEY` to `.env` — obtain from console.anthropic.com -> API Keys -> Create Key
- The bot will crash on first message without this key (module-level `new Anthropic()` reads env at startup)

## Next Phase Readiness

- prompts.js and claude.js fully implemented and tested
- processMessage ready to be wired into index.js message handler (Plan 02-02)
- Plan 02-02 will: add /hapus command routing, replace index.js placeholder reply with processMessage call + storage.appendExpense

## Self-Check: PASSED

All files present: prompts.js, claude.js, tests/claude.test.js
All commits found: 19bd367, f361aa6, 84b5628

---
*Phase: 02-core-expense-loop*
*Completed: 2026-03-17*
