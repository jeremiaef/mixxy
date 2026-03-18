# Mixxy — Telegram Finance Bot (Bahasa Indonesia)

## What This Is

A Telegram bot finance assistant built for Indonesian users, inspired by Cleo AI. Users can report expenses conversationally in natural Bahasa Indonesia ("tadi makan siang 35rb"), and the bot — powered by Claude AI — understands, categorizes, and tracks their spending. It's a casual finance buddy, not a formal app.

## Core Value

Users can track expenses as naturally as texting a friend, in their own language, without opening any app or filling in any form.

## Requirements

### Validated

- ✓ User can report expenses via natural language in Bahasa Indonesia — v1.0 Phase 2
- ✓ Claude AI extracts amount, category, and description from free-text expense input — v1.0 Phase 2
- ✓ Bot auto-categorizes expenses (food, transport, entertainment, bills, etc.) — v1.0 Phase 2
- ✓ User can request expense summaries ("rekap minggu ini", "pengeluaran bulan ini berapa?") — v1.0 Phase 3
- ✓ Weekly auto-summary sent every Sunday with insights and suggestions (Claude-generated) — v1.0 Phase 3
- ✓ User can set a monthly budget and get warned when approaching the limit — v1.0 Phase 3
- ✓ /start command with onboarding message — v1.0 Phase 3
- ✓ /rekap command for this month's expense summary — v1.0 Phase 3
- ✓ /budget command to set or view monthly budget (global + per-category) — v1.0 Phase 3
- ✓ /hapus command to delete the last entry — v1.0 Phase 2
- ✓ /help command showing available commands — v1.0 Phase 3
- ✓ Bot personality: casual Bahasa Indonesia, uses "kamu", short responses, light Cleo-style roast when overspending — v1.0 Phase 2
- ✓ Storage: per-user JSON files keyed by Telegram user ID — v1.0 Phase 1
- ✓ .env.example with TELEGRAM_TOKEN and ANTHROPIC_API_KEY — v1.0 Phase 1

### Active

## Current Milestone: v1.1 Behavioral Intelligence

**Goal:** Add forward-looking spending intelligence — predict next month's expenses by category from logged history, helping users prepare rather than just review.

**Target features:**
- `/prediksi` command: predict next month's spend per category (requires ≥30 days history)
- Fixed vs. variable category classification (Claude-powered)
- Savings target suggestion based on discretionary spend variance

### Out of Scope

- Database (SQL/NoSQL) — keeping JSON file storage for MVP, validate before scaling
- OAuth or account system — Telegram user ID is identity
- Mobile/web app — Telegram-only for MVP
- Multi-currency support — IDR only for now
- Receipt scanning / image input — text-only for MVP
- Full "anda"-style formal mode — always casual

## Context

- Node.js project, uses `node-telegram-bot-api` for Telegram integration
- Claude API (Anthropic) as the AI brain for NLP and summary generation
- JSON file storage under a `data/` directory, one file per user ID
- Clean 4-file structure: `index.js`, `claude.js`, `storage.js`, `prompts.js`
- User will start as sole user, then validate with others — so multi-user architecture is needed from the start
- Roast mode is always active — Claude decides when spending warrants a light joke
- Indonesian slang for amounts is common: "35rb" = 35.000 IDR, "22ribu" = 22.000 IDR — Claude must handle this

## Constraints

- **Tech Stack**: Node.js, node-telegram-bot-api, Anthropic Claude API — no framework changes for MVP
- **Storage**: JSON files only — no database until user count justifies it
- **Language**: All user-facing text in Bahasa Indonesia (casual register)
- **Response style**: Short — no long paragraphs, like texting a friend
- **Claude scope**: Finance buddy only — system prompt must prevent general assistant behavior

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Per-user JSON files keyed by Telegram ID | Simple, multi-user-ready without a database | — Pending |
| Claude handles all NLP (expense parsing + summary) | Avoids custom regex/NLP logic, leverages LLM strength | — Pending |
| Roast mode always-on (Claude decides when to apply) | Matches Cleo UX, simpler than user toggle for MVP | — Pending |
| IDR only, amount slang handled by Claude | Core market is Indonesian, Claude handles "35rb" natively | — Pending |

---
*Last updated: 2026-03-18 after v1.1 milestone start*
