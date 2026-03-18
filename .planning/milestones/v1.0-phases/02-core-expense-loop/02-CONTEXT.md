# Phase 2: Core Expense Loop - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the full message-in → Claude parses → storage write → reply-out cycle. By end of phase: users can log expenses in natural Bahasa Indonesia, receive a casual confirmation, delete the last entry via /hapus, and get a friendly redirect for off-topic messages. No summaries, no budget alerts, no commands beyond /hapus — those are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Confirmation Reply Style
- Show all three fields: amount + category + description — e.g. "Oke, nasi goreng 35rb (makan) dicatat!"
- Always casual personality — varied phrasings every time ("Oke!", "Siip!", "Noted ya") — Claude generates wording, not a template
- Emoji: Claude decides per-message — a food emoji for makan, skip it for tagihan — organic, not forced
- Length: 1 line max — texting-friend speed, no multi-line responses

### Non-Expense Handling (BOT-03)
- Claude generates the redirect — same API call detects no tool was called = not an expense
- Response is short, friendly, always includes an example: e.g. "Gue cuma bisa bantu catat pengeluaran. Coba: 'makan siang 35rb' 😊"
- The example is always included — teaches the pattern every time, especially for new users
- No separate hardcoded fallback — personality stays consistent through Claude

### /hapus Response
- Name the deleted item explicitly: "Dihapus: nasi goreng 35rb (makan)" — user sees what was removed, can catch mistakes
- If nothing to delete: "Belum ada pengeluaran yang dicatat." — short, casual, no error tone, no nudge

### Roast Trigger Context
- Expense amount only — no budget context needed
- Claude decides when an amount warrants a roast based on the expense alone (e.g. "200rb buat kopi?")
- Works immediately for all users, even before any budget is set
- Roast intensity: Cleo-style, sharper wit — "literally where does your money go" energy, not just light teasing
- Roast is appended to the confirmation line (keeping 1-line limit means roast replaces or is the confirmation line)

### Claude's Discretion
- Exact tool schema for expense extraction (tool name, field names, required vs optional)
- System prompt length and structure in prompts.js
- How to distinguish "35rb" from "35.000" from "35ribu" — Claude handles all Indonesian amount formats
- Error handling when Claude API is unavailable

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Requirements coverage for this phase
- `.planning/REQUIREMENTS.md` — CORE-01, CORE-02, CORE-03, CORE-04, CATEG-01, PERS-01, PERS-02, BOT-03

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Expense schema, storage patterns, dedup guard decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `storage.js` — `appendExpense(userId, expense)`, `popExpense(userId)`, `readExpenses(userId)` — fully implemented, concurrency-safe
- `index.js` — Bot entry point with dedup guard (`_dedupCheck`), message routing; replace placeholder reply with real handler
- `claude.js` — Empty stub, ready for `const Anthropic = require('@anthropic-ai/sdk')`
- `prompts.js` — Empty stub, ready for exported system prompt strings

### Established Patterns
- CommonJS throughout (`require`/`module.exports`) — node-telegram-bot-api and the project are CJS-only
- Expense schema already decided: `{ amount, category, description, timestamp }` — amount is plain IDR integer
- 9 categories locked: makan, transport, hiburan, tagihan, kost, pulsa, ojol, jajan, lainnya
- `require.main === module` guard for testability in index.js

### Integration Points
- `index.js` `bot.on('message')` handler — call `claude.processMessage(userId, text)` here, then `storage.appendExpense()`
- `claude.js` — implement `processMessage(userId, text)` using Anthropic tool_use to extract expense fields
- `prompts.js` — export system prompt string; imported by claude.js

</code_context>

<specifics>
## Specific Ideas

- Roast should feel like Cleo AI — sharp, direct, a bit "unhinged but loveable" — not just a gentle tease
- "200rb buat kopi? Sultan nih" is too soft; the target is "literally where does your money go" energy
- Confirmation phrasing should feel varied — not the same template every time — Claude should be creative within the 1-line constraint

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core-expense-loop*
*Context gathered: 2026-03-17*
