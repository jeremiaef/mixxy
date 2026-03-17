# Requirements: Mixxy

**Defined:** 2026-03-17
**Core Value:** Users can track expenses as naturally as texting a friend, in Bahasa Indonesia, without opening any app

## v1 Requirements

### Core Expense Logging

- [x] **CORE-01**: User can log an expense by typing naturally in Bahasa Indonesia (e.g. "tadi makan siang 35rb", "bayar grab 22ribu")
- [x] **CORE-02**: Claude extracts amount, category, and description from free-text input via tool_use API — including Indonesian amount slang (35rb, 1.5jt, 22ribu, dua ratus ribu)
- [x] **CORE-03**: Bot replies with a short confirmation in casual Bahasa Indonesia after each logged expense
- [ ] **CORE-04**: User can delete the last logged expense via /hapus command

### Categorization

- [x] **CATEG-01**: Bot auto-categorizes every expense into one of the Indonesian-appropriate categories: makan, transport, hiburan, tagihan, kost, pulsa, ojol, jajan, lainnya
- [ ] **CATEG-02**: User can set a monthly budget limit per category via /budget

### Personality

- [x] **PERS-01**: All bot responses use casual Bahasa Indonesia — "kamu" not "anda", short replies, texting-friend register
- [x] **PERS-02**: Bot applies light Cleo-style humor (roast mode) when user overspends — Claude decides when to add humor, always-on

### Summaries & Reporting

- [ ] **SUMM-01**: User can request current month expense summary via /rekap command
- [ ] **SUMM-02**: User can request summaries via natural language (e.g. "rekap bulan ini", "pengeluaran bulan ini berapa?")
- [ ] **SUMM-03**: User can request weekly summary via natural language (e.g. "rekap minggu ini")
- [ ] **SUMM-04**: Bot auto-sends a weekly spending digest every Sunday (03:00 UTC / 10:00 WIB) via cron
- [ ] **SUMM-05**: Summaries include Claude-generated insights and suggestions (not just raw totals)

### Budget Alerts

- [ ] **BUDG-01**: User can set a monthly budget via /budget command
- [ ] **BUDG-02**: User can view current budget and spending progress via /budget
- [ ] **BUDG-03**: Bot warns user when 80% of monthly budget is reached
- [ ] **BUDG-04**: Bot notifies user when monthly budget is exceeded (100%), with light roast

### Bot Commands & Onboarding

- [ ] **BOT-01**: /start command delivers onboarding message with concrete examples of how to log expenses in Bahasa Indonesia
- [ ] **BOT-02**: /help command lists all available commands with short descriptions in Bahasa Indonesia
- [x] **BOT-03**: Bot handles off-topic or unclear messages gracefully — redirects back to finance context without being rude

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
| CORE-04 | Phase 2 | Pending |
| CATEG-01 | Phase 2 | Complete |
| CATEG-02 | Phase 3 | Pending |
| PERS-01 | Phase 2 | Complete |
| PERS-02 | Phase 2 | Complete |
| SUMM-01 | Phase 3 | Pending |
| SUMM-02 | Phase 3 | Pending |
| SUMM-03 | Phase 3 | Pending |
| SUMM-04 | Phase 3 | Pending |
| SUMM-05 | Phase 3 | Pending |
| BUDG-01 | Phase 3 | Pending |
| BUDG-02 | Phase 3 | Pending |
| BUDG-03 | Phase 3 | Pending |
| BUDG-04 | Phase 3 | Pending |
| BOT-01 | Phase 3 | Pending |
| BOT-02 | Phase 3 | Pending |
| BOT-03 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation*
