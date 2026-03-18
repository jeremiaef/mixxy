# Feature Research

**Domain:** Personal finance Telegram bot — Bahasa Indonesia, Indonesian market
**Researched:** 2026-03-18 (updated from 2026-03-17)
**Confidence:** MEDIUM-HIGH (web search used; Indonesian market specifics MEDIUM — validate with users)

---

## Research Notes

Updated for v1.1 milestone: Behavioral Intelligence / Spend Prediction. This document extends the
v1.0 feature research with spend prediction, fixed vs. variable classification, and savings
recommendations — the `/prediksi` feature cluster.

Research sources for this update:
- Cleo AI (primary analogue for AI finance chatbot with savings/prediction features)
- YNAB (methodology reference for budgeting intelligence)
- Mint / NerdWallet / Rocket Money (competitor pattern analysis)
- Industry research on forecasting minimum viable data requirements
- Forecasting methodology literature (moving averages, EWMA)

The original v1.0 research below is preserved for complete context.

---

## Feature Landscape — v1.1 Additions (Spend Prediction / Behavioral Intelligence)

### Table Stakes for Spend Prediction (Users Expect These)

If the bot presents a `/prediksi` command, these behaviors are assumed to exist. Missing them
makes the feature feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Next-month total spend estimate | Core premise of any "prediction" feature — users expect a number | MEDIUM | Simple: 3-month rolling average per category, summed; Claude narrates the output |
| Per-category breakdown in prediction | Budget tracking is already per-category; predictions must match that mental model | MEDIUM | Mirrors `/rekap` structure so users have a consistent frame |
| Minimum history guard | Predictions with <30 days of data are misleading; the bot must refuse gracefully | LOW | Gate: if user has <30 days logged, decline with a helpful message ("Butuh lebih banyak data dulu...") |
| Confidence signal | Users need to know if the prediction is based on 3 months or 3 weeks of data | LOW | Simple: show how many months of data were used; don't need a % confidence score |
| Fixed vs. variable labeling | Rent (kost) and subscriptions are predictable; food varies — users know this intuitively and expect the bot to too | MEDIUM | Claude classifies on the fly from category + variance; no separate ML model needed |

### Differentiators for Spend Prediction

Features that make `/prediksi` feel like a smart friend, not just a calculator.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Savings headroom suggestion | "Bulan depan kamu mungkin bisa hemat 150rb di jajan" — actionable, not just descriptive | MEDIUM | Requires discretionary spend variance + historical average; Claude computes and narrates |
| Roast-inflected prediction narrative | Cleo's killer feature is the voice, not the data — predictions delivered in the bot's personality keep users engaged | LOW | Already built: Claude generates narrative; same system prompt applies |
| Category variance callout | "Pengeluaran transport kamu naik 40% bulan ini — bulan depan kemungkinan sama kalau polanya gak berubah" | MEDIUM | Requires month-over-month comparison by category; depends on 2+ months of data |
| Spending pattern memory | "Kamu biasanya lebih boros di akhir bulan" — pattern detection across weeks | HIGH | Needs weekly bucketing of historical data; significant data aggregation work; defer to v1.2+ |
| "What if" scenarios | "Kalau kamu kurangin jajan 20%, kamu bisa hemat Xrb bulan depan" | HIGH | Requires interactive state in conversation; complex UX for Telegram; defer to v2 |

### Anti-Features for Spend Prediction

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| ML-powered prediction model | "Real prediction uses ML, not averages" | Training data requirements (1+ year), model maintenance, cost — massively over-engineered for a bot with 1-10 users; simple averages are just as accurate at low sample sizes | 3-month weighted average + Claude narration is indistinguishable to users; ship the simple version |
| Daily/weekly predictions | "I want to see predicted spend by week" | Weekly prediction from monthly data is false precision; users don't make weekly decisions based on this | Monthly predictions only; weekly is noise |
| % confidence intervals | "Show me a range like 150k-250k" | Confusing UX for casual users; finance anxiety increases with uncertainty ranges | Simple "kira-kira 200rb" with a caveat; don't show error bars in a chat bot |
| Prediction history / accuracy tracking | "Was my last prediction correct?" | Requires storing predictions, comparing to actuals, surfacing retrospectives — massive scope expansion | Out of scope for MVP; if users engage heavily, consider a monthly accuracy roundup |
| Bank-feed-powered prediction | "Auto-sync my BCA/GoPay for better predictions" | Indonesian Open Banking is not standardized; screen-scraping is fragile and violates ToS | Self-reported data only; predictions are only as good as what users log (communicate this honestly) |
| Savings account integration | "Move money to savings automatically" | Payment/banking API integration requires financial licensing, massive compliance surface | Suggest savings targets as text advice only; no money movement |

---

## Minimum Viable Prediction — What Actually Works

Based on research into Cleo, YNAB, Mint, and forecasting methodology:

### The 30-day minimum is real, but 60-90 days is better

- **30 days:** Enough for a rough estimate; single month may contain one-off events (holiday, travel)
- **60-90 days:** Smooths out anomalies; 3-month rolling average is the industry-standard MVP approach
- **1 year+:** Needed for seasonality detection (Lebaran spending spike, year-end bonuses); out of scope for MVP

**Implementation recommendation:** Gate at 30 days but add a caveat ("Ini prediksi awal — makin banyak data yang kamu log, makin akurat prediksinya"). Show how many months of data were used.

### The simplest useful algorithm

```
predicted_category = average(last_3_months_category_spend)
```

This is what Cleo, Mint, and Rocket Money effectively do at the chat/summary layer. The ML that Cleo advertises is in their bank-feed categorization (not needed here — Claude handles categorization). For prediction narrative, simple averages work.

**Weight recent months more:** If a user's food spend jumped last month, a pure 3-month average underweights the trend. Weight: month-3: 25%, month-2: 33%, month-1: 42%. This matches EWMA (exponentially weighted moving average) behavior without requiring a math library.

### Fixed vs. variable classification heuristic

| Category | Classification | Rationale |
|----------|---------------|-----------|
| Kost / sewa | Fixed | Near-identical each month; predictable |
| Tagihan (listrik, BPJS) | Fixed | Recurring, low variance |
| Pulsa / paket data | Fixed | Monthly top-up behavior, predictable |
| Transport (ojol/grab) | Variable | Highly usage-dependent |
| Makan / jajan | Variable | Daily discretionary, high variance |
| Hiburan | Variable | Event-driven spend |
| Belanja | Variable | Impulse-driven; high variance |
| Kesehatan | Variable | Unpredictable by nature |

Claude can classify based on category name + coefficient of variation across months. No separate ML needed — Claude understands these categories and can reason about variance from the data passed in the prompt.

### Savings target suggestion

**Formula:** `savings_suggestion = avg_discretionary_spend * variance_buffer_pct`

Where:
- `discretionary_spend` = sum of variable categories (makan, jajan, hiburan, belanja, transport)
- `variance_buffer_pct` = the gap between highest and lowest months in last 3 months, expressed as a % of average
- Suggestion: "spend the average, not the high" — potential savings is `max_month - avg_month` for discretionary

This mirrors what Cleo does conceptually (identifying "frugal months" as savings potential). The math is simple; the value is in Claude's narrative delivery.

---

## Feature Landscape — v1.0 (Preserved)

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Natural language expense input | Core premise — "tadi makan 35rb" must just work | MEDIUM | Claude handles NLP; slang parsing ("rb", "ribu", "juta", "k") is the hard part |
| Auto-categorization | Every finance app categorizes; manual is a dealbreaker for casual users | MEDIUM | Categories must match Indonesian spending patterns, not Western defaults |
| Expense summary on demand | Users need to ask "how much did I spend?" anytime | LOW | `/rekap` command — straightforward aggregation |
| Monthly/period totals | Standard in every finance tracker | LOW | Filter by month, week, or custom range |
| Delete last entry | Fat-finger protection — users will mis-input often | LOW | `/hapus` — essential for trust; without this users stop logging errors |
| Onboarding / first-use guidance | Without `/start` explaining what the bot does, users are lost | LOW | Must explain the natural language input style with examples |
| Help command | Users forget commands; discovery mechanism | LOW | `/help` listing all commands with brief descriptions |
| Budget setting | A personal finance product without budget setting feels like a log, not a tool | LOW | `/budget` to set monthly cap; warn at 80% and 100% |
| Budget warnings | Proactive alert when approaching limit | LOW | Triggered on each new expense logged; simple threshold check |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Bahasa Indonesia NLP (casual register) | No competitor Telegram bot does this natively; users can say "udah bayar kost bulan ini 1.5jt" and it works | MEDIUM | Claude system prompt must handle: slang amounts ("rb", "ribu", "juta", "k", "perak"), common abbreviations, informal syntax |
| Roast mode (Cleo-style) | Emotional engagement — users share screenshots, creates virality; most finance apps are sterile | MEDIUM | Claude decides when to apply (not user-toggled); must be culturally appropriate Indonesian humor, not translated Western humor |
| Casual personality ("finance teman") | Feels like texting a friend vs. using accounting software | LOW | Achieved through Claude system prompt and response style guidelines |
| Weekly auto-digest | Proactive insights without user action — most bots are purely reactive | MEDIUM | Cron job every Sunday; Claude generates a narrative summary, not just numbers |
| AI-generated spending insights | "You spent 40% more on food this week vs. last week" — narrative, not just numbers | MEDIUM | Claude comparing period-over-period data; requires sufficient history |
| Indonesian amount slang handling | "35rb", "22ribu", "1.5jt", "500 perak" parsed correctly without user reformatting | MEDIUM | Core to the "no friction" value prop; tested edge cases needed |
| Category suggestions in Indonesian context | "Jajan", "kost", "bensin", "pulsa" as first-class categories, not mapped to "Entertainment" | LOW | Requires Indonesian-aware category list rather than Western defaults |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Receipt scanning / OCR | "I want to just photo my receipt" | Requires image processing pipeline, STRUK format varies wildly, adds latency and cost; not essential when voice-style text input is fast | Keep text input; users who want receipt scanning have higher friction tolerance — defer to v2 |
| Bank account sync / bank statement import | "Auto import from BCA/Mandiri/GoPay" | Indonesian Open Banking is nascent; no standardized API; screen-scraping is fragile and risky; adds massive compliance surface | Let users self-report; manual input is the feature |
| Web dashboard / data visualization | "I want to see charts" | Full web app is a separate product; breaks the "Telegram only" constraint; adds auth complexity | Telegram's inline charts (if ever needed) or ASCII-style summaries in bot responses |
| Multi-currency support | "I sometimes spend in SGD or USD" | Adds parsing ambiguity; exchange rate dependency; most Indonesian daily spending is IDR only | IDR only for MVP; flag as v2 if users in border cities or travelers request it |
| Export to Excel/CSV | "I want a spreadsheet" | Creates data pipeline maintenance; most users who ask don't actually use exports | Defer; summary text in chat satisfies 90% of use cases |
| Category editing / custom categories | "I want to add my own categories" | Category management UI is complex; users rarely maintain custom systems | Pre-define an Indonesian-appropriate category list; let Claude infer intelligently |
| Shared/family expense tracking | "I want to share with my spouse" | Multi-user data model, reconciliation logic, trust/privacy concerns — a separate product | Single-user only for MVP; Telegram groups could be a future approach |
| Formal "anda" mode / language toggle | "Some users prefer formal Indonesian" | Splits personality, splits prompt engineering, adds config complexity | Always casual ("kamu"); define this in initial onboarding so users self-select |

---

## Indonesian-Specific Considerations

### Common Expense Categories (Indonesian Context)

| Category | Indonesian Term(s) | Fixed/Variable | Notes |
|----------|-------------------|----------------|-------|
| Makanan & Minuman | Makan, minum, jajan, kopi | Variable | Highest frequency; must be top category |
| Transportasi | Grab, Gojek, ojol, bensin, tol, parkir, KRL | Variable | "Ojol" (ojek online) is a distinct mental model |
| Kost / Sewa | Kost, kontrakan, sewa | Fixed | Monthly payment, common among young adults |
| Belanja | Tokopedia, Shopee, belanja online, pasar, minimarket | Variable | Includes lifestyle shopping |
| Pulsa & Internet | Pulsa, paket data, wifi | Fixed | Top-up behavior is frequent, predictable |
| Tagihan | Listrik, air, BPJS, kartu kredit, cicilan | Fixed | Infrequent but high value |
| Hiburan | Bioskop, Netflix, game, karaoke, nongkrong | Variable | Event-driven |
| Kesehatan | Apotik, dokter, obat | Variable | Unpredictable |
| Pendidikan | Kursus, buku, les, kampus | Variable | High priority for many users |
| Lain-lain | Hadiah, sumbangan, tak terduga | Variable | Catch-all |

### Indonesian Amount Slang (Must Parse Correctly)

| Input | Meaning | Notes |
|-------|---------|-------|
| "35rb" / "35k" / "35ribu" | Rp 35.000 | Most common shorthand |
| "1.5jt" / "1.5 juta" | Rp 1.500.000 | Millions common for rent, large purchases |
| "500 perak" | Rp 500 | "Perak" = rupiah in old/casual slang; rare but exists |
| "22ribu" | Rp 22.000 | Written-out "ribu" |
| "dua ratus rb" | Rp 200.000 | Spelled-out number + abbreviation |

---

## Feature Dependencies

```
/prediksi (next-month prediction)
    └──requires──> Expense Storage (3+ months of history preferred, 30 days minimum)
    └──requires──> Category Totals Per Month (aggregation layer)
    └──requires──> Fixed/Variable Classification (Claude prompt reasoning)
    └──enhances──> /rekap (same data, forward-looking view)

Savings Suggestion
    └──requires──> /prediksi (discretionary spend estimate)
    └──requires──> Month-over-month variance data (3 months preferred)

Fixed/Variable Classification
    └──requires──> Historical category spend (≥2 months to compute variance)
    └──enhances──> /prediksi (makes prediction narrative richer)

Category Variance Callout
    └──requires──> 2+ months per category
    └──enhances──> /prediksi narrative

Natural Language Input
    └──requires──> Claude NLP Integration
                       └──requires──> Indonesian Amount Slang Parser (in Claude prompt)

Budget Warning
    └──requires──> Budget Setting
    └──requires──> Expense Storage (to aggregate vs. budget)

Weekly Auto-Digest
    └──requires──> Expense Storage (enough history)
    └──requires──> Cron/Scheduler
```

### Dependency Notes

- **/prediksi requires aggregated monthly totals per category:** The storage layer must support summing expenses by category and by month. This is an aggregation operation on the existing JSON storage, not a schema change.
- **Savings suggestion is downstream of prediction:** Can't suggest savings without the predicted discretionary baseline. They ship together or prediction ships first.
- **Fixed/variable classification requires 2+ months:** With only 1 month of data, there's no variance to compute. Claude can infer from category name alone (kost = fixed) but variance-based classification needs history.
- **All v1.1 features share the same data dependency:** The blocker is user history, not code complexity. If a user has logged data for 30+ days, all three features become available simultaneously.

---

## MVP Definition

### v1.1 Launch With

Minimum viable to ship behavioral intelligence that's actually useful.

- [ ] `/prediksi` command with 30-day history guard — without the guard, misleading predictions erode trust
- [ ] Per-category spend estimate (3-month weighted average or all available months if <3) — per-category mirrors /rekap and is the mental model users already have
- [ ] Fixed vs. variable labeling in prediction output — makes the prediction scannable and actionable ("fixed costs gak akan turun, yang bisa dihemat adalah...")
- [ ] Savings headroom suggestion — the "so what?" answer; without it, prediction is just a number with no action
- [ ] Claude-narrated output in bot personality — same voice as the rest of the bot; data without narrative is a spreadsheet

### Add After Validation (v1.2)

Add once prediction is shipping and users are engaging with it.

- [ ] Category variance callout ("transport kamu naik 40% bulan ini") — requires 2+ months; adds depth to prediction
- [ ] Prediction accuracy retrospective ("bulan lalu gue prediksi 800rb, ternyata kamu habis 920rb") — needs prediction storage; validate user appetite first
- [ ] Intra-month warning ("udah hari ke-15 dan kamu udah 60% dari prediksi bulan ini") — proactive mid-month nudge

### Future Consideration (v2+)

Defer until product-market fit is established with v1.1.

- [ ] Weekly spending pattern detection ("kamu biasanya boros di weekend") — needs weekly bucketing + multi-month history; significant aggregation work
- [ ] "What if" scenario modeling — requires interactive Telegram conversation state; complex UX
- [ ] Seasonality detection (Lebaran, year-end) — needs 12+ months of data; not viable until significant user tenure
- [ ] ML-powered prediction — only justified if simple averages demonstrably underperform; premature optimization for current scale

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `/prediksi` — next-month estimate by category | HIGH | MEDIUM | P1 |
| Fixed vs. variable labeling | HIGH | LOW (Claude prompt) | P1 |
| Savings headroom suggestion | HIGH | MEDIUM | P1 |
| History guard (30-day minimum) | HIGH | LOW | P1 |
| Claude narrative delivery | HIGH | LOW (same system) | P1 |
| Category variance callout | MEDIUM | MEDIUM | P2 |
| Prediction accuracy retrospective | MEDIUM | MEDIUM | P2 |
| Intra-month prediction warning | MEDIUM | MEDIUM | P2 |
| Weekly spending patterns | LOW | HIGH | P3 |
| What-if scenarios | LOW | HIGH | P3 |
| Seasonality detection | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Cleo AI | YNAB | Rocket Money | Mixxy Approach |
|---------|---------|------|--------------|----------------|
| Spend prediction | Yes — AI predicts upcoming expenses, warns of overdraft risk | Rolling budget carryover + historical analysis | Shows estimated monthly spend from last 3 months | Per-category estimate via weighted average; Claude narrates |
| Fixed vs. variable | Implicitly (recurring vs. non-recurring) | Rule-based budget categories | Recurring vs. non-recurring bills | Claude classifies from category + variance; no separate system |
| Savings suggestion | Yes — analyzes "frugal windows" to suggest transfer amounts | Assigned money model (zero-based budgeting) | Budget vs. actual comparison | Discretionary variance gap as savings target; Claude suggests |
| Language | English only | English only | English only | Casual Bahasa Indonesia — first-class |
| Minimum data needed | Bank sync (instant history) | Manual entry from day 1 | Bank sync (instant history) | 30 days minimum; 3 months for reliable prediction |
| Delivery | Mobile app push notification | Mobile app | Mobile app | Telegram command — same channel as all other interactions |
| Personality | Roast mode, casual | Neutral, educational | Neutral | Cleo-style roast adapted for Indonesian cultural humor |

---

## Sources

- Cleo AI product research: web search 2026-03-18 — meetcleo.com; features confirmed via multiple review sources (thepennyhoarder.com, moneycrashers.com, theeverygirl.com) — MEDIUM confidence (no direct API docs; feature set from user reviews and official blog)
- Forecasting methodology: otexts.com/fpp2 (Forecasting: Principles and Practice) — HIGH confidence academic reference for moving average methodology
- Data requirements for forecasting: anamind.com, oracle.com EPM docs — MEDIUM confidence; "at least 2x the forecast horizon in history" aligns with industry standard
- Fixed vs. variable expense taxonomy: NerdWallet, Bankrate, Rocket Money (rocketmoney.com) — HIGH confidence; standard personal finance taxonomy
- Savings suggestion approach: Cleo AI blog (web.meetcleo.com) — MEDIUM confidence; conceptual description, not technical implementation
- Personal finance app UX expectations 2025: wildnetedge.com, diceus.com — MEDIUM confidence; secondary sources but consistent with primary research
- Indonesian expense categories and behavior: training data + v1.0 research — MEDIUM confidence; validate with Indonesian users before v2

---

*Feature research for: Personal finance Telegram bot, Indonesian market (Mixxy)*
*Updated: 2026-03-18 — v1.1 Behavioral Intelligence / Spend Prediction additions*
