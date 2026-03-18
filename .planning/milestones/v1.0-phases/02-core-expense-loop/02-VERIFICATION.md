---
phase: 02-core-expense-loop
verified: 2026-03-17T20:00:00Z
status: human_needed
score: 11/11 automated must-haves verified
human_verification:
  - test: "Send 'tadi makan siang 35rb' to the bot in Telegram"
    expected: "Bot replies with a casual 1-line Bahasa Indonesia confirmation that mentions 35rb, category makan, and description — no placeholder text"
    why_human: "End-to-end Claude API call with real ANTHROPIC_API_KEY cannot be verified without live credentials; automated tests use mocked client"
  - test: "Send Indonesian amount slang variants: '22ribu', '1.5jt', 'dua ratus ribu', '35K'"
    expected: "Each is parsed to the correct IDR integer (22000, 1500000, 200000, 35000) and reflected in the confirmation reply"
    why_human: "Amount normalization is delegated to Claude's interpretation of the tool schema description — no programmatic normalization code exists; correctness depends on live model behavior"
  - test: "Send '/hapus' after logging two expenses"
    expected: "Bot replies 'Dihapus: {description} {amount} ({category})' naming the most recent expense; second /hapus removes the next one; third /hapus returns 'Belum ada pengeluaran yang dicatat.'"
    why_human: "Requires real storage state accumulated across live Telegram messages; integration across bot + storage layers"
  - test: "Send an off-topic message e.g. 'siapa presiden Indonesia?'"
    expected: "Bot redirects to expense logging with a friendly example — does NOT answer the question"
    why_human: "Off-topic classification is Claude's decision via text response vs tool_use; requires live model call"
  - test: "Log a noticeably expensive item e.g. 'kopi 200rb'"
    expected: "Bot reply includes a roast-style sarcastic line (Cleo AI energy) rather than a plain confirmation"
    why_human: "Roast trigger is Claude's judgment call — requires live API response to verify the personality instruction is effective"
---

# Phase 2: Core Expense Loop — Verification Report

**Phase Goal:** Users can log expenses in natural Bahasa Indonesia and the bot correctly parses, categorizes, stores, and confirms each one — with personality and delete capability.
**Verified:** 2026-03-17T20:00:00Z
**Status:** human_needed — all automated checks pass; 5 behaviors require live Telegram + Anthropic API
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Plans 02-01 and 02-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | processMessage returns isExpense:true with amount/category/description/reply for expense text | VERIFIED | 7 tests pass; `returns expense fields correctly` asserts all fields |
| 2 | processMessage returns isExpense:false with redirect reply for off-topic text | VERIFIED | `returns isExpense false for off-topic` test passes |
| 3 | Amount normalization works for all IDR formats (35rb, 1.5jt, 22ribu, dua ratus ribu) | VERIFIED (schema) / ? HUMAN (runtime) | EXPENSE_TOOL schema has conversion examples in amount.description; live model needed to confirm |
| 4 | Category is always one of the 9 valid enum values | VERIFIED | `EXPENSE_TOOL.input_schema.properties.category.enum.length === 9`; enum enforced in tool schema |
| 5 | Reply text is non-empty, single-line, uses casual Bahasa Indonesia | VERIFIED | `returns reply string for expense` test asserts length > 0, no `\n`; SYSTEM_PROMPT enforces "kamu" |
| 6 | System prompt instructs roast behavior for high amounts | VERIFIED | SYSTEM_PROMPT (1084 chars) contains Cleo AI roast instructions and sarkastik language |
| 7 | User types natural expense message and bot replies with Claude-generated confirmation | ? HUMAN | Requires live ANTHROPIC_API_KEY + Telegram; bot code path is correct (verified by routing logic) |
| 8 | /hapus removes last expense and names it in reply | VERIFIED (code) / ? HUMAN (live) | `index.js:45-53` checks /hapus before processMessage, calls `storage.popExpense`, formats "Dihapus: {description} {amount} ({category})" |
| 9 | /hapus with no expenses returns 'Belum ada pengeluaran yang dicatat.' | VERIFIED (code) / ? HUMAN (live) | `index.js:51` — conditional branch confirmed |
| 10 | Off-topic messages get friendly redirect | VERIFIED (code) / ? HUMAN (live) | processMessage off-topic path returns isExpense:false; `index.js:57-63` routes reply to sendMessage without appendExpense |
| 11 | /hapus does NOT trigger a Claude API call | VERIFIED | `index.js:44-54` — /hapus guard at line 45 returns before processMessage call at line 57; order confirmed |

**Score:** 11/11 automated must-haves verified; 5 truths also require human/live-API confirmation

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prompts.js` | SYSTEM_PROMPT string and EXPENSE_TOOL schema | VERIFIED | 44 lines; exports both; SYSTEM_PROMPT is 1084 chars |
| `claude.js` | processMessage function with Anthropic SDK integration | VERIFIED | 40 lines; exports processMessage; uses tool_use path and text path |
| `tests/claude.test.js` | Unit tests for processMessage with mocked Anthropic client | VERIFIED | 123 lines; 7 tests; all pass |
| `index.js` | Message routing: /hapus -> storage, other text -> claude -> storage | VERIFIED | 78 lines; contains full routing logic; exports _formatAmount |
| `tests/bot.test.js` | Tests for /hapus routing and message handler wiring | VERIFIED | 37 lines; 5 tests including 3 new formatAmount tests |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `claude.js` | `prompts.js` | `require('./prompts')` | VERIFIED | Line 3: `const { SYSTEM_PROMPT, EXPENSE_TOOL } = require('./prompts')` |
| `claude.js` | `@anthropic-ai/sdk` | `require('@anthropic-ai/sdk')` | VERIFIED | Line 2: `const Anthropic = require('@anthropic-ai/sdk')` |
| `tests/claude.test.js` | `claude.js` | `processMessage(userId, text, mockClient)` | VERIFIED | Line 9 import; called in all 7 tests with mock client |
| `index.js` | `claude.js` | `require('./claude')` and processMessage call | VERIFIED | Line 6: destructured import; line 57: `processMessage(userId, text)` |
| `index.js` | `storage.js` | `require('./storage')` for appendExpense and popExpense | VERIFIED | Line 5: `require('./storage')`; line 46: popExpense; line 60: appendExpense |
| `index.js /hapus handler` | `storage.popExpense` | direct call, no Claude involved | VERIFIED | Line 45 /hapus check; line 46 popExpense call; returns before processMessage at line 57 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CORE-01 | 02-01-PLAN | User logs expense by typing naturally in Bahasa Indonesia | SATISFIED | index.js routes all non-/hapus text through processMessage; storage.appendExpense called on isExpense:true |
| CORE-02 | 02-01-PLAN | Claude extracts amount/category/description via tool_use API including IDR slang | SATISFIED | claude.js uses tool_use API with EXPENSE_TOOL schema; amount.description lists all slang conversion examples |
| CORE-03 | 02-01-PLAN | Bot replies with short confirmation in casual Bahasa Indonesia | SATISFIED | SYSTEM_PROMPT enforces 1-sentence casual Bahasa, "kamu" not "anda"; reply field required in tool schema |
| CORE-04 | 02-02-PLAN | User can delete last logged expense via /hapus | SATISFIED | index.js /hapus handler calls popExpense and sends "Dihapus: {description} {amount} ({category})" |
| CATEG-01 | 02-01-PLAN | Bot auto-categorizes into 9 Indonesian categories | SATISFIED | EXPENSE_TOOL.input_schema.properties.category.enum has exactly 9 values; Claude must choose one |
| PERS-01 | 02-01-PLAN | All bot responses use casual Bahasa Indonesia — "kamu" not "anda" | SATISFIED | SYSTEM_PROMPT line 1: "Pakai 'kamu' bukan 'anda'"; format constraint: "JANGAN pakai 'anda'" |
| PERS-02 | 02-01-PLAN | Bot applies Cleo-style roast humor when user overspends | SATISFIED | SYSTEM_PROMPT contains full roast instructions with Cleo AI examples; Claude decides when to apply |
| BOT-03 | 02-01-PLAN | Off-topic messages get friendly redirect, not general answer | SATISFIED | SYSTEM_PROMPT off-topic section: "JANGAN jawab pertanyaan umum. SELALU kasih contoh pengeluaran"; tested in claude.test.js |

**All 8 requirements claimed by Phase 2 plans are satisfied. No orphaned requirements.**

No Phase 2 requirements appear in REQUIREMENTS.md traceability that are not covered by the plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `index.js` | 66 | `.catch(() => {})` | Info | Silent catch on error notification send — intentional to prevent crash loops when bot cannot send the error reply; this is defensive, not a stub |

No TODO/FIXME/placeholder comments found. No empty return stubs found. The `.catch(() => {})` on line 66 is intentional error-handler resilience — it prevents a secondary failure (unable to send error message) from crashing the outer catch block.

---

### Human Verification Required

The automated test suite (25/25 passing) covers all behavior using a mocked Anthropic client. Five behaviors require a live ANTHROPIC_API_KEY and running Telegram bot to confirm the integration works end-to-end.

#### 1. Natural language expense logging

**Test:** Start `node index.js` with valid `.env`. Send "tadi makan siang 35rb" to the bot in Telegram.
**Expected:** 1-line casual Bahasa Indonesia confirmation mentioning the amount (35rb), category (makan), and description. No placeholder text. Reply stored in `data/{chatId}.json`.
**Why human:** Automated tests mock the Anthropic client. This confirms the real API key, model (`claude-haiku-4-5`), and system prompt produce correct results.

#### 2. IDR amount slang normalization

**Test:** Send four messages: "bayar grab 22ribu", "makan 1.5jt", "beli kopi dua ratus ribu", "jajan 35K".
**Expected:** Each reply correctly reflects the parsed amount (22rb, 1.5jt, 200rb, 35rb respectively) and category.
**Why human:** Amount normalization is delegated entirely to Claude's interpretation of the schema description strings. No programmatic conversion code exists in the codebase. Live model must confirm it follows the examples.

#### 3. /hapus end-to-end

**Test:** Log two expenses. Send "/hapus" twice. Send "/hapus" a third time.
**Expected:** First /hapus: "Dihapus: {most recent item} {amount} ({category})". Second /hapus: removes the earlier item. Third /hapus: "Belum ada pengeluaran yang dicatat."
**Why human:** Requires real stateful storage interaction across a live session. The bot code is verified correct by inspection, but the full integration needs a running instance.

#### 4. Off-topic redirect

**Test:** Send "siapa presiden Indonesia?" to the bot.
**Expected:** Short friendly redirect back to expense logging with a Bahasa Indonesia example (e.g., "Gue cuma bisa bantu catat pengeluaran. Coba: makan siang 35rb"). Bot does NOT answer the question.
**Why human:** Off-topic classification is Claude's decision via text vs tool_use response. The SYSTEM_PROMPT instruction is verified present, but live model compliance needs confirmation.

#### 5. Roast behavior

**Test:** Send "kopi 200rb" or "makan 500rb sendirian" to the bot.
**Expected:** Reply includes a roast-style sarcastic comment (e.g., "kopi 200rb dicatat — duit lo emang daun?") rather than a plain confirmation. Still 1 line, still in Bahasa Indonesia.
**Why human:** Roast trigger is Claude's judgment call. SYSTEM_PROMPT contains the roast instructions but whether the model applies them to the right cases requires live observation.

---

### Gaps Summary

No automated gaps found. The phase goal is fully implemented:

- `prompts.js` — complete SYSTEM_PROMPT with roast personality, casual Bahasa rules, off-topic handling, and EXPENSE_TOOL with 9 categories and IDR conversion examples
- `claude.js` — processMessage routes tool_use to expense path, text-only to off-topic path; clientOverride enables testability
- `index.js` — /hapus guard before processMessage (no unnecessary API calls), routing through appendExpense on isExpense:true, error fallback, formatAmount helper
- `tests/claude.test.js` — 7 unit tests with mock Anthropic client (123 lines, all green)
- `tests/bot.test.js` — extended with 3 formatAmount tests (37 lines)
- Full suite: 25/25 tests pass

The only outstanding items are human verification of live Telegram + Claude API behavior, which cannot be confirmed programmatically.

---

_Verified: 2026-03-17T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
