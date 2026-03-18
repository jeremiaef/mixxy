# Phase 5: Classification and Command Delivery - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the `/prediksi` command end-to-end: call Claude to classify each category as fixed/variable using pre-computed JS variance, compute savings headroom, format and deliver the prediction message to the user. Update `/help` to list the new command. No new data storage — read-only consumer of `predict.js` + `storage.js`.

</domain>

<decisions>
## Implementation Decisions

### Output format
- One line per category in a list format: emoji + name + label (tetap/variabel) + amount
- Amount formatted with `~Rp` prefix and IDR shorthand (rb/jt) — hedged with `~` tilde
- Header: `Prediksi bulan depan (berdasarkan N bulan terakhir):` — hedging appears once in header, not per row
- Total summary line at the bottom: `Total kira-kira: ~Rp X`
- Categories with `'kurang data'` still appear in the list, showing "kurang data" instead of an amount
- All categories from `buildPrediction()` output are shown — no hiding

### Savings suggestion
- Appears as a footer paragraph after the total line — separated by a blank line
- Covers exactly one category: the variable category with the highest spending variance
- Quotes JS-computed figures: minimum spend month, average, and savings headroom (avg - min)
  - Format: `"bisa se-rendah Xrb, rata-rata Yrb, ada ruang ~Zrb buat dihemat"`
- If no variable category has sufficient data for variance computation, skip the savings footer entirely — show list + total only

### Insufficient data message
- Friendly + encouraging tone — fits the casual friend persona, not a roast
- Shows how many days the user has been logging so they can see progress toward the 30-day gate
- Template: `"Data kamu baru X hari — butuh minimal 30 hari buat prediksi yang akurat. Terus catat ya!"`
- Compute days-logged from `expenses[0].timestamp` to now (same data `buildPrediction` already reads)

### /help update
- Add `/prediksi` to the `HELP_MESSAGE` string in `index.js` alongside existing commands
- Short Bahasa Indonesia description consistent with existing help lines

### Claude's Discretion
- Emoji selection per category (consistent with bot's existing emoji usage in existing commands)
- Exact variance formula for determining "highest variance" category (standard deviation or max-min range — both valid)
- Tool schema design for `PREDICT_CLASSIFY_TOOL`
- Whether classification is one batch call for all categories or sequential

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PRED-01, PRED-05, PRED-06, PRED-07 — the four requirements this phase delivers

### Phase 4 interface contract
- `.planning/phases/04-prediction-engine/04-CONTEXT.md` — defines `buildPrediction()` return shape that Phase 5 consumes
  - `{ sufficient: false }` → show insufficient data message
  - `{ sufficient: true, monthsUsed: N, categories: { cat: number | 'kurang data' } }` → show prediction

### Existing code patterns to follow
- `claude.js` — `processMessage` with `clientOverride` pattern, `tool_choice: required` approach for structured output
- `prompts.js` — where `PREDICT_CLASSIFY_TOOL` should be defined alongside `EXPENSE_TOOL` and `REKAP_TOOL`
- `index.js` — command routing pattern (`/rekap`, `/budget`, `/hapus`) to follow for `/prediksi` wiring
- `index.js` `HELP_MESSAGE` — string to update with `/prediksi` entry
- `summary.js` — `generateInsight` pattern (Claude call with pre-computed data as input)

### Roadmap decisions already locked
- `.planning/ROADMAP.md` §Overview v1.1 section — `FIXED_VARIANCE_THRESHOLD = 0.15`, `kost` hardcoded fixed, `tool_choice: required` for classification

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildPrediction(userId, _options, clientOverride)` in `predict.js` — already accepts `clientOverride`; Phase 5 may extend it or call a new classify step on its output
- `processMessage` in `claude.js` — pattern for making tool_use Claude calls with structured output
- `formatAmount` in `index.js` — IDR formatting (rb/jt); Phase 5 output needs same formatting
- `HELP_MESSAGE` constant in `index.js` — static string to update

### Established Patterns
- `clientOverride` 3rd-parameter pattern — all Claude-calling modules accept this for test isolation
- `tool_choice: required` for structured output (established in roadmap, matches claude.js style)
- UTC month arithmetic for variance computation (use `getUTCFullYear`/`getUTCMonth` consistently)
- Export private helpers with `_` prefix for direct unit test access

### Integration Points
- `index.js` bot handler: add `/prediksi` command guard before the `processMessage` fallthrough — same pattern as `/rekap`
- `prompts.js`: add `PREDICT_CLASSIFY_TOOL` constant and export it
- `predict.js`: Phase 5 will add a `classifyPrediction` function (or extend `buildPrediction`) that calls Claude with the pre-computed categories map

</code_context>

<specifics>
## Specific Ideas

- Approved output preview (user confirmed this format):
  ```
  Prediksi bulan depan (berdasarkan 3 bulan terakhir):

  🍜 makan — variabel — ~Rp 450rb
  🚗 transport — variabel — ~Rp 180rb
  🏠 kost — tetap — ~Rp 1.5jt
  📱 pulsa — tetap — ~Rp 80rb

  Total kira-kira: ~Rp 2.2jt

  Kalau mau hemat, coba kurangin makan — bulan lalu bisa se-rendah 280rb, rata-ratanya 450rb. Ada ruang ~170rb buat dihemat.
  ```

- Approved insufficient data preview (user confirmed this format):
  ```
  Data kamu baru 12 hari — butuh minimal 30 hari buat prediksi yang akurat. Terus catat ya!
  ```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-classification-and-command-delivery*
*Context gathered: 2026-03-18*
