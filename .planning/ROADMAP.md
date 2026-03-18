# Roadmap: Mixxy

## Overview

Mixxy is built in phases that follow its dependency graph. Phases 1-3 (v1.0) are complete. Phase 1 established the runnable bot skeleton and storage layer. Phase 2 proved the core expense logging hypothesis. Phase 3 completed v1 commands, summaries, budgeting, and weekly digest.

The v1.1 milestone adds behavioral intelligence in two phases. Phase 4 builds the pure-JS prediction data layer — aggregation, history gate, and sparsity handling — testable in isolation before any Claude call. Phase 5 adds Claude-powered fixed/variable classification, savings headroom suggestion, and wires the `/prediksi` command into the live bot. No new dependencies are needed; both phases build on patterns already proven in `summary.js`, `claude.js`, and `budget.js`.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Runnable bot skeleton, concurrency-safe JSON storage, project scaffolding (completed 2026-03-17)
- [x] **Phase 2: Core Expense Loop** - Natural language expense logging with Claude, personality, /hapus (completed 2026-03-17)
- [x] **Phase 3: Commands and Reporting** - /rekap, /budget with alerts, /start, /help, weekly auto-digest (completed 2026-03-18)
- [x] **Phase 4: Prediction Engine** - Pure-JS computation layer: history gate, per-category weighted averages, sparsity detection (completed 2026-03-18)
- [ ] **Phase 5: Classification and Command Delivery** - Fixed/variable classification via Claude, savings suggestion, /prediksi wired and shipped

## Phase Details

### Phase 1: Foundation
**Goal**: A runnable Telegram bot exists with correct storage infrastructure — ready for Claude integration without risk of data corruption or polling conflicts
**Depends on**: Nothing (first phase)
**Requirements**: (no v1 requirements directly — delivers the substrate all features write into)
**Success Criteria** (what must be TRUE):
  1. Running `node index.js` starts the bot without errors and it responds to any message with a placeholder reply
  2. Sending the same message twice in quick succession does not produce duplicate bot responses (polling guard works)
  3. A user expense written to storage appears in the correct per-user JSON file under `data/` and survives a process restart
  4. Concurrent writes from two simulated users do not corrupt either user's data file
  5. `.env.example` exists with `TELEGRAM_TOKEN` and `ANTHROPIC_API_KEY`; `.env` is gitignored
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffolding, storage module with concurrency-safe writes, and storage tests
- [x] 01-02-PLAN.md — Bot entry point with polling and dedup guard, Phase 2 stub files

### Phase 2: Core Expense Loop
**Goal**: Users can log expenses in natural Bahasa Indonesia and the bot correctly parses, categorizes, stores, and confirms each one — with personality and delete capability
**Depends on**: Phase 1
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CATEG-01, PERS-01, PERS-02, BOT-03
**Success Criteria** (what must be TRUE):
  1. User types "tadi makan siang 35rb" and bot replies with a short Bahasa Indonesia confirmation showing the correct amount (35.000), category (makan), and description — no manual parsing by the user
  2. Indonesian amount slang variants ("22ribu", "1.5jt", "dua ratus ribu", "35K") are all parsed correctly to their IDR values
  3. User types "/hapus" and the most recently logged expense is removed; bot confirms in Bahasa Indonesia
  4. Bot responses use "kamu", are 1-3 sentences max, and feel like a text from a friend (not a form confirmation)
  5. When a user's spending in a category is noticeably high, the bot includes a light roast in its confirmation reply (Claude decides when — not every message)
  6. Sending an off-topic message (e.g., "siapa presiden Indonesia?") gets a friendly redirect back to expense logging, not a general answer
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Claude integration: system prompt, tool schema, processMessage with TDD tests
- [x] 02-02-PLAN.md — Bot wiring: /hapus routing, Claude message handler, end-to-end verification

### Phase 3: Commands and Reporting
**Goal**: The complete v1 feature set is live — users can view summaries, set budgets with alerts, get onboarded, and receive a weekly digest every Sunday
**Depends on**: Phase 2
**Requirements**: CATEG-02, SUMM-01, SUMM-02, SUMM-03, SUMM-04, SUMM-05, BUDG-01, BUDG-02, BUDG-03, BUDG-04, BOT-01, BOT-02
**Success Criteria** (what must be TRUE):
  1. User types "/rekap" or "pengeluaran bulan ini berapa?" and receives a summary of this month's expenses by category with a Claude-generated insight — not just raw totals
  2. User types "/budget 500000" to set a budget; after logging expenses that bring them to 80% of that limit, the bot warns them; at 100% the bot notifies them with a light roast
  3. User types "/start" on first use and receives an onboarding message with concrete Bahasa Indonesia examples of how to log expenses
  4. User types "/help" and sees all available commands with short Bahasa Indonesia descriptions
  5. Every Sunday at 10:00 WIB the bot proactively sends each user a weekly spending digest with Claude-generated suggestions — users who have blocked the bot do not crash the cron job
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md — summary.js new module + storage meta (readMeta/writeMeta)
- [x] 03-02-PLAN.md — prompts.js REKAP_TOOL + claude.js intent extension
- [x] 03-03-PLAN.md — budget.js threshold logic + formatBudgetProgress
- [x] 03-04-PLAN.md — index.js full wiring (commands, routing, alerts, cron) + human verify
- [x] 03-05-PLAN.md — per-category /budget command

### Phase 4: Prediction Engine
**Goal**: A pure-JS `predict.js` module correctly aggregates expense history into per-category projections — with a 30-day history gate, weighted 3-month averaging, and sparse-category detection — before any Claude call is made
**Depends on**: Phase 3
**Requirements**: PRED-02, PRED-03, PRED-04
**Success Criteria** (what must be TRUE):
  1. Calling `buildPrediction(userId)` for a user with fewer than 30 days of history returns a structured result indicating insufficient data — no projection is generated
  2. Given known fixture data across 3 calendar months, `buildPrediction()` returns per-category estimates matching the expected weighted average (42%/33%/25% recency weighting) to within rounding
  3. A category that appears on fewer than 3 distinct transaction days across the history window returns `"kurang data"` instead of a numeric estimate
  4. Unit tests covering all three behaviors pass with zero Anthropic API calls (pure JS, no Claude dependency in this phase)
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — TDD: predict.js with history gate, weighted averages, and sparsity detection

### Phase 5: Classification and Command Delivery
**Goal**: The `/prediksi` command is live — users get a full next-month spend prediction per category, each labeled fixed or variable, with a savings headroom suggestion and hedged language, backed by Claude classification
**Depends on**: Phase 4
**Requirements**: PRED-01, PRED-05, PRED-06, PRED-07
**Success Criteria** (what must be TRUE):
  1. User types "/prediksi" and receives a per-category prediction listing, each category labeled as "tetap" or "variabel", expressed with hedged language ("kira-kira", "sekitar") and showing how many months of data were used
  2. The prediction includes a savings headroom suggestion that names a specific variable category and quotes JS-computed figures (min, max, average) — Claude does not invent numbers
  3. User types "/prediksi" with fewer than 30 days of history and receives a friendly Bahasa Indonesia explanation that more data is needed — not an error message and not a prediction
  4. "/help" output lists "/prediksi" with a short Bahasa Indonesia description alongside existing commands
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — PREDICT_CLASSIFY_TOOL + classifyPrediction + _formatPrediction with tests
- [ ] 05-02-PLAN.md — /prediksi command wiring in index.js + HELP_MESSAGE update

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-03-17 |
| 2. Core Expense Loop | 2/2 | Complete | 2026-03-17 |
| 3. Commands and Reporting | 5/5 | Complete | 2026-03-18 |
| 4. Prediction Engine | 1/1 | Complete   | 2026-03-18 |
| 5. Classification and Command Delivery | 1/2 | In Progress|  |
