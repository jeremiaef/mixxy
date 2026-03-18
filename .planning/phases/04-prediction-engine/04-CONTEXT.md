# Phase 4: Prediction Engine - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A pure-JS `predict.js` module that reads expense history and computes per-category spend projections. Delivers: history gate, weighted 3-month averaging, and sparse-category detection. No Claude calls, no Telegram command wiring — that is Phase 5.

</domain>

<decisions>
## Implementation Decisions

### History gate
- Pass condition: the earliest expense timestamp is ≥30 days ago (`expenses[0].timestamp <= Date.now() - 30 * 24 * 60 * 60 * 1000`)
- If the gate fails, return `{ sufficient: false }` — no projection
- This is the outer gate; the per-category sparsity check is a separate inner gate

### Month window selection
- Use the 3 most recent **complete** calendar months before the current in-progress month
- Example: if today is March 18, use Feb (m-1, 42%), Jan (m-2, 33%), Dec (m-3, 25%)
- The current partial month is excluded — including it would bias estimates downward
- If fewer than 3 complete months exist but the 30-day gate passes, use whatever complete months are available with re-scaled weights:
  - 2 months: m-1=56%, m-2=44% (same recency ratio as 42:33)
  - 1 month: m-1=100%
- The `monthsUsed` field in the return object records how many months were used (Phase 5 uses this for hedged language)

### Sparse category detection
- A category with fewer than 3 distinct transaction days across the entire history window returns `'kurang data'` instead of a numeric estimate
- "Distinct transaction day" = unique calendar date (UTC) with at least one expense in that category
- This is an inner gate applied per-category after the outer 30-day gate passes

### Return object shape
- **Success:** `{ sufficient: true, monthsUsed: N, categories: { cat: amount | 'kurang data', ... } }`
  - `categories` map keys are all categories that appear in the history window
  - Values are either a rounded integer (IDR) or the string `'kurang data'`
- **Insufficient history:** `{ sufficient: false }`
- Phase 5 gates on `sufficient`, reads `monthsUsed` for hedged output, and iterates `categories` for display + classification

### Claude's Discretion
- Exact rounding approach for weighted averages (Math.round is fine)
- How to handle categories that appear in only 1 or 2 of the 3 months (treat missing months as 0 for that month's contribution to the weighted sum)
- Test fixture timestamp format (ISO 8601, UTC, consistent with existing tests)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PRED-02, PRED-03, PRED-04 — the three requirements this phase delivers; defines 30-day gate, weighted average formula, and "kurang data" behavior

### Existing code patterns to follow
- `summary.js` — `_filterCurrentMonth`, `_buildBreakdown` patterns; predict.js is a read-only consumer of storage.js with same contract
- `storage.js` — `readExpenses(userId)` is the only storage call needed; expenses have `{ amount, category, timestamp }` shape
- `tests/summary.test.js` — UTC fixture timestamps, DATA_DIR isolation pattern, Node:test style

### Roadmap context
- `.planning/ROADMAP.md` §Phase 4 and §Phase 5 — Phase 5 builds on the return shape from this phase; planner should read Phase 5 goal to ensure the interface contract serves it

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `storage.readExpenses(userId)` → `[{ amount, category, description, timestamp }]` — the only data source needed
- `_buildBreakdown(expenses)` in `summary.js` — groups expenses by category; predict.js needs similar logic but grouped by month first
- Node:test + assert/strict — established test framework, no new test deps needed

### Established Patterns
- `clientOverride` 3rd-parameter pattern (see `claude.js`, `summary.js`, `budget.js`) — predict.js must accept this even though Phase 4 has no Claude calls (Phase 5 will extend it)
- UTC month bucketing: `d.getUTCFullYear()`, `d.getUTCMonth()` — matches `_filterCurrentMonth` in summary.js
- `DATA_DIR` env var isolation for tests: `process.env.DATA_DIR = tmpDataDir` before requiring storage
- Export private helpers with underscore prefix (e.g., `_filterCurrentMonth`) for direct unit testing

### Integration Points
- `predict.js` exports `buildPrediction(userId)` — consumed by Phase 5's `/prediksi` command handler in `index.js`
- No writes to storage — read-only, no mutex needed
- Phase 5 will call Claude with the `categories` map as pre-computed input; the shape must be stable

</code_context>

<specifics>
## Specific Ideas

- Return shape confirmed by user: flat `categories` map with scalar values (`amount` or `'kurang data'`), not nested objects
- Weighted average weights already locked in roadmap decisions: 42% / 33% / 25%

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-prediction-engine*
*Context gathered: 2026-03-18*
