# Mixxy — Telegram Finance Bot (Bahasa Indonesia)

## What This Is

A Telegram bot finance assistant built for Indonesian users, inspired by Cleo AI. Users can report expenses conversationally in natural Bahasa Indonesia ("tadi makan siang 35rb"), and the bot — powered by Claude AI — understands, categorizes, and tracks their spending. It's a casual finance buddy, not a formal app.

## Core Value

Users can track expenses as naturally as texting a friend, in their own language, without opening any app or filling in any form.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can report expenses via natural language in Bahasa Indonesia (e.g. "tadi makan siang 35rb", "bayar grab 22ribu")
- [ ] Claude AI extracts amount, category, and description from free-text expense input
- [ ] Bot auto-categorizes expenses (food, transport, entertainment, bills, etc.)
- [ ] User can request expense summaries ("rekap minggu ini", "pengeluaran bulan ini berapa?")
- [ ] Weekly auto-summary sent every Sunday with insights and suggestions (Claude-generated)
- [ ] User can set a monthly budget and get warned when approaching the limit
- [ ] /start command with onboarding message
- [ ] /rekap command for this month's expense summary
- [ ] /budget command to set or view monthly budget
- [ ] /hapus command to delete the last entry
- [ ] /help command showing available commands
- [ ] Bot personality: casual Bahasa Indonesia, uses "kamu", short responses, light Cleo-style roast when overspending (always-on, bot decides when to apply)
- [ ] Storage: per-user JSON files keyed by Telegram user ID (supports single user now, multi-user later)
- [ ] .env.example with TELEGRAM_TOKEN and ANTHROPIC_API_KEY

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
*Last updated: 2026-03-17 after initialization*
