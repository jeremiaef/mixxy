# Phase 3: Commands and Reporting - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the v1 feature set: /rekap summaries (command + natural language), /budget with 80%/100% alerts, /start onboarding, /help command listing, and a weekly auto-digest sent every Sunday 03:00 UTC (10:00 WIB). Phase 3 ends when all CATEG-02, SUMM-01 through SUMM-05, BUDG-01 through BUDG-04, BOT-01, BOT-02 requirements are satisfied. Expense logging itself (Phase 2) is complete and unchanged.

</domain>

<decisions>
## Implementation Decisions

### Summary format & length
- Multi-line is OK for summaries — the 1-sentence rule was for expense confirmations only
- Show only categories with spending (skip zero-spend categories)
- Per category: amount + count — e.g. "Makan: 5x • 235.000"
- Claude-generated insight appears as 1-2 sentences at the bottom of the summary (after category breakdown)
- Empty state for /rekap with no expenses: short casual message that includes a usage example, same redirect pattern as BOT-03 — e.g. "Bulan ini belum ada pengeluaran yang dicatat. Coba: 'makan siang 35rb'"

### Budget storage & UX
- /budget 500000 = set budget; /budget (no arg) = view current budget + spending progress
- Budget stored in a separate metadata file: data/{userId}_meta.json — keeps the expenses array clean and extensible
- Budget limit persists month-to-month until user changes it; monthly spending resets naturally via timestamp-based filtering
- 80%/100% alerts trigger after each expense is logged: recalculate monthly total, and if it just crossed 80% or 100%, append the warning to the expense confirmation reply
- At 100%, include a light roast (consistent with Phase 2 personality)
- /budget with no budget set: short casual message explaining how to set one

### Weekly digest architecture
- Library: node-cron — lightweight, CJS-compatible. Schedule: '0 3 * * 0' = Sundays 03:00 UTC (10:00 WIB)
- User discovery: iterate the data/ directory — each {userId}.json filename is a user ID. No separate user registry needed.
- Digest content: same structure as /rekap but scoped to the past 7 days — category breakdown + count, total, Claude-generated weekly insight/suggestions
- If bot is blocked by a user (sendMessage throws), catch and continue — do not crash the cron job
- Cron runs inside the same index.js process (no separate worker)

### Natural language rekap routing
- "rekap bulan ini", "pengeluaran bulan ini berapa?" etc. route through processMessage — Claude detects intent
- Claude returns two new intent signals via tool_use or a flag: rekap_bulan (monthly summary) and rekap_minggu (weekly summary)
- index.js checks the returned intent and calls the appropriate summary function, then sends the result
- This keeps routing logic in one place and handles phrasing variants naturally

### /start and /help
- Claude's discretion for exact wording, but both must be in casual Bahasa Indonesia
- /start: onboarding message with at least 2-3 concrete examples of how to log expenses in BI
- /help: lists all commands (/rekap, /budget, /hapus, /start, /help) with short Bahasa Indonesia descriptions

### Claude's Discretion
- Exact wording for budget progress display (e.g. "500rb budget, udah kepake 350rb (70%)")
- Exact wording for 80% and 100% alerts (100% must include a roast)
- /start onboarding text and examples
- /help command descriptions
- Summary header/title format
- How processMessage API change is structured to return intent (rekap_bulan / rekap_minggu) vs isExpense

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Requirements coverage for this phase
- `.planning/REQUIREMENTS.md` — CATEG-02, SUMM-01, SUMM-02, SUMM-03, SUMM-04, SUMM-05, BUDG-01, BUDG-02, BUDG-03, BUDG-04, BOT-01, BOT-02

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Expense schema, storage patterns, file structure
- `.planning/phases/02-core-expense-loop/02-CONTEXT.md` — processMessage API, personality rules, confirmation style

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `storage.js` — `readExpenses(userId)` returns the full flat array; filter by `timestamp` month for /rekap and by past 7 days for weekly digest. Already concurrency-safe.
- `claude.js` — `processMessage(userId, text, clientOverride)` — needs extension to return rekap_bulan/rekap_minggu intents. clientOverride pattern used for testing.
- `prompts.js` — `SYSTEM_PROMPT` — needs extension with rekap intent instructions. `EXPENSE_TOOL` schema may need extension or a second tool for rekap intents.
- `index.js` — `bot.on('message')` handler already routes /hapus before Claude. Same pattern applies for /start, /help, /rekap, /budget.

### Established Patterns
- CommonJS throughout — `require`/`module.exports`, no ES modules
- /hapus guard in index.js runs before processMessage — same pattern for new commands
- `_formatAmount` exported for testability; budget progress formatting should follow same pattern
- `clientOverride` 3rd parameter for testability in claude.js
- Single Anthropic API call does triple duty — extend to quad duty (expense | rekap_bulan | rekap_minggu | redirect)

### Integration Points
- `index.js` — add cron setup (node-cron) at module level, guarded by `require.main === module`
- `storage.js` — add `readMeta(userId)` and `writeMeta(userId, meta)` for budget persistence (data/{userId}_meta.json)
- `prompts.js` — add `SUMMARY_PROMPT` or extend `SYSTEM_PROMPT` for rekap/weekly digest generation
- New `summary.js` or inline function to generate formatted summary text from expense array + optional budget context

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond decisions above — open to standard approaches for formatting and wording.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-commands-and-reporting*
*Context gathered: 2026-03-17*
