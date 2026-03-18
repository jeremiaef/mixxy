# Phase 1: Foundation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Runnable Telegram bot skeleton with concurrency-safe JSON storage and project scaffolding. No user-facing features — this delivers the infrastructure substrate all subsequent phases write into. Phase 1 ends when: the bot starts without errors, responds with a placeholder, prevents duplicate processing, and safely persists expense data per user.

</domain>

<decisions>
## Implementation Decisions

### Expense Record Schema
- Each expense is stored as a plain JS object: `{ amount, category, description, timestamp }`
- `amount`: plain number in IDR (e.g. `35000` — integer, no string encoding)
- `category`: string (e.g. `"makan"`, `"transport"`)
- `description`: string — the parsed description from the user's message
- `timestamp`: ISO 8601 UTC string (e.g. `"2026-03-17T10:30:00.000Z"`)
- No explicit expense ID in Phase 1 — `/hapus` in Phase 2 will pop the last array item

### Storage File Structure
- `data/{user_id}.json` is a flat JSON array of expense objects
- Example: `[{ amount: 35000, category: "makan", ... }, ...]`
- `/hapus` → `expenses.pop()` then write back
- `/rekap` → filter by timestamp month
- Array grows indefinitely in Phase 1 (pruning/archiving is out of scope)

### Polling Configuration
- Long polling (not webhook) — works locally, no HTTPS or server setup required
- `node-telegram-bot-api` default polling mode with `{polling: true}`
- Duplicate guard: in-memory `Set` of processed `update_id` values — fast, zero config
- Guard resets on process restart (acceptable — Telegram's offset acknowledgment already prevents redelivery)

### Placeholder Reply
- Bot responds to all messages with a casual Bahasa Indonesia placeholder
- Text: `"Bot aktif! Fitur expense logging segera hadir."` (or close equivalent)
- Replaced entirely in Phase 2 when real logic lands

### Claude's Discretion
- Concurrency approach for safe concurrent file writes (file locking library vs atomic temp-file swap)
- `.gitignore` contents
- `.env.example` formatting and comments
- Error handling depth for Phase 1 (try/catch scope)

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

Phase 1 has no requirement IDs directly (it delivers the substrate). The relevant downstream requirements that the schema must support are in `.planning/REQUIREMENTS.md` (CORE-01 through CORE-04, CATEG-01, SUMM-01 through SUMM-05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. Only a `README.md` exists.

### Established Patterns
- CommonJS throughout (`require`/`module.exports`) — node-telegram-bot-api is CJS-only
- 4-file structure planned from project setup: `index.js`, `claude.js`, `storage.js`, `prompts.js`

### Integration Points
- `index.js` — bot entry point, polling setup, message routing
- `storage.js` — all file I/O for `data/{user_id}.json`
- Phase 2 will call into `storage.js` to write expenses; Phase 3 will call into it for reads and summaries

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-17*
