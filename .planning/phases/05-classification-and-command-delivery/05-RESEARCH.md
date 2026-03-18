# Phase 5: Classification and Command Delivery - Research

**Researched:** 2026-03-18
**Domain:** Claude tool_use classification, Telegram command wiring, IDR message formatting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Output format**
- One line per category in a list format: emoji + name + label (tetap/variabel) + amount
- Amount formatted with `~Rp` prefix and IDR shorthand (rb/jt) — hedged with `~` tilde
- Header: `Prediksi bulan depan (berdasarkan N bulan terakhir):` — hedging appears once in header, not per row
- Total summary line at the bottom: `Total kira-kira: ~Rp X`
- Categories with `'kurang data'` still appear in the list, showing "kurang data" instead of an amount
- All categories from `buildPrediction()` output are shown — no hiding

**Savings suggestion**
- Appears as a footer paragraph after the total line — separated by a blank line
- Covers exactly one category: the variable category with the highest spending variance
- Quotes JS-computed figures: minimum spend month, average, and savings headroom (avg - min)
  - Format: `"bisa se-rendah Xrb, rata-rata Yrb, ada ruang ~Zrb buat dihemat"`
- If no variable category has sufficient data for variance computation, skip the savings footer entirely — show list + total only

**Insufficient data message**
- Friendly + encouraging tone — fits the casual friend persona, not a roast
- Shows how many days the user has been logging so they can see progress toward the 30-day gate
- Template: `"Data kamu baru X hari — butuh minimal 30 hari buat prediksi yang akurat. Terus catat ya!"`
- Compute days-logged from `expenses[0].timestamp` to now (same data `buildPrediction` already reads)

**`/help` update**
- Add `/prediksi` to the `HELP_MESSAGE` string in `index.js` alongside existing commands
- Short Bahasa Indonesia description consistent with existing help lines

### Claude's Discretion
- Emoji selection per category (consistent with bot's existing emoji usage in existing commands)
- Exact variance formula for determining "highest variance" category (standard deviation or max-min range — both valid)
- Tool schema design for `PREDICT_CLASSIFY_TOOL`
- Whether classification is one batch call for all categories or sequential

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRED-01 | User can request next-month spend prediction via /prediksi command | Command guard pattern in index.js; buildPrediction() already implemented in predict.js |
| PRED-05 | Each category in the prediction is labeled as fixed (tetap) or variable (variabel) via Claude classification | PREDICT_CLASSIFY_TOOL in prompts.js using tool_choice: required; classifyPrediction() in predict.js |
| PRED-06 | Prediction includes a savings headroom suggestion for the highest-variance variable category, grounded in JS-computed variance | Variance computed in JS over per-month category totals from windows already fetched; Claude receives pre-computed min/avg/headroom numbers |
| PRED-07 | All prediction output uses hedged language ("kira-kira", "sekitar", "berdasarkan X bulan terakhir") and shows how many months of data were used | monthsUsed field already returned by buildPrediction(); header and format locked in CONTEXT.md |
</phase_requirements>

---

## Summary

Phase 5 is an integration and formatting layer. The computation engine (predict.js) and the Claude call infrastructure (claude.js pattern) are already built. This phase wires them together: call `buildPrediction()`, add a Claude classification step via a new `PREDICT_CLASSIFY_TOOL`, compute variance-based savings headroom in JS, format the result using the approved output template, and expose the whole pipeline via a `/prediksi` command guard in `index.js`.

The phase has three new code artifacts: (1) `PREDICT_CLASSIFY_TOOL` constant added to `prompts.js`, (2) a `classifyPrediction()` function added to `predict.js` (accepts `clientOverride` for testability), and (3) the `/prediksi` command guard added to `index.js`. The `HELP_MESSAGE` string in `index.js` also gains one line.

No new npm dependencies are needed. All test infrastructure already exists — `node:test` + `assert/strict`, `DATA_DIR` isolation, `clientOverride` spy pattern. The test file for this phase is `tests/predict.test.js` extended with Phase 5 test blocks (or a new `tests/prediksi.test.js` — either is acceptable; extending predict.test.js keeps related logic together).

**Primary recommendation:** Build `classifyPrediction(categories, clientOverride)` in predict.js. It calls Claude once with all numeric categories as a single batch (not sequentially). It returns `{ classifications: { cat: 'tetap' | 'variabel' }, varianceData: { cat: { min, avg, headroom } } }`. The variance computation and savings selection are pure JS inside `classifyPrediction` — Claude only sees category names + numeric estimates + optional contextual hint, and returns only fixed/variable labels.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.79.0 (installed) | Claude API — tool_use call for classification | Already the project's Claude client; no new dep |
| node:test | built-in (Node 24) | Unit tests | Established test framework across all existing tests |
| node:assert/strict | built-in (Node 24) | Assertions | Established pattern across all existing tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-file-atomic | 7.0.1 (installed) | Storage writes | Not needed in Phase 5 (read-only) |
| node-telegram-bot-api | 0.67.0 (installed) | Telegram command routing | Already used in index.js for all commands |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single batch Claude call | Per-category sequential calls | Batch is cheaper (one API call), faster, and simpler to test; sequential only needed if per-call context must differ |
| tool_choice: required | tool_choice: auto | `required` guarantees structured JSON; `auto` risks a text reply slipping through — established decision in roadmap |

**Installation:**
No new packages needed. All dependencies already installed.

**Version verification:**
- `@anthropic-ai/sdk`: 0.79.0 (installed and confirmed via `node_modules/@anthropic-ai/sdk/package.json`)
- `node --test` runner: available in Node 24 (confirmed — 88 tests passing)

---

## Architecture Patterns

### Files Modified or Created in Phase 5
```
prompts.js          — add PREDICT_CLASSIFY_TOOL constant + export it
predict.js          — add classifyPrediction() function + export it
index.js            — add /prediksi command guard; update HELP_MESSAGE
tests/predict.test.js   — extend with PRED-01/PRED-05/PRED-06/PRED-07 test blocks
```

No new files. No new npm dependencies.

### Pattern 1: PREDICT_CLASSIFY_TOOL in prompts.js

**What:** A tool schema that accepts an array of category objects (name + estimated amount or 'kurang data') and returns a classification map.

**When to use:** Called once per `/prediksi` invocation with all categories together in one batch.

```javascript
// Source: established pattern from EXPENSE_TOOL and REKAP_TOOL in prompts.js
const PREDICT_CLASSIFY_TOOL = {
  name: 'classify_categories',
  description: 'Classify each expense category as fixed (tetap) or variable (variabel). Fixed = predictable, consistent month-to-month (e.g. rent, subscriptions). Variable = fluctuates with behavior (e.g. food, entertainment).',
  input_schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'object',
        description: 'Map of category name to label. Every category in the input must appear here.',
        additionalProperties: {
          type: 'string',
          enum: ['tetap', 'variabel']
        }
      }
    },
    required: ['classifications']
  }
};
```

**Tool call pattern (matching claude.js `processMessage`):**
```javascript
// Source: claude.js lines 8-17, with tool_choice: required per roadmap decision
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 256,
  tools: [PREDICT_CLASSIFY_TOOL],
  tool_choice: { type: 'tool', name: 'classify_categories' },
  messages: [{
    role: 'user',
    content: `Klasifikasikan kategori berikut sebagai tetap atau variabel:\n${categoryList}`
  }]
});
const block = response.content.find(b => b.type === 'tool_use' && b.name === 'classify_categories');
const classifications = block.input.classifications;
```

Note: `tool_choice: { type: 'tool', name: 'classify_categories' }` forces Claude to always call the tool — guarantees structured output, no text fallback possible.

### Pattern 2: classifyPrediction() function in predict.js

**What:** Pure orchestrator function. Accepts `buildPrediction()` output + raw window expenses. Calls Claude for labels, computes variance in JS, formats nothing.

**Signature:**
```javascript
/**
 * @param {string} userId
 * @param {Object|null} _options  — { now: Date } for deterministic testing
 * @param {Object|null} clientOverride — Anthropic client for test isolation
 * @returns {Promise<{
 *   sufficient: false
 * } | {
 *   sufficient: true,
 *   monthsUsed: number,
 *   categories: Object,           // from buildPrediction
 *   classifications: Object,      // { cat: 'tetap'|'variabel' }
 *   savings: null | { category, min, avg, headroom }
 * }>}
 */
async function classifyPrediction(userId, _options, clientOverride)
```

**Internal flow:**
1. Call `buildPrediction(userId, _options, clientOverride)` — if `{ sufficient: false }`, return immediately
2. Identify numeric categories (filter out `'kurang data'` entries for Claude input — `kost` may also be hardcoded tetap)
3. Call Claude once via `PREDICT_CLASSIFY_TOOL` with all numeric category names + amounts
4. Compute per-category monthly totals across active windows (re-use window data already fetched inside buildPrediction — note: classifyPrediction may need to re-fetch or buildPrediction needs to expose window data)
5. For variable categories with numeric estimates: compute variance (max-min range or std dev — discretion), pick highest-variance one
6. Return combined result shape

**Key implementation note:** `buildPrediction()` currently does not expose the per-month window totals externally. `classifyPrediction()` needs per-month amounts per category to compute variance. Two clean options:
- Option A: Read expenses inside `classifyPrediction` directly (call `storage.readExpenses` + `_selectMonthWindows` + `_filterToWindow` again) — duplication but simple
- Option B: Extend `buildPrediction()` to return an optional `_windowTotals` field for internal use — or inline the logic in `classifyPrediction` since predict.js owns both functions

Option A is recommended (simplest, no change to buildPrediction's stable interface).

### Pattern 3: /prediksi command guard in index.js

**What:** Identical structure to `/rekap` guard — intercept before Claude fallthrough, call the appropriate function, send formatted message.

```javascript
// Source: index.js lines 76-79 (/rekap guard pattern)
if (text === '/prediksi' || text.startsWith('/prediksi@')) {
  const result = await classifyPrediction(userId);
  await bot.sendMessage(chatId, formatPrediction(result));
  return;
}
```

`formatPrediction(result)` is a pure formatting function (no async, no Claude) — takes the `classifyPrediction()` result and returns a string. Keep it in `index.js` or `predict.js` (either is fine; `predict.js` is cleaner if it needs `_formatAmount`).

### Pattern 4: Variance computation for savings headroom

**What:** Pure JS — determines the "most variable" category to feature in the savings suggestion.

**Recommended approach (max-min range, simpler than std dev):**
```javascript
// For each variable category with a numeric estimate:
// Compute monthly totals across activeWindows
// variance = maxMonthlyTotal - minMonthlyTotal
// Pick the category with the highest variance
// savings headroom = avg - min
```

Where `avg` = the weighted estimate from `buildPrediction` is NOT quite right — use the arithmetic mean of the monthly totals (unweighted), since the savings suggestion is about observed spending range, not the prediction weight.

**Savings numbers to quote:**
- `min` = lowest monthly total observed across the windows
- `avg` = arithmetic mean of observed monthly totals (for variable categories with data in all windows; if missing months treat as 0 or skip — see Pitfall 3)
- `headroom` = `avg - min`

### Pattern 5: Days-logged computation for insufficient data message

```javascript
// Source: predict.js line 88-95 (same data already loaded)
const expenses = await storage.readExpenses(userId);
if (expenses.length === 0) {
  // "Data kamu baru 0 hari — butuh minimal 30 hari..."
}
const daysLogged = Math.floor((now.getTime() - new Date(expenses[0].timestamp).getTime()) / (24 * 60 * 60 * 1000));
```

This re-uses `expenses[0].timestamp` — same field that `buildPrediction` already reads for the 30-day gate.

### Anti-Patterns to Avoid

- **Letting Claude invent numbers:** Claude must receive only category names and estimated amounts. It must NOT be asked to compute min/max/variance — those come from JS.
- **Hiding 'kurang data' categories:** All categories from `buildPrediction()` appear in the output list, with "kurang data" displayed instead of an amount.
- **Calling `tool_choice: auto` for classification:** Risks a text reply — always use `{ type: 'tool', name: 'classify_categories' }`.
- **Using `index.js` formatAmount inside predict.js:** `predict.js` must not import from `index.js` (circular dep risk). Instead, define a local `_formatAmount` in predict.js or pass formatting responsibility to index.js. Pattern: budget.js has a local `_formatAmount` clone for this reason.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured output from Claude | Regex parsing of Claude text | PREDICT_CLASSIFY_TOOL with tool_choice: required | Text output is unpredictable; tool_use guarantees JSON with defined schema |
| Test isolation of Claude calls | NODE_ENV mocking, module patching | clientOverride 3rd-parameter pattern | Already established in claude.js, summary.js, budget.js — consistent and CJS-compatible |
| IDR amount formatting | New formatting utility | Reuse `_formatAmount` from index.js (via export) | Already exported as `_formatAmount`; or copy the 5-line function (as budget.js does) to avoid circular dep |
| Category emoji map | Lookup table from scratch | Inline map, consistent with existing bot emoji usage | Simple: 9 categories, static map, no library needed |

**Key insight:** Claude is a classifier here, not a calculator. Every number in the output must come from JS. Claude only assigns 'tetap' or 'variabel' labels — it never touches amounts.

---

## Common Pitfalls

### Pitfall 1: Circular import — predict.js importing from index.js
**What goes wrong:** predict.js needs `formatAmount` for formatting. Importing from index.js would create a circular dependency (index.js imports predict.js).
**Why it happens:** `formatAmount` lives in index.js and is not in a shared utility module.
**How to avoid:** Copy the 5-line `formatAmount` function directly into predict.js as a local helper (prefixed `_`). This is the same pattern budget.js uses with its `_formatAmount` clone.
**Warning signs:** `require('./index')` anywhere in predict.js is wrong.

### Pitfall 2: Claude call includes 'kurang data' categories
**What goes wrong:** Passing `{ transport: 'kurang data' }` to the classify tool causes schema validation issues (the tool expects numbers or nothing for that field) and wastes tokens.
**Why it happens:** Iterating over `categories` map without filtering.
**How to avoid:** Before building the Claude prompt, filter to `typeof value === 'number'` entries only. 'kurang data' categories default to 'variabel' or are omitted from classification — since they have no reliable data, excluding them from savings headroom computation is correct.
**Warning signs:** Tool schema rejections or Claude returning unexpected values for kurang-data keys.

### Pitfall 3: Variance computation with missing months
**What goes wrong:** A variable category has data in 2 of 3 windows. If the missing window is treated as 0, variance is inflated (0 looks like a very low-spend month).
**Why it happens:** Iterating over activeWindows and summing 0 for months with no data.
**How to avoid:** For variance/savings computation, use only months where the category has at least one expense. Use the same `distinctDays` data already computed in `_computeCategories`. A category with data in only 1 window cannot have meaningful variance — skip it for savings suggestion (need at least 2 windows with data for min vs avg).
**Warning signs:** Savings suggestion showing a category with min=0 (impossible in practice — means a month had no spend, not a low-spend month).

### Pitfall 4: kost hardcoded as fixed — must not be reclassified
**What goes wrong:** `kost` (rent) is hardcoded as `tetap` per roadmap decision (FIXED_VARIANCE_THRESHOLD = 0.15, `kost` hardcoded fixed). Passing `kost` to Claude for classification would still work correctly most of the time, but it relies on Claude agreeing with the hardcode.
**Why it happens:** Forgetting the roadmap decision.
**How to avoid:** Before calling Claude, pre-populate `classifications.kost = 'tetap'` and exclude `kost` from the Claude call. This also saves tokens.
**Warning signs:** `kost` labeled as 'variabel' in output.

### Pitfall 5: HELP_MESSAGE test in bot.test.js must be updated
**What goes wrong:** `tests/bot.test.js` line 52-60 tests that HELP_MESSAGE "contains all 5 commands" (`/rekap`, `/budget`, `/hapus`, `/start`, `/help`). After adding `/prediksi`, the test name/count becomes stale but won't fail (it only checks for those 5).
**Why it happens:** The test checks for specific commands by inclusion, not exact count.
**How to avoid:** Add an assertion for `/prediksi` to the HELP_MESSAGE test when updating HELP_MESSAGE.
**Warning signs:** test still passes but doesn't verify the new entry.

### Pitfall 6: formatAmount tilde prefix for hedged amounts
**What goes wrong:** The approved output uses `~Rp 450rb` (tilde then Rp then amount). The existing `_formatAmount(450000)` returns `'450rb'` — caller must prepend `~Rp `.
**Why it happens:** Forgetting to add the tilde prefix, or double-adding it.
**How to avoid:** In the formatting function, always construct `~Rp ${_formatAmount(amount)}` for predicted amounts. The total line uses `~Rp X` as well. The savings line uses `Xrb` without the `~Rp` prefix (per the approved format: "bisa se-rendah 280rb, rata-ratanya 450rb").

---

## Code Examples

### Tool_choice: required — forcing a specific tool call
```javascript
// Source: Roadmap §v1.1 + pattern established in claude.js
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 256,
  tools: [PREDICT_CLASSIFY_TOOL],
  tool_choice: { type: 'tool', name: 'classify_categories' },
  messages: [{ role: 'user', content: prompt }]
});
const block = response.content.find(b => b.type === 'tool_use' && b.name === 'classify_categories');
// block.input.classifications is { cat: 'tetap'|'variabel', ... }
```

### clientOverride spy in test (established pattern)
```javascript
// Source: tests/predict.test.js lines 278-285
let called = false;
const spyClient = {
  messages: { create: async (params) => {
    called = true;
    // Return a synthetic classifications response
    return {
      content: [{
        type: 'tool_use',
        name: 'classify_categories',
        input: { classifications: { makan: 'variabel', kost: 'tetap' } }
      }]
    };
  }}
};
const result = await classifyPrediction(userId, { now: NOW }, spyClient);
assert.equal(called, true);
assert.equal(result.classifications.makan, 'variabel');
```

### formatAmount local clone pattern (from budget.js)
```javascript
// budget.js defines its own copy to avoid circular dep with index.js
function _formatAmount(amount) {
  if (amount >= 1000000) {
    const jt = amount / 1000000;
    return Number.isInteger(jt) ? jt + 'jt' : jt.toFixed(1) + 'jt';
  }
  return (amount / 1000) + 'rb';
}
```

### Days-logged computation
```javascript
// Source: predict.js history gate pattern (lines 93-96)
const daysLogged = Math.floor(
  (now.getTime() - new Date(expenses[0].timestamp).getTime()) / (24 * 60 * 60 * 1000)
);
```

### Approved output assembly (confirmed format)
```
Prediksi bulan depan (berdasarkan 3 bulan terakhir):

🍜 makan — variabel — ~Rp 450rb
🚗 transport — variabel — ~Rp 180rb
🏠 kost — tetap — ~Rp 1.5jt
📱 pulsa — tetap — ~Rp 80rb

Total kira-kira: ~Rp 2.2jt

Kalau mau hemat, coba kurangin makan — bulan lalu bisa se-rendah 280rb, rata-ratanya 450rb. Ada ruang ~170rb buat dihemat.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tool_choice: auto | tool_choice: { type: 'tool', name: '...' } | v1.1 roadmap decision | Guarantees structured tool output, no text fallback risk |
| Per-call Claude classification | Single batch classification call | Phase 5 design | One API call for all categories — cheaper, simpler |

**Deprecated/outdated:**
- Sequential tool calls per category: not needed; batch is fine because all categories are classified with the same static domain knowledge.

---

## Open Questions

1. **Where to put formatPrediction()?**
   - What we know: it needs `_formatAmount`, `classifications`, `categories`, `monthsUsed`, `savings`
   - What's unclear: whether to put it in `predict.js` (alongside classifyPrediction) or `index.js` (alongside other message formatting)
   - Recommendation: put it in `predict.js` as `_formatPrediction()` — it depends on predict.js data shapes and can use a local `_formatAmount` clone. index.js only calls `classifyPrediction` + sends the string.

2. **Whether 'kurang data' categories should default to 'variabel' or omit classification**
   - What we know: they appear in output as "kurang data" not as an amount; no classification label is in the approved output sample for kurang data entries
   - What's unclear: the approved format sample does not show a kurang data row — check if it should show "kurang data" with no tetap/variabel label, or with one
   - Recommendation: Show the row without a tetap/variabel label — e.g., `❓ tagihan — kurang data`. This avoids classifying something with no data.

3. **Savings headroom: which 'avg' to use?**
   - What we know: the savings line says "rata-ratanya Yrb" — this should be the arithmetic mean of observed monthly totals, not the weighted prediction
   - What's unclear: edge case where a variable category appears in all 3 windows vs 2 windows
   - Recommendation: Use arithmetic mean of windows where the category has non-zero spend. Exclude zero-spend windows from variance computation.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node:test (built-in) + assert/strict |
| Config file | none — invoked via `node --test 'tests/*.test.js'` |
| Quick run command | `node --test 'tests/predict.test.js'` |
| Full suite command | `node --test 'tests/*.test.js'` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRED-01 | `/prediksi` command routes to classifyPrediction, returns formatted string | integration (index.js export) | `node --test 'tests/bot.test.js'` | ✅ (extend) |
| PRED-05 | Each numeric category receives 'tetap' or 'variabel' label from Claude tool call | unit | `node --test 'tests/predict.test.js'` | ✅ (extend) |
| PRED-06 | Savings footer names highest-variance variable category with JS-computed min/avg/headroom | unit | `node --test 'tests/predict.test.js'` | ✅ (extend) |
| PRED-07 | Output contains hedged header with monthsUsed; insufficient data message shows days logged | unit | `node --test 'tests/predict.test.js'` | ✅ (extend) |
| PRED-01 (help) | HELP_MESSAGE contains '/prediksi' | unit | `node --test 'tests/bot.test.js'` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `node --test 'tests/predict.test.js'`
- **Per wave merge:** `node --test 'tests/*.test.js'`
- **Phase gate:** Full suite (88+ tests) green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new test files needed; extend `tests/predict.test.js` for PRED-05/PRED-06/PRED-07 and `tests/bot.test.js` for PRED-01 + HELP_MESSAGE assertion.

---

## Sources

### Primary (HIGH confidence)
- `/workspaces/mixxy/predict.js` — Phase 4 interface contract; `buildPrediction()` signature and return shape verified directly
- `/workspaces/mixxy/claude.js` — `processMessage` pattern; tool_use response parsing verified directly
- `/workspaces/mixxy/prompts.js` — `EXPENSE_TOOL` and `REKAP_TOOL` schema patterns verified directly
- `/workspaces/mixxy/index.js` — command guard patterns, `HELP_MESSAGE`, `formatAmount` export verified directly
- `/workspaces/mixxy/summary.js` — `generateInsight` pattern (Claude call with pre-computed data) verified directly
- `/workspaces/mixxy/budget.js` — local `_formatAmount` clone pattern verified directly
- `/workspaces/mixxy/tests/predict.test.js` — `clientOverride` spy pattern, DATA_DIR isolation verified directly
- `/workspaces/mixxy/.planning/phases/05-classification-and-command-delivery/05-CONTEXT.md` — locked output format, savings template, insufficient data template
- `/workspaces/mixxy/.planning/STATE.md` — `FIXED_VARIANCE_THRESHOLD = 0.15`, `kost` hardcoded fixed, `tool_choice: required` decisions
- `@anthropic-ai/sdk` version 0.79.0 — confirmed installed; `tool_choice: { type: 'tool', name: '...' }` API structure confirmed

### Secondary (MEDIUM confidence)
- npm registry: `@anthropic-ai/sdk` latest is 0.79.0 (confirmed via npm view)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed and in use; no new packages
- Architecture: HIGH — patterns verified directly from source files; no speculation
- Pitfalls: HIGH — derived from direct code inspection (circular dep, kurang data filtering, kost hardcode) and existing patterns (budget.js _formatAmount clone)

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (stable — no fast-moving dependencies)
