# Requirements: Mixxy

**Defined:** 2026-03-17
**Core Value:** Users can track expenses as naturally as texting a friend, in Bahasa Indonesia, without opening any app

## v1 Requirements

### Core Expense Logging

- [x] **CORE-01**: User can log an expense by typing naturally in Bahasa Indonesia (e.g. "tadi makan siang 35rb", "bayar grab 22ribu")
- [x] **CORE-02**: Claude extracts amount, category, and description from free-text input via tool_use API — including Indonesian amount slang (35rb, 1.5jt, 22ribu, dua ratus ribu)
- [x] **CORE-03**: Bot replies with a short confirmation in casual Bahasa Indonesia after each logged expense
- [x] **CORE-04**: User can delete the last logged expense via /hapus command

### Categorization

- [x] **CATEG-01**: Bot auto-categorizes every expense into one of the Indonesian-appropriate categories: makan, transport, hiburan, tagihan, kost, pulsa, ojol, jajan, lainnya
- [x] **CATEG-02**: User can set a monthly budget limit per category via /budget

### Personality

- [x] **PERS-01**: All bot responses use casual Bahasa Indonesia — "kamu" not "anda", short replies, texting-friend register
- [x] **PERS-02**: Bot applies light Cleo-style humor (roast mode) when user overspends — Claude decides when to add humor, always-on

### Summaries & Reporting

- [x] **SUMM-01**: User can request current month expense summary via /rekap command
- [x] **SUMM-02**: User can request summaries via natural language (e.g. "rekap bulan ini", "pengeluaran bulan ini berapa?")
- [x] **SUMM-03**: User can request weekly summary via natural language (e.g. "rekap minggu ini")
- [x] **SUMM-04**: Bot auto-sends a weekly spending digest every Sunday (03:00 UTC / 10:00 WIB) via cron
- [x] **SUMM-05**: Summaries include Claude-generated insights and suggestions (not just raw totals)

### Budget Alerts

- [x] **BUDG-01**: User can set a monthly budget via /budget command
- [x] **BUDG-02**: User can view current budget and spending progress via /budget
- [x] **BUDG-03**: Bot warns user when 80% of monthly budget is reached
- [x] **BUDG-04**: Bot notifies user when monthly budget is exceeded (100%), with light roast

### Bot Commands & Onboarding

- [x] **BOT-01**: /start command delivers onboarding message with concrete examples of how to log expenses in Bahasa Indonesia
- [x] **BOT-02**: /help command lists all available commands with short descriptions in Bahasa Indonesia
- [x] **BOT-03**: Bot handles off-topic or unclear messages gracefully — redirects back to finance context without being rude

## v1.1 Requirements

### Prediction

- [ ] **PRED-01**: User can request next-month spend prediction via /prediksi command
- [x] **PRED-02**: /prediksi requires ≥30 days of expense history — returns a friendly explanation (not a prediction) if history is insufficient
- [x] **PRED-03**: Prediction shows estimated spend per category for next month, computed from a weighted 3-month average (all arithmetic in JS, not Claude)
- [x] **PRED-04**: Categories with fewer than 3 transaction days show "kurang data" instead of an estimate
- [x] **PRED-05**: Each category in the prediction is labeled as fixed (tetap) or variable (variabel) via Claude classification
- [x] **PRED-06**: Prediction includes a savings headroom suggestion for the highest-variance variable category, grounded in JS-computed variance
- [x] **PRED-07**: All prediction output uses hedged language ("kira-kira", "sekitar", "berdasarkan X bulan terakhir") and shows how many months of data were used

## v2 Requirements

### Advanced Reporting

- **REPT-01**: User can filter summaries by category ("rekap transport bulan ini")
- **REPT-02**: User can compare spending between periods ("bulan ini vs bulan lalu")
- **REPT-03**: User can export expense history as CSV

### Notifications

- **NOTF-01**: User can configure which alerts they receive (opt-out of 80% warning, etc.)
- **NOTF-02**: Daily spending streak or milestone nudges

### Data & Storage

- **DATA-01**: Migrate from JSON file storage to SQLite or PostgreSQL
- **DATA-02**: Backup/restore user data

## Out of Scope

| Feature | Reason |
|---------|--------|
| Receipt / image OCR | Validate text friction is real before adding image complexity |
| Bank/e-wallet sync (GoPay, OVO, DANA) | Indonesian Open Banking not ready; screen-scraping is fragile |
| Multi-currency | IDR only for MVP — Indonesian-first product |
| Web dashboard | Breaks Telegram-only simplicity; validate demand before building |
| Shared / family tracking | Requires full data model rethink; validate single-user first |
| Savings goals | Separate product surface; expense tracking must prove retention first |
| OAuth / account system | Telegram user ID is identity — no separate auth needed |
| Formal Bahasa Indonesia ("anda") | Always casual — this is a design constraint, not a missing feature |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 2 | Complete |
| CORE-02 | Phase 2 | Complete |
| CORE-03 | Phase 2 | Complete |
| CORE-04 | Phase 2 | Complete |
| CATEG-01 | Phase 2 | Complete |
| CATEG-02 | Phase 3 | Complete |
| PERS-01 | Phase 2 | Complete |
| PERS-02 | Phase 2 | Complete |
| SUMM-01 | Phase 3 | Complete |
| SUMM-02 | Phase 3 | Complete |
| SUMM-03 | Phase 3 | Complete |
| SUMM-04 | Phase 3 | Complete |
| SUMM-05 | Phase 3 | Complete |
| BUDG-01 | Phase 3 | Complete |
| BUDG-02 | Phase 3 | Complete |
| BUDG-03 | Phase 3 | Complete |
| BUDG-04 | Phase 3 | Complete |
| BOT-01 | Phase 3 | Complete |
| BOT-02 | Phase 3 | Complete |
| BOT-03 | Phase 2 | Complete |
| PRED-02 | Phase 4 | Complete |
| PRED-03 | Phase 4 | Complete |
| PRED-04 | Phase 4 | Complete |
| PRED-01 | Phase 5 | Pending |
| PRED-05 | Phase 5 | Complete |
| PRED-06 | Phase 5 | Complete |
| PRED-07 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 20 total — mapped to phases: 20 — unmapped: 0
- v1.1 requirements: 7 total — mapped to phases: 7 — unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-18 after v1.1 roadmap creation (phases 4-5)*
