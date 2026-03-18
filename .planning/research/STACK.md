# Stack Research

**Domain:** Telegram bot (Node.js) with Claude AI integration and local JSON storage
**Researched:** 2026-03-18 (updated for v1.1 Behavioral Intelligence milestone)
**Confidence:** HIGH for "no new deps needed" verdict. MEDIUM for simple-statistics version (npm confirmed 7.8.x, exact patch TBD).

---

## v1.1 Stack Assessment: What Changes?

**Short answer: nothing must change. The /prediksi feature can be built with pure Node.js + Claude.**

The existing stack already contains everything needed:

| Capability needed | Already available |
|-------------------|-------------------|
| Date arithmetic (filter by month, get N months ago) | Native `Date` + UTC methods — same pattern as `_filterCurrentMonth()` in `summary.js` |
| Aggregate spend by category per month | Pure JS `Array.reduce` + `Map` — same pattern as `_buildBreakdown()` in `summary.js` |
| Fixed vs variable classification | Claude Haiku via `claude.js` — structured tool call with category list input |
| Prediction narrative + savings suggestion | Claude Haiku via `claude.js` — structured text generation with computed data |
| Rate limiting / mutex for concurrent reads | `async-mutex` already installed |

The codebase already demonstrates the correct pattern: compute aggregates in pure JS, send the result to Claude for interpretation. There is no gap that requires a new dependency.

---

## Recommended Stack

### Core Technologies (unchanged from v1.0)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20 or 22 LTS | Runtime | v22 preferred (active LTS). Native `Date` UTC methods cover all date math needed for prediction. |
| @anthropic-ai/sdk | ^0.79.0 (installed) | Claude API client | Handles fixed/variable classification and prediction narrative generation as structured tool calls. |
| node-telegram-bot-api | ^0.67.0 (installed) | Telegram integration | No change needed for /prediksi — same command registration pattern as /rekap and /budget. |
| async-mutex | ^0.5.0 (installed) | Concurrent write safety | No change — storage.js already uses this correctly. |

### Supporting Libraries (unchanged from v1.0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-file-atomic | ^7.0.1 (installed) | Safe JSON writes | No change for /prediksi — read-only access to expense history. |
| node-cron | ^4.2.1 (installed) | Weekly digest scheduling | No change needed. |
| dotenv | ^17.3.1 (installed) | Env variable loading | No change. |

### New Libraries for v1.1

**None required.**

The single candidate worth evaluating was `simple-statistics` (v7.8.x, 320K weekly downloads, no dependencies). It provides `linearRegression`, `mean`, `standardDeviation`. However:

- The prediction method best suited to 1–3 months of sparse data is **category-level monthly average with simple growth factor** — not linear regression. Linear regression on 2–3 data points overfits and produces misleading slopes.
- `mean([a, b, c])` is `(a + b + c) / 3` — no library needed.
- Standard deviation for "variable" variance detection is 3 lines of pure JS.
- Adding `simple-statistics` adds a dependency with no functional gain over the patterns already in `summary.js`.

---

## Installation

```bash
# No new packages needed for v1.1
# All required capabilities are covered by the existing stack
```

---

## Architecture of /prediksi (Pure JS + Claude)

The correct implementation splits computation from interpretation:

**Step 1 — Pure JS: aggregate historical data**

```js
// Compute per-category monthly totals for the past N months
// Same UTC date pattern as _filterCurrentMonth() in summary.js
function getMonthlyTotalsByCategory(expenses, monthsBack = 3) {
  const buckets = {}; // { 'makan': [35000, 42000, 38000], ... }
  const now = new Date();

  for (let i = 1; i <= monthsBack; i++) {
    const target = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - i,
      1
    ));
    const year = target.getUTCFullYear();
    const month = target.getUTCMonth();

    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.timestamp);
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    });

    const breakdown = _buildBreakdown(monthExpenses); // reuse existing function
    for (const [cat, { total }] of Object.entries(breakdown)) {
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(total);
    }
  }

  // Return average per category
  return Object.fromEntries(
    Object.entries(buckets).map(([cat, totals]) => [
      cat,
      Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
    ])
  );
}
```

**Step 2 — Claude: classify fixed/variable + generate prediction narrative**

Send the computed averages as structured data to Claude. Claude returns:
- Classification of each category as "fixed" or "variable"
- Predicted next month total per category
- Savings recommendation based on variable category variance

This is the same `claude.js` tool-call pattern already used for expense parsing. No new API surface.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pure JS mean calculation | `simple-statistics` | Use simple-statistics only if adding more complex stats (percentiles, correlation). Not needed for monthly average prediction. |
| Claude for fixed/variable classification | Rule-based category list | A hardcoded map `{ kost: 'fixed', tagihan: 'fixed', jajan: 'variable', ... }` works but cannot adapt to new categories or user-specific patterns. Claude handles this in one tool call. |
| Native `Date` UTC methods | `date-fns` | Use date-fns if timezone-aware date arithmetic becomes complex (e.g., WIB/UTC+7 month boundaries). Not needed — current codebase already uses UTC correctly for all date filtering. |
| Average of N months | Linear regression | Use regression only with 6+ data points. At 1–3 months, regression overfits and produces confidence-destroying noise. Average is more defensible and explainable. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `simple-statistics` | Zero functional gain over 3 lines of pure JS for the prediction method needed. Adds a 60KB dependency for `mean()`. | `arr.reduce((s,v) => s+v, 0) / arr.length` |
| `mathjs` or `ml-regression` | Severe overkill for monthly average + variance. These are full numeric/ML libraries. | Pure JS arithmetic |
| `date-fns` for v1.1 | Not needed — existing UTC Date pattern in summary.js already handles month boundary math correctly. | Native `Date` with `getUTCFullYear()` / `getUTCMonth()` |
| Persistent prediction cache | Predictions are cheap to recompute on demand (pure JS aggregation + one Claude call). Caching adds state management complexity. | Recompute on every `/prediksi` call |
| A separate `prediction.js` module | Premature if /prediksi is the only prediction surface. Keep in `summary.js` or a co-located `predictions.js` only if it exceeds ~80 lines. | Add `buildPrediction()` to `summary.js` initially |

---

## Minimum History Gate

The `/prediksi` feature requires ≥30 days of data to be useful (from PROJECT.md). Implement this as a pure JS check before calling Claude:

```js
function hasEnoughHistory(expenses) {
  if (expenses.length === 0) return false;
  const oldest = new Date(expenses[0].timestamp);
  const daysSince = (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 30;
}
```

No library needed. Return a friendly Bahasa Indonesia message if the gate fails.

---

## Stack Patterns by Variant

**If data history grows beyond 6 months:**
- The averaging approach still works — just cap `monthsBack` at 3 for recency bias, or weight recent months more heavily with a plain multiplier array.
- Still no library needed.

**If savings target suggestion needs percentile analysis (e.g., "your makan spend is in the top 30% of your own history"):**
- At that point, adding `simple-statistics` for `quantile()` is justified.
- Install then: `npm install simple-statistics@^7.8.0`

**If timezone accuracy matters for WIB users (UTC+7 month boundaries):**
- Install `date-fns-tz` and use `toZonedTime(date, 'Asia/Jakarta')` for month boundary detection.
- Current UTC approach may attribute a Jan 31 11:59pm WIB expense to February in UTC. Acceptable for MVP; flag for v1.2.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @anthropic-ai/sdk ^0.79.0 | Node.js 18+ | CJS and ESM both supported; project uses CJS |
| async-mutex ^0.5.0 | Node.js 14+ | No issues |
| write-file-atomic ^7.0.1 | Node.js 14+ | No issues |

---

## Sources

- `/workspaces/mixxy/package.json` — installed dependency versions — **HIGH confidence**
- `/workspaces/mixxy/summary.js` — existing pure JS date filtering + aggregation patterns — **HIGH confidence**
- WebSearch: simple-statistics npm (v7.8.x, 320K weekly downloads, no dependencies) — **MEDIUM confidence** (version verified via multiple sources; exact patch unconfirmed)
- WebSearch: "Node.js built-in date manipulation no dependency" — 2025 trend toward reducing external deps, native `Date` sufficient for simple month arithmetic — **MEDIUM confidence**
- WebSearch: LLM classification for fixed/variable expense categories — confirmed pattern (LLM-based category classification works well with clear definitions in prompt) — **MEDIUM confidence**
- WebSearch: linear regression for spend prediction — confirmed that sparse data (1-3 points) makes regression unreliable; averaging is appropriate — **MEDIUM confidence**
- PROJECT.md constraint: ≥30 days history requirement for /prediksi — **HIGH confidence**

---

## Open Validation Items

1. Confirm `claude-haiku-4-5` is still the model ID in use (see `claude.js` line 14) — it is — no change needed for v1.1.
2. Decide: add `buildPrediction()` to `summary.js` or create a new `predictions.js`. Rule of thumb: create new file if function body exceeds 60 lines.
3. Test the minimum history gate with the single entry in `data/8700138281.json` (2026-03-17) — it has only 1 day of data, gate should block and return a clear message.

---

*Stack research for: Mixxy v1.1 — /prediksi spend prediction feature*
*Researched: 2026-03-18*
