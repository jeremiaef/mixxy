# Architecture Research

**Domain:** Node.js Telegram bot with Claude AI — v1.1 Behavioral Intelligence milestone
**Researched:** 2026-03-18
**Confidence:** HIGH (based on direct code inspection of the existing codebase)

---

## Context: What Already Exists

This is a subsequent milestone research update. The v1.0 architecture is fully built and verified. The existing module boundaries are:

| Module | Role | Key exports |
|--------|------|-------------|
| `index.js` | Bot entry, command routing, cron | `dedupCheck`, `formatAmount` |
| `claude.js` | Anthropic SDK calls, tool_use for intent/expense parsing | `processMessage(userId, text)` |
| `storage.js` | Per-user JSON read/write with mutex | `readExpenses`, `appendExpense`, `popExpense`, `readMeta`, `writeMeta` |
| `prompts.js` | System prompt + tool schemas as named exports | `SYSTEM_PROMPT`, `EXPENSE_TOOL`, `REKAP_TOOL` |
| `summary.js` | Multi-month aggregation + Claude narrative | `buildMonthlySummary`, `buildWeeklySummary` |
| `budget.js` | Threshold detection + progress formatting | `checkBudgetAlert`, `formatBudgetProgress` |

**Actual storage schema** (from code inspection):

`data/{userId}.json` — flat array of expense objects:
```json
[
  { "amount": 35000, "category": "makan", "description": "makan siang", "timestamp": "2026-03-17T05:30:00.000Z" }
]
```

`data/{userId}_meta.json` — settings/metadata:
```json
{ "budget": 500000, "budgets": { "makan": 200000, "transport": 100000 } }
```

The timestamp field on every expense is an ISO 8601 string. This is the key data source for `/prediksi`.

---

## System Overview: After v1.1

```
┌──────────────────────────────────────────────────────────────────┐
│                       External Services                           │
│  ┌──────────────────────┐    ┌──────────────────────────────┐    │
│  │   Telegram Servers    │    │   Anthropic Claude API        │    │
│  │  (Bot API / polling)  │    │  (claude-haiku-4-5)           │    │
│  └──────────┬───────────┘    └────────────────┬─────────────┘    │
└─────────────┼──────────────────────────────────┼─────────────────┘
              │                                  │
              ▼                                  │
┌──────────────────────────────────────────────────────────────────┐
│                    index.js — Entry & Routing                     │
│  /start /help /rekap /hapus /budget  ← static command guards     │
│  /prediksi  ← NEW static guard (no Claude NLP needed here)       │
│  free text  ← passes to processMessage() in claude.js            │
└───────┬─────────────────┬───────────────────────────────────────┘
        │                 │
        ▼                 ▼
┌──────────────┐   ┌─────────────────────────────────────────────┐
│  storage.js  │   │              claude.js                       │
│              │   │  processMessage(userId, text)                │
│  readExpenses│◄──│  — existing tool_use for expense/intent      │
│  appendExpense    │                                             │
│  popExpense  │   └─────────────────────────────────────────────┘
│  readMeta    │
│  writeMeta   │   ┌─────────────────────────────────────────────┐
└──────┬───────┘   │              summary.js                      │
       │           │  buildMonthlySummary / buildWeeklySummary    │
       │           │  — Claude text call for narrative insight     │
       │           └─────────────────────────────────────────────┘
       │
       │           ┌─────────────────────────────────────────────┐
       └──────────►│          predict.js  (NEW)                   │
                   │  buildPrediction(userId, clientOverride)     │
                   │  — reads ALL historical expenses             │
                   │  — computes per-category stats               │
                   │  — classifies fixed/variable (Claude)        │
                   │  — returns formatted prediction string       │
                   └─────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              prompts.js  (MODIFIED)                               │
│  + PREDICT_TOOL — tool schema for fixed/variable classification   │
└──────────────────────────────────────────────────────────────────┘
```

---

## New Component: predict.js

### Responsibility

`predict.js` owns everything needed to answer: "Based on what you've spent so far, what will next month look like?"

It does NOT:
- Route commands (that stays in `index.js`)
- Write to storage (read-only consumer of `storage.js`)
- Know about Telegram (returns a plain string)

It DOES:
- Aggregate historical expenses by category across calendar months
- Compute per-category projected spend for next month
- Call Claude to classify each category as fixed or variable
- Build a savings target suggestion from variable category variance
- Return a formatted Bahasa Indonesia string ready to send

### Module signature

```javascript
// predict.js
async function buildPrediction(userId, clientOverride) { ... }

module.exports = { buildPrediction };
```

Mirrors `summary.js` structure: takes `userId`, returns a `string`. Accepts `clientOverride` for testability.

---

## Data Flow: /prediksi Command

```
User types: "/prediksi"
    |
    v
index.js: static command guard matches /prediksi
    |
    v
predict.js: buildPrediction(userId)
    |
    v
storage.js: readExpenses(userId)  --> full expense array (all time)
    |
    v
predict.js: groupByMonth(expenses)
  -- produces: { "2026-02": { makan: 450000, transport: 120000, ... }, "2026-01": { ... } }
    |
    v
predict.js: computePerCategoryProjection(monthlyBreakdowns)
  -- for each category: compute weighted average or last-N-months average
  -- also compute variance for variable category detection
    |
    v
predict.js: classifyCategories(categoryNames, categoryStats) via Claude tool_use
  -- Claude receives: list of categories + their avg/variance
  -- returns: { makan: "variable", kost: "fixed", transport: "variable", ... }
    |
    v
predict.js: computeSavingsTarget(variableCategories, varianceData)
  -- sum of discretionary (variable) categories
  -- suggest 10-15% reduction where variance is high
    |
    v
predict.js: formatPredictionMessage(projections, classifications, savingsTarget)
  -- builds the Bahasa Indonesia reply string
    |
    v
index.js: bot.sendMessage(chatId, predictionText)
    |
    v
User sees formatted prediction
```

---

## Claude's Role in predict.js: Fixed/Variable Classification

**Decision: Claude does the fixed/variable classification via tool_use.**

Rationale:
- "kost" is semantically always fixed; "jajan" is semantically always variable — this is category-level knowledge that requires understanding Indonesian context
- A hardcoded map (`fixed = ['kost', 'tagihan']`, `variable = [...]`) would be brittle and miss edge cases
- Claude already handles Bahasa Indonesia categories in `prompts.js` — extending that knowledge to classification is natural
- tool_use guarantees a structured `{ category: "fixed"|"variable" }` response without regex parsing

**Claude is NOT used for:**
- Number crunching (computing averages, variance — pure JS)
- Data retrieval (reading expenses — `storage.js`)
- Formatting the final message (can be hardcoded template strings)

The Claude call is a single focused classification call, not a narrative generation call. This keeps token usage low and the output deterministic.

### PREDICT_CLASSIFY_TOOL (to add to prompts.js)

```javascript
const PREDICT_CLASSIFY_TOOL = {
  name: 'classify_categories',
  description: 'Classify each spending category as fixed or variable for the purpose of spending prediction.',
  input_schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            type: { type: 'string', enum: ['fixed', 'variable'] }
          },
          required: ['category', 'type']
        }
      }
    },
    required: ['classifications']
  }
};
```

---

## Modified Component: index.js

A single new command guard must be added before the Claude NLP fallthrough:

```javascript
if (text === '/prediksi' || text.startsWith('/prediksi@')) {
  // Guard: require >= 30 days of data
  const prediction = await buildPrediction(userId);
  await bot.sendMessage(chatId, prediction);
  return;
}
```

Also requires:
- `require('./predict')` import added at top
- `/prediksi` added to the `HELP_MESSAGE` constant

The 30-day minimum history guard lives inside `predict.js`, not `index.js`. If insufficient data, `buildPrediction` returns a user-facing error string in Bahasa Indonesia — `index.js` just sends whatever string comes back.

---

## Modified Component: prompts.js

Add `PREDICT_CLASSIFY_TOOL` export (see schema above).

No changes to `SYSTEM_PROMPT` — the prediction command is handled outside the Claude NLP path.

---

## Component Responsibilities (Complete Picture)

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `index.js` | Bot lifecycle, command routing, cron | storage.js, claude.js, summary.js, budget.js, predict.js |
| `claude.js` | Expense parsing + intent detection via tool_use | prompts.js, Anthropic API |
| `storage.js` | Per-user JSON I/O with mutex/atomic writes | File system |
| `prompts.js` | All prompt strings and tool schemas (pure data) | Nothing |
| `summary.js` | Historical aggregation + Claude narrative insight | storage.js, Anthropic API |
| `budget.js` | Threshold detection + budget progress formatting | storage.js |
| `predict.js` (NEW) | Future spend projection + fixed/variable classification | storage.js, prompts.js, Anthropic API |

**Critical boundary maintained:** `predict.js` never writes to storage. It reads expenses and returns a string. Same contract as `summary.js`.

---

## Architectural Patterns

### Pattern 1: Read-Only Compute Modules (summary.js and predict.js)

**What:** Modules that read from storage, perform computation, optionally call Claude, and return a formatted string. They never write to storage, never interact with Telegram directly.

**When to use:** Any feature that computes a view over stored data — summaries, predictions, reports.

**Trade-offs:** Simple contract (string in, string out), easy to test with mock data. The only cost is that index.js must wire them.

**Example (predict.js mirrors summary.js structure):**
```javascript
async function buildPrediction(userId, clientOverride) {
  const expenses = await storage.readExpenses(userId);
  if (!hasSufficientHistory(expenses)) {
    return 'Data belum cukup untuk prediksi. Butuh minimal 30 hari riwayat pengeluaran.';
  }
  const monthlyBreakdowns = groupByMonth(expenses);
  const projections = computeProjections(monthlyBreakdowns);
  const classifications = await classifyWithClaude(projections, clientOverride);
  const savings = computeSavingsTarget(projections, classifications);
  return formatPrediction(projections, classifications, savings);
}
```

### Pattern 2: Claude tool_use for Structured Classification

**What:** Pass structured data (category names + statistics) to Claude via a tool schema. Receive typed output without parsing.

**When to use:** Any time Claude needs to make a categorical judgment about structured data — classification, labeling, scoring.

**Trade-offs:** Reliable schema enforcement. Slightly more setup than a prompt string. Never breaks on free-text variance.

**Example:**
```javascript
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 256,
  tools: [PREDICT_CLASSIFY_TOOL],
  tool_choice: { type: 'required' },  // force tool use
  messages: [{
    role: 'user',
    content: `Klasifikasikan kategori pengeluaran berikut: ${JSON.stringify(categorySummary)}`
  }]
});
const toolBlock = response.content.find(b => b.type === 'tool_use');
return toolBlock.input.classifications;
```

Note `tool_choice: { type: 'required' }` — forces Claude to use the tool rather than optionally using it, ensuring structured output every time.

### Pattern 3: Computation Outside Claude

**What:** All arithmetic (averages, variance, projections) is done in JavaScript before the Claude call. Claude only receives pre-computed stats and does semantic reasoning on them.

**When to use:** Any prediction or aggregation feature. Claude is expensive per token — don't waste tokens on math Claude doesn't need to do.

**Trade-offs:** More JS code to write and test; but the math is deterministic and unit-testable without API calls.

---

## Data Flow: Internal Aggregation Logic in predict.js

```
readExpenses(userId) → flat array of { amount, category, timestamp }
    |
    v
groupByMonth(expenses)
  → Map<"YYYY-MM", Map<category, totalAmount>>
    |
    v
filterCompleteMonths(monthlyMap)
  → drop current partial month from projection input
  → require >= 1 complete month (ideally >= 2 for trend)
    |
    v
computeProjections(completeMonths)
  → for each category: average across available months
  → also: stdDev per category (variance signal for savings suggestion)
    |
    v
Claude classifyCategories(categoryStats)
  → { makan: "variable", kost: "fixed", transport: "variable", ... }
    |
    v
computeSavingsTarget(variableProjections, stdDevByCategory)
  → identify high-variance variable categories
  → suggest X% reduction (conservative: 10-15% of variable total)
    |
    v
formatPrediction(projections, classifications, savingsTarget)
  → Bahasa Indonesia string, same style as buildMonthlySummary output
```

### History Window Decision

Use all available complete months, up to a practical limit (e.g., last 6 months). Beyond 6 months, older data is less predictive of current habits. This is a constant in `predict.js`:

```javascript
const MAX_HISTORY_MONTHS = 6;
const MIN_HISTORY_DAYS = 30;
```

---

## Build Order for v1.1

```
prompts.js  ← add PREDICT_CLASSIFY_TOOL export
    |
    v
predict.js  ← new module; depends on storage.js + prompts.js
    |
    v
index.js    ← add /prediksi guard + require('./predict') + update HELP_MESSAGE
```

**Rationale:**
1. `prompts.js` first — `predict.js` imports the classify tool schema from it; no logic change, just a new export
2. `predict.js` second — can be fully built and tested in isolation using mock expense arrays and a clientOverride for the Claude call; does not require `index.js` changes to test
3. `index.js` last — a three-line addition (guard + import + help text); integration test can be done manually via Telegram

**No changes needed to:** `claude.js`, `storage.js`, `budget.js`, `summary.js`

---

## Integration Points

### New Module Boundary

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `index.js` → `predict.js` | Direct function call, `await buildPrediction(userId)` | Returns string or error string — index.js always calls bot.sendMessage with the result |
| `predict.js` → `storage.js` | `readExpenses(userId)` only — read-only | No mutex needed (reads don't need exclusive access) |
| `predict.js` → `prompts.js` | Import `PREDICT_CLASSIFY_TOOL` constant | Same import pattern as claude.js imports EXPENSE_TOOL |
| `predict.js` → Anthropic API | Via `@anthropic-ai/sdk` directly, same as summary.js | Module-level `defaultClient = new Anthropic()`, accepts `clientOverride` for tests |

### No Changes to These Boundaries

- `claude.js` ↔ `prompts.js` — unchanged
- `claude.js` ↔ `index.js` — unchanged, NLP path unaffected
- `storage.js` ↔ all modules — unchanged, no new storage schema needed

---

## Anti-Patterns

### Anti-Pattern 1: Routing /prediksi Through Claude NLP

**What people do:** Let the free-text handler detect "/prediksi" intent via Claude, add a `predict_intent` tool to `claude.js`.

**Why it's wrong:** `/prediksi` is an explicit command — it always means the same thing. Running it through Claude NLP adds latency and token cost for zero benefit. The existing pattern in `index.js` already handles this correctly (static guards before NLP).

**Do this instead:** Add a static command guard in `index.js` before the `processMessage(userId, text)` call. Mirror how `/rekap` is handled.

### Anti-Pattern 2: Claude Does the Arithmetic

**What people do:** Pass raw expense arrays to Claude and ask it to compute averages and projections.

**Why it's wrong:** Token cost, no determinism guarantee on arithmetic, hard to test. Claude's strength here is semantic category classification, not number crunching.

**Do this instead:** Compute all aggregates (averages, variance, per-category totals) in JavaScript. Pass only the pre-computed summary to Claude for the classification call.

### Anti-Pattern 3: Hardcoded Fixed/Variable Map

**What people do:** `const FIXED_CATEGORIES = ['kost', 'tagihan', 'pulsa']` — a static lookup table.

**Why it's wrong:** Misses context. "tagihan" could be a variable utility bill in one user's context, or a fixed subscription in another. More importantly, it can't adapt as categories evolve. Claude already understands Indonesian spending semantics.

**Do this instead:** Use Claude's `classify_categories` tool_use call with `tool_choice: required`. If the call fails, fall back gracefully (treat all as variable — conservative prediction).

### Anti-Pattern 4: Storing Prediction Results

**What people do:** Persist the prediction output to `_meta.json` and serve cached results.

**Why it's wrong:** Predictions are stale immediately after new expenses are logged. For this user count and data size, recomputing on every `/prediksi` call is fast (< 100ms JS + ~500ms Claude). Caching adds complexity with no real benefit.

**Do this instead:** Compute fresh on every `/prediksi` invocation.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-100 users | Current design: `predict.js` with synchronous per-user compute on demand. No changes. |
| 100-1000 users | Add `p-limit` if a cron-based prediction prefetch is ever added. No other changes. |
| 1000+ users | JSON file reads per `/prediksi` call become the bottleneck. Migrate to SQLite with indexed timestamp queries. `predict.js` interface stays the same — only `storage.js` changes. |

**First bottleneck for predict.js specifically:** Reading the full expense array for users with years of data. A user with 1000+ entries still loads < 100KB of JSON — negligible. This is not a concern for the current user count.

---

## Sources

- Direct code inspection: `index.js`, `claude.js`, `storage.js`, `prompts.js`, `summary.js`, `budget.js` (2026-03-18)
- `.planning/PROJECT.md` — v1.1 milestone requirements
- Existing `ARCHITECTURE.md` v1.0 — base architecture patterns preserved
- Anthropic tool_use documentation pattern (HIGH confidence — same pattern used in `claude.js` and `summary.js` already)

**Confidence notes:**
- Integration points and module boundaries: HIGH (based on code inspection, not assumptions)
- Claude tool_use for classification: HIGH (already proven in codebase via `log_expense` and `report_intent` tools)
- Projection algorithm (averaging vs weighted vs trend): MEDIUM (adequate for MVP; actual choice is an implementation detail that doesn't affect architecture)
- `tool_choice: required` enforcement: HIGH (documented Anthropic API feature, appropriate here where we need guaranteed structured output)

---
*Architecture research for: Mixxy v1.1 — /prediksi behavioral intelligence integration*
*Researched: 2026-03-18*
