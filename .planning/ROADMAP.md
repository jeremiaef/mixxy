# Roadmap: Mixxy

## Overview

Mixxy is built in three phases that follow its dependency graph. Phase 1 establishes the runnable bot skeleton and concurrency-safe storage layer — the foundation everything else writes into. Phase 2 proves the core product hypothesis: that natural language expense logging in Bahasa Indonesia works reliably end-to-end. Phase 3 completes v1 by adding all commands, summaries, budgeting, and the weekly auto-digest. Nothing in Phase 3 can be trusted if Phase 2 is fragile, and Phase 2 cannot write safely without Phase 1.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Runnable bot skeleton, concurrency-safe JSON storage, project scaffolding (completed 2026-03-17)
- [ ] **Phase 2: Core Expense Loop** - Natural language expense logging with Claude, personality, /hapus
- [ ] **Phase 3: Commands and Reporting** - /rekap, /budget with alerts, /start, /help, weekly auto-digest

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
- [ ] 02-01-PLAN.md — Claude integration: system prompt, tool schema, processMessage with TDD tests
- [ ] 02-02-PLAN.md — Bot wiring: /hapus routing, Claude message handler, end-to-end verification

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
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-17 |
| 2. Core Expense Loop | 1/2 | In Progress|  |
| 3. Commands and Reporting | 0/TBD | Not started | - |
