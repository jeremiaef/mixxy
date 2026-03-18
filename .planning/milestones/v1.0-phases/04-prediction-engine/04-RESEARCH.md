# Phase 4: Prediction Engine - Research

**Researched:** 2026-03-18
**Domain:** Pure-JS financial aggregation — calendar-month bucketing, weighted averages, sparsity detection
**Confidence:** HIGH

## Summary

Phase 4 builds a single module, `predict.js`, that is a pure-JS read-only consumer of the existing `storage.js` contract. There are no new dependencies, no new test frameworks, and no Claude calls in this phase. All design decisions are locked in CONTEXT.md. The research task is therefore: understand the precise algorithmic requirements and map them to concrete implementation patterns from the existing codebase.

The three behaviors that must be proven by unit tests are: (1) the 30-day history gate returning `{ sufficient: false }` early, (2) the weighted 3-month average computation with 42/33/25% weights producing per-category integer estimates, and (3) the per-category sparsity check producing `'kurang data'` for categories with fewer than 3 distinct UTC transaction days. All three are pure arithmetic on in-memory arrays — no I/O, no mocking beyond the `clientOverride` stub.

The existing `summary.js` module is the direct architectural template. `predict.js` follows the same patterns: UTC date bucketing, `_`-prefixed helper exports, `clientOverride` as the third parameter, `DATA_DIR` isolation in tests, and the Node:test + `node:assert/strict` test stack.

**Primary recommendation:** One module `predict.js`, two private helpers exported for unit testing (`_selectMonthWindows`, `_computeCategories`), one public function `buildPrediction(userId, _options, clientOverride)`. All tests in `tests/predict.test.js` using the established Node:test pattern with no Anthropic API calls.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**History gate**
- Pass condition: the earliest expense timestamp is >= 30 days ago (`expenses[0].timestamp <= Date.now() - 30 * 24 * 60 * 60 * 1000`)
- If the gate fails, return `{ sufficient: false }` — no projection
- This is the outer gate; the per-category sparsity check is a separate inner gate

**Month window selection**
- Use the 3 most recent complete calendar months before the current in-progress month
- Example: if today is March 18, use Feb (m-1, 42%), Jan (m-2, 33%), Dec (m-3, 25%)
- The current partial month is excluded — including it would bias estimates downward
- If fewer than 3 complete months exist but the 30-day gate passes, use whatever complete months are available with re-scaled weights:
  - 2 months: m-1=56%, m-2=44% (same recency ratio as 42:33)
  - 1 month: m-1=100%
- The `monthsUsed` field in the return object records how many months were used (Phase 5 uses this for hedged language)

**Sparse category detection**
- A category with fewer than 3 distinct transaction days across the entire history window returns `'kurang data'` instead of a numeric estimate
- "Distinct transaction day" = unique calendar date (UTC) with at least one expense in that category
- This is an inner gate applied per-category after the outer 30-day gate passes

**Return object shape**
- **Success:** `{ sufficient: true, monthsUsed: N, categories: { cat: amount | 'kurang data', ... } }`
  - `categories` map keys are all categories that appear in the history window
  - Values are either a rounded integer (IDR) or the string `'kurang data'`
- **Insufficient history:** `{ sufficient: false }`
- Phase 5 gates on `sufficient`, reads `monthsUsed` for hedged output, and iterates `categories` for display + classification

### Claude's Discretion

- Exact rounding approach for weighted averages (Math.round is fine)
- How to handle categories that appear in only 1 or 2 of the 3 months (treat missing months as 0 for that month's contribution to the weighted sum)
- Test fixture timestamp format (ISO 8601, UTC, consistent with existing tests)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRED-02 | /prediksi requires >= 30 days of expense history — returns a friendly explanation (not a prediction) if history is insufficient | Implemented as history gate: check `expenses[0].timestamp <= Date.now() - 30*24*60*60*1000`; return `{ sufficient: false }` early |
| PRED-03 | Prediction shows estimated spend per category for next month, computed from a weighted 3-month average (all arithmetic in JS, not Claude) | Implemented by `_selectMonthWindows` + per-category weighted sum with 42/33/25% weights; `Math.round` for IDR integers |
| PRED-04 | Categories with fewer than 3 transaction days show "kurang data" instead of an estimate | Implemented as inner gate: count distinct UTC calendar dates per category across the history window; `< 3` → `'kurang data'` |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins only | Node 24 | All date arithmetic, array operations | No new deps needed; pure-JS requirement |
| node:test | built-in (Node 24) | Unit test runner | Established in all existing test files |
| node:assert/strict | built-in (Node 24) | Assertions | Established in all existing test files |

### Supporting (already installed — zero new installs)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| storage.js (local) | - | `readExpenses(userId)` → expense array | Only storage call needed in `predict.js` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node:test built-in | Jest, Vitest | No benefit — Node:test is already the project standard; adding Jest would be a new devDependency for no gain |
| Manual UTC date math | date-fns, luxon | No benefit for this use case; `getUTCFullYear()`, `getUTCMonth()`, `toISOString().slice(0,10)` cover all needs |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

```
predict.js          # New module — parallel to summary.js
tests/
└── predict.test.js # New test file — parallel to summary.test.js
```

### Pattern 1: Module Structure (mirrors summary.js)

**What:** Single CJS module with underscore-prefixed private helpers exported for unit testing, one public async function, `clientOverride` as third parameter.

**When to use:** Always — this is the established project pattern.

**Example:**
```javascript
// Source: summary.js (project codebase)
'use strict';
const storage = require('./storage');

// Private helpers — exported for direct unit testing
function _selectMonthWindows(now) { /* ... */ }
function _computeCategories(expenses, windows) { /* ... */ }

async function buildPrediction(userId, _options, clientOverride) {
  const expenses = await storage.readExpenses(userId);
  // ... gate and compute ...
  return result;
}

module.exports = {
  buildPrediction,
  _selectMonthWindows,
  _computeCategories,
};
```

### Pattern 2: UTC Month Bucketing (from summary.js)

**What:** Use `getUTCFullYear()` and `getUTCMonth()` to assign expenses to calendar months, never local timezone methods.

**When to use:** Any expense timestamp filtering or grouping.

**Example:**
```javascript
// Source: summary.js _filterCurrentMonth
const d = new Date(e.timestamp);
const year = d.getUTCFullYear();
const month = d.getUTCMonth(); // 0-indexed: Jan=0, Dec=11
```

### Pattern 3: History Gate — Earliest Timestamp Check

**What:** Check if the earliest expense in the array is old enough to constitute 30+ days of history.

**When to use:** At the top of `buildPrediction`, before any computation.

**Example:**
```javascript
// Source: CONTEXT.md locked decision
if (!expenses.length) return { sufficient: false };
const earliest = new Date(expenses[0].timestamp).getTime();
if (earliest > Date.now() - 30 * 24 * 60 * 60 * 1000) {
  return { sufficient: false };
}
```

### Pattern 4: Month Window Selection

**What:** Compute which complete calendar months to use, given today's date. The current partial month is always excluded.

**When to use:** In `_selectMonthWindows(now)`.

**Example:**
```javascript
// Derived from CONTEXT.md locked decision
function _selectMonthWindows(now) {
  // now = new Date() by default
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // current in-progress month (excluded)
  // m-1 is month-1 (wrapping Dec → prev year)
  const windows = [];
  for (let i = 1; i <= 3; i++) {
    let m = month - i;
    let y = year;
    if (m < 0) { m += 12; y -= 1; }
    windows.push({ year: y, month: m });
  }
  return windows; // [m-1, m-2, m-3] in order
}
```

### Pattern 5: Weighted Average with Missing-Month Zeros

**What:** Sum `monthlyTotal[i] * weight[i]` for up to 3 months, treating months where a category did not appear as 0.

**When to use:** In `_computeCategories` for each non-sparse category.

**Weights table (locked):**
| Months available | m-1 | m-2 | m-3 |
|-----------------|-----|-----|-----|
| 3 | 0.42 | 0.33 | 0.25 |
| 2 | 0.56 | 0.44 | — |
| 1 | 1.00 | — | — |

**Example:**
```javascript
// Source: CONTEXT.md locked decision
const WEIGHTS = {
  3: [0.42, 0.33, 0.25],
  2: [0.56, 0.44],
  1: [1.00],
};
// For each category:
const weights = WEIGHTS[monthsUsed];
const estimate = Math.round(
  monthlyTotals.reduce((sum, total, i) => sum + total * weights[i], 0)
);
```

### Pattern 6: Distinct Transaction Day Count (Sparsity Gate)

**What:** Count unique UTC calendar date strings for a category across all expenses in the history window.

**When to use:** Per-category, inside `_computeCategories`, applied after collecting monthly totals.

**Example:**
```javascript
// Derived from CONTEXT.md: "unique calendar date (UTC)"
const days = new Set(
  categoryExpenses.map(e => new Date(e.timestamp).toISOString().slice(0, 10))
);
if (days.size < 3) return 'kurang data';
```

### Pattern 7: Test Fixture Style (from summary.test.js and budget.test.js)

**What:** Set `DATA_DIR` env var before requiring storage, use `beforeEach`/`afterEach` with `fs.mkdir`/`fs.rm`, write timestamps as ISO 8601 UTC strings.

**When to use:** Any test that reads from storage.

**Example:**
```javascript
// Source: tests/summary.test.js pattern
'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

const tmpDataDir = path.join(__dirname, `tmp-predict-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.DATA_DIR = tmpDataDir;
process.env.ANTHROPIC_API_KEY = 'test-key';

const { buildPrediction, _selectMonthWindows, _computeCategories } = require('../predict.js');
```

### Pattern 8: clientOverride Parameter (from summary.js, budget.js, claude.js)

**What:** Accept `clientOverride` as a third parameter even when Phase 4 makes no Claude calls. Phase 5 will extend `predict.js` with Claude calls and needs this parameter already in position.

**When to use:** Always — established contract.

**Example:**
```javascript
// Source: summary.js buildMonthlySummary pattern
async function buildPrediction(userId, _options, clientOverride) {
  // clientOverride unused in Phase 4, but position reserved for Phase 5
  const expenses = await storage.readExpenses(userId);
  // ...
}
```

### Anti-Patterns to Avoid

- **Using local timezone methods:** `getMonth()`, `getFullYear()`, `getDate()` on expense timestamps — always use UTC equivalents
- **Including the current partial month:** Only use complete calendar months (m-1, m-2, m-3); the current month is always excluded
- **Requiring Anthropic SDK in predict.js:** Phase 4 has no Claude calls; do not add `require('@anthropic-ai/sdk')` — Phase 5 will add it
- **Checking array sort order as history gate:** The gate checks the earliest timestamp, not just length; use `expenses[0].timestamp` only if data is sorted ascending (storage appends in order, so first element is oldest)
- **Writing to storage:** `predict.js` is read-only; never call `appendExpense` or `writeMeta`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted average | Custom accumulator class | Simple `reduce` with a weights array | One-liner; no abstraction needed |
| Month boundary arithmetic | Timezone-aware library | `getUTCFullYear()`, `getUTCMonth()` with manual wraparound | Project already does this in summary.js |
| Distinct day counting | Loop with conditional | `new Set(dates.map(...)).size` | One-liner using built-in Set deduplication |
| Test isolation | Shared test database | `tmpDataDir` + `DATA_DIR` env var pattern | Already proven in all existing test files |

**Key insight:** This is a pure arithmetic transformation on an in-memory array. Every sub-problem (bucketing, aggregation, deduplication) has a one- or two-line solution using built-in JS. No helper libraries add value.

## Common Pitfalls

### Pitfall 1: History Gate Uses Array Sort Assumption

**What goes wrong:** `expenses[0].timestamp` is the oldest expense only if the array is in ascending insert order. If storage ever reorders (e.g., a future migration), the gate produces wrong results.

**Why it happens:** `storage.readExpenses` returns the array in append order; Phase 1 and all existing modules depend on this.

**How to avoid:** Sort before gating, or use `Math.min` over all timestamps. The CONTEXT.md decision assumes ascending order (matching `appendExpense` behavior), so using `expenses[0]` is correct for the current storage contract. Document the assumption.

**Warning signs:** Tests with out-of-order fixtures returning `sufficient: false` unexpectedly.

### Pitfall 2: Off-by-One in Month Window (Partial Month Inclusion)

**What goes wrong:** Including the current partial month in the 3-month window. If today is March 18, March is partial — including it makes category estimates lower than reality.

**Why it happens:** Iterating `i = 0` instead of `i = 1` in window selection.

**How to avoid:** Window loop starts at `i = 1` (m-1 is the first complete month). Test with a "today = 18th" fixture to confirm.

**Warning signs:** `monthsUsed` = 3 but one of the months has only partial-period data.

### Pitfall 3: Sparsity Gate Counts Transactions, Not Days

**What goes wrong:** Using `categoryExpenses.length < 3` instead of `new Set(dates).size < 3`.

**Why it happens:** Misreading the requirement — "3 distinct transaction days" is not "3 transactions."

**How to avoid:** Always extract the date portion (`toISOString().slice(0,10)`) and deduplicate before counting.

**Warning signs:** A category with 3 transactions all on the same day passing the sparsity gate.

### Pitfall 4: Weight Re-Scaling for Fewer Than 3 Months

**What goes wrong:** Using 3-month weights (42/33/25%) when only 1 or 2 complete months exist.

**Why it happens:** Hard-coding the weight array without checking `monthsUsed`.

**How to avoid:** Use a `WEIGHTS` lookup keyed by the number of available complete months. The CONTEXT.md provides exact values for 1, 2, and 3 months.

**Warning signs:** `monthsUsed: 1` but the category estimate is less than the single month's total (because 42% weight was applied instead of 100%).

### Pitfall 5: Fixture Timestamps in Wrong UTC Day

**What goes wrong:** A fixture meant to represent "Jan 5" lands on "Jan 4" in UTC because the ISO string uses a non-zero hour offset.

**Why it happens:** Using `new Date('2026-01-05')` which is midnight UTC — safe. But `new Date('2026-01-05T23:00:00+07:00')` is Jan 5 WIB but Jan 5 16:00 UTC — still Jan 5 UTC. The risk is constructing strings like `new Date('2026-01-05T01:00:00+08:00')` which is Jan 4 UTC.

**How to avoid:** Use explicit UTC ISO strings in tests: `'2026-01-05T08:00:00.000Z'`. Never use local-time constructors.

**Warning signs:** Sparsity tests failing intermittently depending on system timezone.

## Code Examples

Verified patterns from existing project codebase:

### History Gate
```javascript
// Derived from CONTEXT.md + storage.js contract
async function buildPrediction(userId, _options, clientOverride) {
  const expenses = await storage.readExpenses(userId);
  if (expenses.length === 0) return { sufficient: false };
  const earliest = new Date(expenses[0].timestamp).getTime();
  if (earliest > Date.now() - 30 * 24 * 60 * 60 * 1000) {
    return { sufficient: false };
  }
  // ... proceed to window selection and computation
}
```

### Month Window Selection
```javascript
// Source: CONTEXT.md locked decision + summary.js UTC pattern
function _selectMonthWindows(now) {
  const result = [];
  for (let i = 1; i <= 3; i++) {
    let m = now.getUTCMonth() - i;
    let y = now.getUTCFullYear();
    if (m < 0) { m += 12; y -= 1; }
    result.push({ year: y, month: m });
  }
  return result;
}
```

### Filtering Expenses to a Month Window
```javascript
// Source: summary.js _filterCurrentMonth pattern, adapted
function _filterToWindow(expenses, { year, month }) {
  return expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
}
```

### Per-Category Weighted Computation
```javascript
// Source: CONTEXT.md locked weights + summary.js _buildBreakdown pattern
const WEIGHTS = { 3: [0.42, 0.33, 0.25], 2: [0.56, 0.44], 1: [1.00] };

function _computeCategories(expenses, windows) {
  // Collect all categories across all windows
  const allCats = [...new Set(expenses.map(e => e.category))];
  const n = windows.length;
  const weights = WEIGHTS[n];
  const categories = {};

  for (const cat of allCats) {
    // Sparsity: count distinct UTC days for this category
    const catExpenses = expenses.filter(e => e.category === cat);
    const days = new Set(catExpenses.map(e => new Date(e.timestamp).toISOString().slice(0, 10)));
    if (days.size < 3) {
      categories[cat] = 'kurang data';
      continue;
    }
    // Weighted average over available windows (missing window = 0)
    let estimate = 0;
    for (let i = 0; i < n; i++) {
      const monthExp = _filterToWindow(catExpenses, windows[i]);
      const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);
      estimate += monthTotal * weights[i];
    }
    categories[cat] = Math.round(estimate);
  }
  return categories;
}
```

### Test Fixture Pattern
```javascript
// Source: tests/summary.test.js + tests/budget.test.js established pattern
'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

const tmpDataDir = path.join(
  __dirname,
  `tmp-predict-${Date.now()}-${Math.random().toString(36).slice(2)}`
);
process.env.DATA_DIR = tmpDataDir;
process.env.ANTHROPIC_API_KEY = 'test-key';

const { buildPrediction, _selectMonthWindows } = require('../predict.js');

// UTC ISO fixtures — always use explicit UTC to avoid timezone drift
const FEB_DAY1 = '2026-02-05T08:00:00.000Z';
const FEB_DAY2 = '2026-02-12T08:00:00.000Z';
const FEB_DAY3 = '2026-02-20T08:00:00.000Z';
```

### Verifying No Claude Call in Tests
```javascript
// Source: tests/summary.test.js spy pattern
it('buildPrediction makes zero Anthropic API calls', async () => {
  // predict.js does not require the Anthropic client in Phase 4
  // so this is structurally guaranteed — no spy needed
  // But as belt-and-suspenders: if clientOverride were called, test would fail
  let called = false;
  const spyClient = {
    messages: { create: async () => { called = true; } }
  };
  const { appendExpense } = require('../storage.js');
  // ... seed fixtures ...
  await buildPrediction('testuser', null, spyClient);
  assert.equal(called, false, 'No Claude call expected in Phase 4');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Equal-weight month averages | Recency-weighted (42/33/25%) | Phase 4 design | More accurate for trending spend patterns |
| Show prediction for any history | 30-day gate + sparsity check | Phase 4 design | Prevents misleading predictions from thin data |

**Deprecated/outdated:**
- None — this is a new module with no prior implementation.

## Open Questions

1. **Sort order of `expenses` array from storage**
   - What we know: `appendExpense` appends in call order; tests write in chronological order; existing modules assume append order
   - What's unclear: Is ascending order formally guaranteed or just incidentally true?
   - Recommendation: Document the assumption in `predict.js` as a comment; add a sort-by-timestamp step as a defensive measure if the test fixture ever proves the assumption fragile. For Phase 4, assume ascending order matching `appendExpense` behavior.

2. **Timezone of "distinct transaction day" for the sparsity gate**
   - What we know: CONTEXT.md says "unique calendar date (UTC)" — UTC is locked
   - What's unclear: Nothing — UTC is unambiguous
   - Recommendation: Use `toISOString().slice(0,10)` which is always UTC

3. **Behavior when `expenses` is empty at the history gate**
   - What we know: `storage.readExpenses` returns `[]` for a new user (ENOENT → `[]`)
   - What's unclear: Should `{ sufficient: false }` cover both empty array and <30-day array?
   - Recommendation: Yes — both cases return `{ sufficient: false }`. Check `expenses.length === 0` first, then check the 30-day gate.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) — Node 24 |
| Config file | None — configured via `npm test` glob in package.json |
| Quick run command | `node --test 'tests/predict.test.js'` |
| Full suite command | `node --test 'tests/*.test.js'` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRED-02 | `buildPrediction` returns `{ sufficient: false }` for user with < 30 days of history | unit | `node --test 'tests/predict.test.js'` | Wave 0 |
| PRED-02 | `buildPrediction` returns `{ sufficient: false }` for empty expense history | unit | `node --test 'tests/predict.test.js'` | Wave 0 |
| PRED-03 | Given 3 months of fixture data, `buildPrediction` returns per-category weighted averages matching 42/33/25% to within `Math.round` | unit | `node --test 'tests/predict.test.js'` | Wave 0 |
| PRED-03 | With only 2 complete months available (but gate passes), weights re-scale to 56/44% | unit | `node --test 'tests/predict.test.js'` | Wave 0 |
| PRED-03 | `monthsUsed` field reflects how many complete months were actually used | unit | `node --test 'tests/predict.test.js'` | Wave 0 |
| PRED-04 | Category with exactly 3 expenses all on the same day returns `'kurang data'` | unit | `node --test 'tests/predict.test.js'` | Wave 0 |
| PRED-04 | Category with 3 expenses on 3 distinct UTC days returns a numeric estimate | unit | `node --test 'tests/predict.test.js'` | Wave 0 |
| All | No Anthropic API calls made during any test | unit (spy) | `node --test 'tests/predict.test.js'` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test 'tests/predict.test.js'`
- **Per wave merge:** `node --test 'tests/*.test.js'`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/predict.test.js` — covers all PRED-02, PRED-03, PRED-04 behaviors listed above
- [ ] `predict.js` — the module under test (must exist before tests run)

*(No framework or config gaps — Node:test is built-in and package.json glob already covers `tests/*.test.js`)*

## Sources

### Primary (HIGH confidence)

- Project codebase: `summary.js` — UTC bucketing patterns, `_buildBreakdown`, `clientOverride` parameter position, module export style
- Project codebase: `tests/summary.test.js`, `tests/budget.test.js` — `tmpDataDir` isolation, ISO 8601 UTC fixture timestamps, Node:test describe/it/beforeEach/afterEach structure
- Project codebase: `storage.js` — `readExpenses` contract: returns `[]` for missing file, array in append order, expense shape `{ amount, category, description, timestamp }`
- `.planning/phases/04-prediction-engine/04-CONTEXT.md` — All locked algorithmic decisions: gate formula, weights, sparsity threshold, return shape

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — PRED-02, PRED-03, PRED-04 requirement text, used to cross-check CONTEXT.md decisions
- `.planning/ROADMAP.md` — Phase 5 interface contract expectations (`sufficient`, `monthsUsed`, `categories` shape)
- `.planning/STATE.md` — Confirmed decisions: clientOverride pattern, CommonJS throughout, Node 24, no new deps for v1.1

### Tertiary (LOW confidence)

- None — all research is grounded in existing project code and locked CONTEXT.md decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; same Node:test + built-ins used in all 6 existing test files
- Architecture: HIGH — direct template exists in `summary.js`; all decisions locked in CONTEXT.md
- Pitfalls: HIGH — derived from reading the actual CONTEXT.md decisions and existing test patterns; no speculation

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (stable — pure-JS, no external dependencies, no APIs to change)
