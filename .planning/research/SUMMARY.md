# Project Research Summary

**Project:** Mixxy v1.1 — Behavioral Intelligence / Spend Prediction (`/prediksi`)
**Domain:** Personal finance Telegram bot — Bahasa Indonesia, Indonesian market (Node.js + Claude AI)
**Researched:** 2026-03-18
**Confidence:** HIGH (stack and architecture based on direct codebase inspection; features and pitfalls MEDIUM-HIGH from industry analogues)

## Executive Summary

Mixxy is a Bahasa Indonesia Telegram bot that lets Indonesian users log expenses via natural language and receive AI-generated insights. The v1.0 foundation (expense logging, `/rekap`, `/budget`, `/hapus`, weekly digest) is fully built and deployed. The v1.1 milestone adds behavioral intelligence: a `/prediksi` command that projects next-month spending by category, classifies categories as fixed or variable, and suggests a savings target. The core research finding is that this feature requires no new dependencies — the existing Node.js stack, `@anthropic-ai/sdk`, and file-based JSON storage are sufficient.

The recommended implementation enforces a clean separation between computation and interpretation. All arithmetic (monthly aggregates, category averages, variance) is computed in pure JavaScript using patterns already established in `summary.js`. Claude's role is narrowly scoped to two tasks: (1) classifying categories as fixed or variable via `tool_use` with a forced structured response, and (2) narrating the result in the bot's existing personality. This mirrors the architecture of `summary.js` and `budget.js` — a new `predict.js` module that reads from storage, computes, calls Claude, and returns a formatted Bahasa Indonesia string. Three files change: `prompts.js` gains a new tool schema export, `predict.js` is created, and `index.js` gains three lines.

The dominant risks are behavioral, not technical. Predictions built on sparse data erode user trust, and Claude will produce arithmetically plausible but wrong numbers if asked to do math instead of narrate. Both risks have clear mitigations: a hard 30-day data gate before the command responds, per-category data sufficiency checks before the Claude call, and a strict prompt architecture that gives Claude only pre-computed numbers to frame — never raw data to aggregate. Every savings suggestion must be grounded in JavaScript-computed variance for a specific named category, not generated from Claude's general financial knowledge.

## Key Findings

### Recommended Stack

The existing stack requires zero additions for v1.1. Node.js native `Date` UTC methods cover all month-boundary arithmetic. `Array.reduce` and `Map` cover per-category aggregation. `@anthropic-ai/sdk` handles the Claude classification call. `async-mutex` and `write-file-atomic` already guard concurrent storage access. The one candidate library evaluated — `simple-statistics` — offers no functional gain over three lines of pure JS for monthly averaging; it should not be added until percentile analysis or more complex statistics are genuinely required.

See `.planning/research/STACK.md` for full analysis.

**Core technologies (all already installed):**
- `Node.js 20/22 LTS`: Runtime — native Date UTC methods cover all prediction date arithmetic
- `@anthropic-ai/sdk ^0.79.0`: Claude API client — handles fixed/variable classification and prediction narration via `tool_use`
- `node-telegram-bot-api ^0.67.0`: Telegram integration — `/prediksi` uses the same static command guard pattern as `/rekap`
- `async-mutex ^0.5.0`: Concurrent write safety — already in use in `storage.js`, no change needed

**Conditional additions (do not add yet):**
- `simple-statistics@^7.8.0` — only if percentile analysis or regression is needed (6+ months data, multi-user scale)
- `date-fns-tz` — only if WIB timezone month-boundary accuracy becomes a user complaint

### Expected Features

See `.planning/research/FEATURES.md` for full analysis.

**Must have (v1.1 table stakes):**
- `/prediksi` command with 30-day history guard — without the guard, misleading predictions erode trust immediately
- Per-category spend estimate (weighted 3-month average: month-1=42%, month-2=33%, month-3=25%) — mirrors `/rekap` mental model users already have
- Fixed vs. variable labeling in prediction output — makes the prediction scannable and actionable
- Savings headroom suggestion — the "so what?" answer; prediction without a suggested action is just a number
- Claude-narrated output in bot personality — same casual Bahasa Indonesia register as all other responses
- Confidence signal: show how many months of data were used (no % scores — too confusing in chat UX)

**Should have (v1.2 after validation):**
- Category variance callout ("transport kamu naik 40% bulan ini") — requires 2+ complete calendar months
- Prediction accuracy retrospective ("bulan lalu gue prediksi 800rb, ternyata 920rb") — needs prediction storage; validate user appetite first
- Intra-month prediction warning ("udah hari ke-15 dan kamu udah 60% dari prediksi") — proactive mid-month nudge

**Defer (v2+):**
- Weekly spending pattern detection ("kamu biasanya boros di akhir bulan") — needs weekly bucketing across multi-month history
- "What if" scenario modeling — requires interactive conversation state; complex Telegram UX
- Seasonality detection (Lebaran, year-end) — needs 12+ months; not viable at current user tenure
- ML-powered prediction — only justified if simple averages demonstrably underperform

**Anti-features to explicitly reject:**
- Daily/weekly predictions (false precision from monthly data)
- % confidence intervals (finance anxiety increases with uncertainty ranges in chat UX)
- Bank-feed integration (Indonesian Open Banking not standardized; ToS violations)
- Persistent prediction cache (stale immediately after new expense logged; recompute is fast)

### Architecture Approach

The v1.1 architecture adds one new module (`predict.js`) and minimal modifications to two existing files (`prompts.js` and `index.js`). The module boundary contract mirrors `summary.js`: accept `userId`, return a formatted string. `predict.js` is a read-only consumer of `storage.js` — it never writes. The Claude call uses `tool_choice: required` to guarantee structured `{ category: "fixed"|"variable" }` output without regex parsing, the same pattern already proven in `claude.js`.

See `.planning/research/ARCHITECTURE.md` for full analysis.

**Major components after v1.1:**
1. `index.js` — Bot lifecycle, command routing, cron; adds static `/prediksi` guard before NLP fallthrough
2. `claude.js` — Expense parsing and intent detection via `tool_use`; unchanged for v1.1
3. `storage.js` — Per-user JSON I/O with mutex/atomic writes; unchanged for v1.1
4. `prompts.js` — All prompt strings and tool schemas; adds `PREDICT_CLASSIFY_TOOL` export
5. `summary.js` — Historical aggregation and Claude narrative insight; unchanged for v1.1
6. `budget.js` — Threshold detection and budget progress formatting; unchanged for v1.1
7. `predict.js` (NEW) — Future spend projection and fixed/variable classification; reads storage, calls Claude, returns string

**Build order:**
1. `prompts.js` — add `PREDICT_CLASSIFY_TOOL` (pure data, no logic change)
2. `predict.js` — full module, testable in isolation with mock data and `clientOverride`
3. `index.js` — three-line change: import, command guard, help text update

**Key architectural patterns to follow:**
- Computation outside Claude: all averages, variance, and month grouping in JS before any API call
- `tool_use` with `tool_choice: required` for structured classification output
- Read-only compute module: `predict.js` never writes to storage (same contract as `summary.js`)
- Static command guard in `index.js`: `/prediksi` must never route through the Claude NLP path

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full analysis including 8 v1.0 pitfalls and 7 v1.1-specific pitfalls.

**v1.1-specific pitfalls (highest priority):**

1. **Claude doing arithmetic in predictions** — LLMs achieve ~76% accuracy on multi-step math; wrong totals in financial predictions destroy user trust. Prevention: all aggregation computed in JS; Claude receives only pre-computed values with explicit prompt instruction "Do not compute or estimate figures yourself."

2. **Predicting on insufficient history** — 30-day minimum gate is necessary but not sufficient; a single atypical month dominates the average. Prevention: hard 30-day gate for the command overall; per-category, require at least 3 separate transaction days before generating a number; flag sparse categories as "kurang data."

3. **Overconfident prediction framing** — users treat "bakal habis Rp X" as a commitment; trust breaks when reality diverges. Prevention: always use hedging language ("kira-kira", "estimasi", "sekitar"); include data basis in message ("berdasarkan X bulan terakhir"); add variance warning when coefficient of variation exceeds 40%.

4. **Hallucinated savings advice** — Claude generates plausible but data-free suggestions, potentially harmful in financial context. Prevention: identify highest-variance variable category in JS first; tell Claude only that category's name and its actual min/max/avg; forbid Claude from suggesting other categories.

5. **Fixed/variable misclassification from single month** — partial history produces wrong classifications (kost appearing as variable if user started logging mid-month). Prevention: classify as "fixed" only if category appears in 2+ calendar months with <15% variance; hardcode `kost` as fixed if it appears at all; communicate uncertainty to user.

**v1.0 pitfalls (already mitigated, verify still holds):**

6. **Duplicate polling instances** — `409 Conflict` error signals two polling instances fighting. Already resolved via dedup check in `index.js`; confirm dedup logic covers `/prediksi` responses.

7. **JSON file corruption from concurrent writes** — already resolved via `async-mutex` and `write-file-atomic` in `storage.js`; `predict.js` is read-only so does not introduce new write risk.

## Implications for Roadmap

The v1.0 foundation is complete and verified. The v1.1 milestone maps to a single implementation effort with a defined internal build sequence. No infrastructure phases are needed — the existing architecture absorbs the new feature cleanly.

### Phase 1: Prediction Data Layer

**Rationale:** The aggregation logic (`groupByMonth`, `computeProjections`, `filterCompleteMonths`, minimum history gate) is the highest-risk component — it must produce arithmetically correct numbers before any Claude integration is added. Building and unit-testing it in isolation avoids wasting API calls on a broken data foundation.
**Delivers:** A standalone `predict.js` with `buildPrediction()` skeleton that reads real expense data, computes per-category monthly totals and variance, applies the 30-day minimum gate, and returns raw structured data (not yet a formatted string). Unit tests with known fixture data confirm correctness.
**Addresses features:** History guard (table stakes), per-category spend aggregation, category sparsity handling
**Avoids pitfalls:** Arithmetic delegation to Claude (Pitfall 9), insufficient history noise (Pitfall 10), category sparsity (Pitfall 11), `lainnya` pollution (Pitfall 15)
**Research flag:** Standard patterns — established JS aggregation; skip `research-phase`

### Phase 2: Fixed/Variable Classification and Savings Target

**Rationale:** Classification depends on correct aggregation output from Phase 1. The Claude `tool_use` call is low-risk (pattern already proven in `claude.js` and `summary.js`) but the pre-classification JS criteria (2+ months, <15% variance threshold) must be validated before calling Claude. Savings target suggestion builds on classification output.
**Delivers:** Claude-powered category classification, savings target suggestion grounded in the highest-variance variable category, complete `buildPrediction()` returning a Bahasa Indonesia string with appropriate hedging language.
**Uses stack:** `@anthropic-ai/sdk` with `PREDICT_CLASSIFY_TOOL` and `tool_choice: required`; `PREDICT_CLASSIFY_TOOL` export added to `prompts.js`
**Avoids pitfalls:** Single-month misclassification (Pitfall 13), hallucinated savings advice (Pitfall 14), overconfident framing (Pitfall 12)
**Research flag:** Standard patterns — `tool_use` with forced structured output is already proven in the codebase; skip `research-phase`

### Phase 3: Command Integration and Release

**Rationale:** `index.js` changes are minimal and should come last — after `predict.js` is fully tested in isolation. Integration testing is done manually via Telegram. `/help` text update ensures feature discoverability.
**Delivers:** `/prediksi` available to users, help text updated, feature shipped and observable in production.
**Addresses features:** Claude-narrated output in bot personality, confidence signal ("berdasarkan X bulan terakhir"), hedging language baked into Claude prompt, user-facing error message for insufficient history
**Avoids pitfalls:** Routing through Claude NLP (Architecture Anti-Pattern 1), overconfident framing (Pitfall 12)
**Research flag:** Standard patterns — mirrors `/rekap` integration; skip `research-phase`

### Phase Ordering Rationale

- Data layer before Claude integration: aggregation correctness is prerequisite for trustworthy predictions; pure JS unit tests are fast and free, Claude API calls are not
- Classification before command wiring: `predict.js` accepts `clientOverride` for testability, enabling full end-to-end unit tests before the Telegram command is wired
- `index.js` last: minimizes integration surface to three lines; all behavior is isolated and testable in `predict.js`

### Research Flags

Phases needing deeper research during planning: None. All three phases build exclusively on patterns already established and proven in the codebase (`summary.js` for read-only compute modules, `claude.js` for `tool_use`, `index.js` for static command guards).

Phases with standard patterns (skip `research-phase`): All three. Open decisions (weighting formula for monthly averages, exact variance threshold for fixed/variable classification) are implementation details resolvable during execution without additional research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on direct `package.json` and `summary.js` inspection; zero new dependencies confirmed; no training-data staleness risk |
| Features | MEDIUM-HIGH | Core feature set HIGH (well-established personal finance UX patterns from Cleo, YNAB, Mint); Indonesian market specifics MEDIUM (validate with users before v1.2 feature decisions) |
| Architecture | HIGH | Based on direct code inspection of all 6 existing modules; module boundaries and integration points are concrete; `tool_use` pattern already proven in codebase |
| Pitfalls | HIGH for integration and LLM math pitfalls | MEDIUM for UX framing patterns (community consensus, multiple sources agree but no direct user validation) |

**Overall confidence:** HIGH

### Gaps to Address

- **WIB timezone boundary accuracy:** The current UTC approach may attribute a Jan 31 11:59pm WIB expense to February. Acceptable for MVP; flag for v1.2 if users report incorrect month attribution. Resolution when needed: add `date-fns-tz` with `Asia/Jakarta`.

- **Weighted average formula validation:** Research recommends 42%/33%/25% EWMA-style weighting for recency bias — industry-standard for 3-month rolling averages but not validated against actual Indonesian spending patterns. Resolution: ship with this weighting, observe if predictions feel accurate, adjust in v1.2.

- **`predict.js` module size threshold:** Research recommends a new `predict.js` module rather than extending `summary.js`. If the full implementation is under 60 lines, consolidation into `summary.js` is viable. Resolution: decide based on actual line count during implementation.

- **`lainnya` category prediction semantics:** `lainnya` accumulates heterogeneous one-off expenses that make its prediction structurally noisy. Recommended approach is to show with caveat ("termasuk pengeluaran tak terduga — bisa bervariasi jauh") rather than predicting normally. Resolution: implement the conservative approach and validate with users.

- **Fixed/variable variance threshold:** The 15% month-to-month variance threshold for "fixed" classification is a reasonable heuristic but untested. Resolution: treat as a tunable constant (`FIXED_VARIANCE_THRESHOLD = 0.15`) in `predict.js` so it can be adjusted without a code change to the classification logic.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `index.js`, `claude.js`, `storage.js`, `prompts.js`, `summary.js`, `budget.js` (2026-03-18) — module boundaries, integration points, existing patterns
- `package.json` — installed dependency versions (all confirmed current)
- `.planning/PROJECT.md` — v1.1 milestone requirements and the 30-day minimum history constraint
- Anthropic `tool_use` documentation pattern — same `tool_choice: required` pattern already used in `claude.js`

### Secondary (MEDIUM confidence)
- Cleo AI product research (meetcleo.com, thepennyhoarder.com, moneycrashers.com) — feature patterns for AI finance chatbot with savings and prediction features
- Forecasting: Principles and Practice (otexts.com/fpp2) — moving average methodology for MVP prediction; basis for 3-month rolling average recommendation
- NerdWallet, Bankrate, Rocket Money (rocketmoney.com) — fixed vs. variable expense taxonomy; consistent with standard personal finance practice
- WebSearch: LLM accuracy on arithmetic tasks (~76% on multi-step math) — basis for Pitfall 9 severity assessment
- WebSearch: linear regression on sparse data (2-3 points overfits) — basis for recommending averaging over regression

### Tertiary (LOW confidence)
- Indonesian expense behavior and user patterns — training data and v1.0 research; validate with actual Indonesian users before v2 feature expansion
- Variance thresholds for fixed/variable classification (15% threshold) — derived from general personal finance practice; not validated against Indonesian spending patterns

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
