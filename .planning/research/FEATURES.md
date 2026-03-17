# Feature Research

**Domain:** Personal finance Telegram bot — Bahasa Indonesia, Indonesian market
**Researched:** 2026-03-17
**Confidence:** MEDIUM (web search unavailable; based on training data through Aug 2025 — Indonesian market specifics require validation)

---

## Research Notes

Web search tools were unavailable during this research session. Findings are drawn from training data on:
- Cleo AI (UK/US product, heavy Telegram/chat-based finance analogue)
- Personal finance apps popular in Indonesia: Jenius, Spendee, Money Manager, Finansialku
- Indonesian digital payment ecosystem: GoPay, OVO, DANA, ShopeePay, LinkAja
- General chatbot UX patterns for conversational finance

Confidence per section is noted inline. Indonesian market specifics are MEDIUM confidence and should be validated with real Indonesian users before v2 feature decisions.

---

## Feature Landscape

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

Features that set the product apart from generic expense trackers.

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

Features that seem useful but create problems at MVP stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Receipt scanning / OCR | "I want to just photo my receipt" | Requires image processing pipeline, STRUK format varies wildly, adds latency and cost; not essential when voice-style text input is fast | Keep text input; users who want receipt scanning have higher friction tolerance — defer to v2 |
| Bank account sync / bank statement import | "Auto import from BCA/Mandiri/GoPay" | Indonesian Open Banking is nascent; no standardized API; screen-scraping is fragile and risky; adds massive compliance surface | Let users self-report; manual input is the feature |
| Web dashboard / data visualization | "I want to see charts" | Full web app is a separate product; breaks the "Telegram only" constraint; adds auth complexity | Telegram's inline charts (if ever needed) or ASCII-style summaries in bot responses |
| Multi-currency support | "I sometimes spend in SGD or USD" | Adds parsing ambiguity; exchange rate dependency; most Indonesian daily spending is IDR only | IDR only for MVP; flag as v2 if users in border cities or travelers request it |
| Export to Excel/CSV | "I want a spreadsheet" | Creates data pipeline maintenance; most users who ask don't actually use exports | Defer; summary text in chat satisfies 90% of use cases |
| Category editing / custom categories | "I want to add my own categories" | Category management UI is complex; users rarely maintain custom systems | Pre-define an Indonesian-appropriate category list; let Claude infer intelligently |
| Shared/family expense tracking | "I want to share with my spouse" | Multi-user data model, reconciliation logic, trust/privacy concerns — a separate product | Single-user only for MVP; Telegram groups could be a future approach |
| Savings goals | "I want to save for X" | Goal tracking requires positive-side data entry; doubles the UX complexity | Out of scope for expense-tracker MVP; add in v2 if users ask |
| Formal "anda" mode / language toggle | "Some users prefer formal Indonesian" | Splits personality, splits prompt engineering, adds config complexity | Always casual ("kamu"); define this in initial onboarding so users self-select |

---

## Indonesian-Specific Considerations

### Common Expense Categories (Indonesian Context)

These differ meaningfully from Western defaults like "Groceries", "Dining", "Utilities":

| Category | Indonesian Term(s) | Common Subcases | Notes |
|----------|-------------------|-----------------|-------|
| Makanan & Minuman | Makan, minum, jajan, kopi | GoFood, GrabFood, warung, kafe, warteg | Highest frequency; must be top category |
| Transportasi | Grab, Gojek, ojol, bensin, tol, parkir, KRL, TransJakarta | Ride-hailing dominant in cities | "Ojol" (ojek online) is a distinct mental model |
| Kost / Sewa | Kost, kontrakan, sewa | Monthly payment, common among young adults | High value, monthly — important for budget context |
| Belanja | Tokopedia, Shopee, belanja online, pasar, minimarket | Indomaret, Alfamart very common | Split from "groceries" — includes lifestyle shopping |
| Pulsa & Internet | Pulsa, paket data, wifi | Top-up behavior is frequent, small amounts | "Pulsa" is a distinct mental category; not "utilities" |
| Tagihan | Listrik, air, BPJS, kartu kredit, cicilan | BPJS (national health insurance) is uniquely Indonesian | Infrequent but high value |
| Hiburan | Bioskop, Netflix, game, karaoke, nongkrong | Spending on socializing ("nongkrong") is culturally significant | |
| Kesehatan | Apotik, dokter, obat, BPJS non-covered | Separate from tagihan for non-routine health spend | |
| Pendidikan | Kursus, buku, les, kampus | High priority for many users | |
| Lain-lain | Hadiah, sumbangan, tak terduga | Catch-all; Claude should infer before defaulting here | |

### Indonesian Amount Slang (Must Parse Correctly)

| Input | Meaning | Notes |
|-------|---------|-------|
| "35rb" / "35k" / "35ribu" | Rp 35.000 | Most common shorthand |
| "1.5jt" / "1.5 juta" | Rp 1.500.000 | Millions common for rent, large purchases |
| "500 perak" | Rp 500 | "Perak" = rupiah in old/casual slang; rare but exists |
| "22ribu" | Rp 22.000 | Written-out "ribu" |
| "dua ratus rb" | Rp 200.000 | Spelled-out number + abbreviation |
| "gopek" | Rp 500 | Very informal slang; low priority |
| "ceban" | Rp 10.000 | Street-level slang; low priority but bonus if handled |

### Local Payment Methods (Context Signals, Not Integration)

The bot doesn't need to integrate with these, but users will mention them as context. Claude must not be confused by them:

| Mention | Meaning | What to Extract |
|---------|---------|-----------------|
| "bayar pake GoPay" | Paid via GoPay e-wallet | Just extract amount + category; payment method is metadata |
| "transfer ke OVO" | Sent money via OVO | Could be expense (paying someone) or transfer (neutral) — Claude should ask if unclear |
| "pake DANA" | Paid via DANA e-wallet | Same as GoPay pattern |
| "gesek kartu" | Paid with credit card | Extract amount only |
| "cash" / "tunai" | Cash payment | Payment method metadata only |
| "Shopee Pay" / "ShopeePay" | Shopee's e-wallet | Same as GoPay pattern |

### Indonesian User Behavior Patterns (MEDIUM confidence — validate with users)

- **WhatsApp-first mental model:** Indonesian users are highly comfortable with chat-based interaction but WhatsApp is primary; Telegram requires justification. The "no app to install" angle (using an existing Telegram account) lowers friction.
- **Short message culture:** Users expect short, punchy responses. Long paragraphs feel like a form, not a friend.
- **Screenshot culture:** Indonesians share screenshots of interesting/funny bot responses on Twitter/X, Instagram stories. Roast mode outputs should be screenshot-worthy — this is organic growth.
- **Young adults (18-30) dominate digital finance apps:** This cohort uses GoPay/OVO daily, is comfortable with AI, and is the likely primary user segment.
- **Warung economy:** Many small cash purchases at warungs, street food stalls — users need to log these quickly without friction. Text-only, no photo, is actually the right constraint.
- **Monthly kost payments:** Rent (kost) is often the largest single expense for young Indonesians; the bot must handle "1.5jt buat kost" without ambiguity.

---

## Feature Dependencies

```
Natural Language Input
    └──requires──> Claude NLP Integration
                       └──requires──> Indonesian Amount Slang Parser (in Claude prompt)

Expense Summary
    └──requires──> Expense Storage
                       └──requires──> Natural Language Input (to have data)

Budget Warning
    └──requires──> Budget Setting
    └──requires──> Expense Storage (to aggregate vs. budget)

Weekly Auto-Digest
    └──requires──> Expense Storage (enough history)
    └──requires──> Cron/Scheduler

Roast Mode
    └──enhances──> Natural Language Input (Claude decides on response)
    └──requires──> Claude NLP Integration (same call, no separate system)

Delete Last Entry
    └──requires──> Expense Storage (needs ordered log)
```

### Dependency Notes

- **Natural Language Input requires Claude NLP:** All parsing goes through Claude — there's no separate NLP pipeline to build. This is a strength (simpler architecture) and a risk (Claude API cost, latency).
- **Budget Warning requires both Budget Setting and Storage:** Can't warn without a target and without knowing current spend. Both must ship together.
- **Weekly Auto-Digest requires a scheduler:** This is the only async/background feature; needs a cron job separate from the Telegram webhook handler. Small but distinct infrastructure concern.
- **Roast Mode has no dependency overhead:** It's a Claude prompt behavior, not a separate system. Ships "for free" with the NLP integration if the system prompt is designed correctly.

---

## MVP Definition

### Launch With (v1)

Minimum viable to test "casual expense logging in Bahasa Indonesia works."

- [ ] Natural language expense input with Indonesian slang amount parsing — core hypothesis to validate
- [ ] Auto-categorization with Indonesian-appropriate categories — without this, users must re-categorize everything
- [ ] `/rekap` for current month summary — minimum reporting to see if the product is useful
- [ ] `/hapus` to delete last entry — trust safety net; without this, mis-logs accumulate and users abandon
- [ ] `/budget` to set monthly budget with warnings — gives users a reason to keep logging (goal-tracking)
- [ ] `/start` onboarding with example inputs in Bahasa Indonesia — without this, users don't know how to talk to the bot
- [ ] `/help` command — discovery; users forget what's available
- [ ] Roast mode (always-on, Claude-decided) — this IS the personality; without it, the bot is just a spreadsheet in chat
- [ ] Weekly auto-digest every Sunday — the one proactive touch; validates whether users find value in summaries

### Add After Validation (v1.x)

Add once core logging loop is working and users are retained.

- [ ] Period filtering in rekap ("rekap minggu ini", "bulan lalu") — needed when users have history; not urgent day one
- [ ] Category-specific summaries ("berapa yang aku habiskan buat makan?") — becomes valuable after 2-4 weeks of data
- [ ] Spending trend comparisons (week-over-week, month-over-month) — requires sufficient history to be meaningful
- [ ] Edit an entry (not just delete last) — once users have history they care about, correction UX matters more

### Future Consideration (v2+)

Defer until product-market fit is established.

- [ ] Receipt OCR — validate that text input friction is real before adding image complexity
- [ ] Data export (CSV/JSON) — validate that users accumulate enough data to want export
- [ ] Savings goals — separate product surface; validate that expense tracking alone retains users first
- [ ] Shared/group expenses — requires rethinking data model; validate single-user first
- [ ] Bank/e-wallet sync (GoPay, OVO) — depends on Indonesian Open Banking maturation; not viable in 2025-2026 without screen scraping
- [ ] Web dashboard with charts — only if users explicitly request it; breaks Telegram-only simplicity

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Natural language expense input | HIGH | MEDIUM | P1 |
| Indonesian slang amount parsing | HIGH | LOW (Claude prompt) | P1 |
| Auto-categorization (Indonesian categories) | HIGH | LOW (Claude prompt) | P1 |
| `/rekap` summary | HIGH | LOW | P1 |
| `/hapus` delete last | HIGH | LOW | P1 |
| `/budget` + warnings | MEDIUM | LOW | P1 |
| `/start` onboarding | HIGH | LOW | P1 |
| `/help` | MEDIUM | LOW | P1 |
| Roast mode | MEDIUM | LOW (Claude prompt) | P1 |
| Weekly auto-digest | MEDIUM | MEDIUM (scheduler) | P1 |
| Period filtering in rekap | MEDIUM | LOW | P2 |
| Category-specific queries | MEDIUM | LOW | P2 |
| Spending trend comparisons | MEDIUM | MEDIUM | P2 |
| Edit entry (not just last) | LOW | MEDIUM | P2 |
| Receipt OCR | LOW | HIGH | P3 |
| Data export | LOW | MEDIUM | P3 |
| Savings goals | LOW | HIGH | P3 |
| Bank/e-wallet sync | LOW | HIGH | P3 |
| Web dashboard | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Cleo AI (UK/US) | Jenius (Indonesian bank app) | Spendee / Money Manager | Mixxy Approach |
|---------|-----------------|------------------------------|-------------------------|----------------|
| Expense input | Bank sync (automatic) | Bank transaction auto-import | Manual entry + receipt scan | Natural language text in Telegram — no app needed |
| Language | English only | Bahasa Indonesia (formal) | English / multi-language | Casual Bahasa Indonesia — first-class |
| Personality | Roast mode, funny, Gen Z tone | Professional, formal | Neutral/functional | Cleo-style roast adapted for Indonesian cultural humor |
| Categorization | AI + bank merchant data | Bank-side category mapping | Manual + AI suggestion | Claude AI inference from free text |
| Reporting | Rich charts, web + mobile app | Bank statement view | Charts, CSV export | Text summaries in Telegram — intentionally minimal |
| Platform | Mobile app (iOS/Android) | Mobile app (bank app) | Mobile app | Telegram only — zero install friction |
| Budget alerts | Yes | Yes | Yes | Yes — on every expense log |
| Proactive digest | Weekly email | Bank statement | Push notification | Weekly Telegram message — same channel as use |
| Indonesian amounts | N/A (GBP/USD) | Handled (IDR native) | IDR option, no slang | "35rb", "1.5jt" — native slang parsing |
| Local payment context | N/A | GoPay/OVO in bank app | N/A | Claude understands e-wallet mentions as context |

---

## Sources

- Cleo AI product knowledge: training data through Aug 2025; features described are HIGH confidence for core functionality (expense tracking, roast mode, budget setting, weekly digest) — **verify current feature set at meetcleo.com**
- Indonesian personal finance market: training data through Aug 2025; MEDIUM confidence — Indonesian e-wallet ecosystem (GoPay, OVO, DANA, ShopeePay, LinkAja) is well-documented; user behavior patterns are MEDIUM confidence and should be validated with Indonesian users
- Jenius (BTPN digital bank): HIGH confidence for feature set as of 2024; Indonesian-native banking app
- Indonesian amount slang: HIGH confidence — "rb" (ribu), "jt" (juta) are universally used; street slang like "ceban" / "gopek" is LOW confidence on frequency
- Indonesian expense categories: MEDIUM confidence — derived from common Indonesian spending patterns; should be validated by surveying target users

---

*Feature research for: Personal finance Telegram bot, Indonesian market (Mixxy)*
*Researched: 2026-03-17*
