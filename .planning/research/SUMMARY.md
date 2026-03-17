# Project Research Summary

**Project:** Mixxy — Telegram Finance Bot (Bahasa Indonesia)
**Domain:** Conversational personal finance assistant; Telegram bot with Claude AI backend; Indonesian market
**Researched:** 2026-03-17
**Confidence:** MEDIUM

## Executive Summary

Mixxy is a Telegram bot that lets Indonesian users log personal expenses in casual Bahasa Indonesia ("tadi makan 35rb") and get AI-generated spending insights. The category of product — a chat-native finance assistant — is well-understood, with Cleo AI as the closest Western analogue. The recommended build approach is a minimal 4-file Node.js application: `index.js` (routing), `claude.js` (all AI calls), `storage.js` (per-user JSON files), and `prompts.js` (all prompt strings). Claude handles 100% of NLP via the Anthropic `tool_use` API for structured expense extraction — there is no custom NLP pipeline. The Indonesian-language and slang-amount context (rb/ribu/jt/juta) is injected entirely through the system prompt.

The recommended stack is lean and appropriate: Node.js 22 LTS, `node-telegram-bot-api` with polling (no webhook setup needed for MVP), `@anthropic-ai/sdk`, `zod` for schema validation, `date-fns` for date arithmetic, and `node-cron` for the Sunday auto-digest. Using `claude-3-5-haiku` for per-message expense parsing keeps latency low and cost manageable. The architecture keeps the AI layer stateless: `claude.js` receives data as arguments and returns results; `index.js` owns all reads from and writes to storage. This makes the AI layer testable in isolation and future-proofs the storage swap from JSON to SQLite.

The key risks are infrastructure-level, not product-level: duplicate Telegram polling instances causing double responses, JSON file corruption from non-atomic writes, and Claude returning malformed output for ambiguous Indonesian expense inputs. All three are well-understood with documented solutions (polling startup guards, atomic write-then-rename, Claude `tool_use` structured output). They must be addressed in Phase 1 and Phase 2 before any feature work proceeds — retrofitting concurrency safety and error handling is significantly more expensive than building them correctly the first time.

## Key Findings

### Recommended Stack

The prescribed 4-file structure matches the project constraint and is the correct scope for a single-user MVP. `node-telegram-bot-api` is mandated by project constraints and is adequate; `grammY` would be preferred if starting fresh. Use CommonJS throughout (`"type": "commonjs"` in package.json) because `node-telegram-bot-api` is CJS-only. The Anthropic SDK's `tool_use` API is the correct approach for expense parsing — it eliminates the fragile regex-on-Claude-response pattern. Verify all package versions and model IDs against live npm/Anthropic docs before pinning, as research is based on training data through Aug 2025.

**Core technologies:**
- Node.js 22 LTS — runtime; native `fetch`, `--env-file`, no EOL risk through 2027
- node-telegram-bot-api ^0.66 — Telegram client; polling mode; mandated by project
- @anthropic-ai/sdk ^0.26 — Claude API; handles auth, retries, typed responses
- zod ^3.x — schema validation for Claude tool output; catches malformed responses before storage write
- date-fns ^3.x — date arithmetic for weekly/monthly period boundaries
- node-cron ^3.x — in-process scheduler for Sunday auto-digest

### Expected Features

The MVP is clearly defined. The core hypothesis to validate is: "casual expense logging in Bahasa Indonesia works and retains users." All other features are secondary to that. Roast mode (Cleo-style personality) ships in MVP because it is personality, not a feature — without it the bot is just a ledger. The weekly auto-digest is the only async/background concern and requires a cron job, making it architecturally distinct from the rest.

**Must have (table stakes):**
- Natural language expense input with Indonesian slang parsing — the core premise; must just work
- Auto-categorization with Indonesian-appropriate categories — manual re-categorization is a dealbreaker
- `/rekap` — on-demand current month summary; minimum reporting to prove usefulness
- `/hapus` — delete last entry; trust safety net; without it users stop logging errors
- `/budget` with warnings at 80%/100% — gives users a reason to keep logging
- `/start` onboarding with Bahasa Indonesia examples — without it users don't know how to talk to the bot
- `/help` — command discovery; users forget what's available

**Should have (competitive differentiation):**
- Roast mode (Claude-decided, always-on) — the personality that creates screenshot-worthy moments and organic growth
- Casual Bahasa Indonesia register ("kamu", not "Anda") — "texting a friend" not "accounting software"
- Indonesian amount slang parsing (35rb, 1.5jt, 22ribu, ceban) — zero-friction input is the value proposition
- Indonesian-context categories (kost, pulsa, ojol, jajan) not Western defaults
- Weekly auto-digest every Sunday — the one proactive touch that validates whether summaries matter

**Defer (v2+):**
- Receipt OCR — validate text input friction is real before adding image complexity
- Bank/e-wallet sync (GoPay, OVO) — Indonesian Open Banking is not ready; screen-scraping is fragile
- Data export (CSV) — summaries in chat satisfy 90% of use cases at MVP stage
- Savings goals — separate product surface; validate expense tracking alone retains users first
- Web dashboard — breaks Telegram-only simplicity; only if users explicitly demand it
- Shared/family tracking — requires full data model rethink; validate single-user first

### Architecture Approach

The architecture is a flat 4-module application with clear ownership boundaries: `index.js` handles bot lifecycle and message routing; `claude.js` contains all Anthropic API calls; `storage.js` handles per-user JSON files under `data/`; `prompts.js` is pure prompt string constants. The critical boundary is that `claude.js` never reads or writes to storage — it receives data as arguments and returns structured results. This stateless AI layer is testable without a file system and allows the storage implementation to be swapped without touching AI logic. Build order follows the dependency graph: `prompts.js` first, then `storage.js`, then `claude.js`, then `index.js`.

**Major components:**
1. `index.js` — bot lifecycle, command routing, cron setup; the integration layer wired last
2. `claude.js` — all Claude API calls via `tool_use`; stateless; receives data, returns results
3. `storage.js` — per-user JSON files; atomic writes; per-user async write queue
4. `prompts.js` — named prompt string constants; no logic; edited without touching business code

### Critical Pitfalls

1. **Duplicate polling instances (409 Conflict)** — always call `deleteWebhook()` on startup; handle `polling_error` event; add startup instance guard; ship this in Phase 1 before any other work
2. **JSON file corruption from non-atomic writes** — write to `.tmp` file first, then `fs.renameSync` to real path; combine with a per-user async write queue to eliminate race conditions; never use `writeFileSync` without the rename pattern
3. **Claude returning malformed output for expense extraction** — use `tool_use` / function calling, not free-text JSON parsing; validate with Zod after extraction; test against edge-case Indonesian inputs before considering the integration done
4. **Indonesian amount edge cases silently misparse** — "1.5jt" (period = decimal in IDR), "1,5jt" (comma = decimal), "35K" (uppercase), "tiga puluh rb" (words); system prompt must enumerate all formats with explicit normalisation rules; add unit tests for the normaliser
5. **Claude API errors crash the bot or silently drop messages** — every Claude call must be wrapped in try/catch; retry on 429/529 with exponential backoff; always reply to user in Bahasa Indonesia on error — never allow silent drops

## Implications for Roadmap

Based on research, the architecture's dependency graph and the pitfall-to-phase mapping from PITFALLS.md suggest a 3-phase structure:

### Phase 1: Foundation — Bot Setup and Storage

**Rationale:** The dependency graph requires `prompts.js` and `storage.js` before `claude.js` or `index.js`. The polling infrastructure and storage layer are prerequisites for every feature. Three critical pitfalls (polling duplicates, JSON corruption, write races) must be solved here — retrofitting them later is expensive and risks data loss.

**Delivers:** A runnable Telegram bot that can receive and route messages; a correct, concurrency-safe storage layer; project skeleton committed with working dev tooling.

**Addresses:** Project structure, environment setup, `storage.js` with atomic writes and per-user queue, bot startup with `deleteWebhook()` guard, `polling_error` handler, `.env` / `.gitignore` / `.env.example` scaffolding, PII-safe logging.

**Avoids:** Pitfall 1 (duplicate polling), Pitfall 2 (JSON corruption), Pitfall 7 (webhook/polling conflict), Pitfall 8 (interleaved concurrent writes).

### Phase 2: Claude Integration and Core Expense Loop

**Rationale:** With a working bot and safe storage, the central product hypothesis can be tested: does natural language expense logging in Bahasa Indonesia work reliably? All Claude integration concerns must be resolved here before feature work adds complexity on top of a fragile AI layer.

**Delivers:** End-to-end expense logging — user types "makan 35rb", bot parses via Claude `tool_use`, validates with Zod, stores atomically, replies with confirmation in casual Bahasa Indonesia. Includes `/hapus`, roast mode (via system prompt), and the full Indonesian category set.

**Uses:** `@anthropic-ai/sdk`, `zod`, `prompts.js` (system prompt with Indonesian slang examples, off-topic rejection, prompt injection guard), `claude-3-5-haiku-20241022`.

**Implements:** `claude.js` with `parseExpense()` using `tool_use`; Indonesian amount normaliser with unit tests; Claude error handling with retry logic and Indonesian error messages; system prompt scope restriction.

**Avoids:** Pitfall 3 (malformed Claude output), Pitfall 4 (Indonesian amount edge cases), Pitfall 5 (Claude API errors), Pitfall 6 (system prompt scope creep).

### Phase 3: Commands and Summary Features

**Rationale:** With the core logging loop proven, the reporting and budgeting features become straightforward additions that use the data already being collected. The weekly cron is the final async infrastructure concern.

**Delivers:** Complete v1 feature set — `/rekap` (month summary via Claude), `/budget` (set + warnings), `/start` (onboarding), `/help`, weekly Sunday auto-digest via `node-cron`. Budget warning triggers on every expense log. All command responses in casual Bahasa Indonesia under Telegram's 4096-character limit.

**Uses:** `date-fns` (period filtering), `node-cron` (Sunday at 03:00 UTC = 10:00 WIB), `claude-3-5-haiku` (summaries).

**Implements:** `generateSummary()` and `generateWeeklySummary()` in `claude.js`; cron with per-user staggered delay (1s) to avoid Telegram rate limits; `ETELEGRAM 403` handling for blocked users in cron.

**Avoids:** Pitfall on Telegram 4096-character limit, cron rate limit spikes (429), bot blocked user crashing cron.

### Phase Ordering Rationale

- Phase 1 before Phase 2: `storage.js` must exist and be correct before Claude writes anything to it. The concurrency bugs in storage are invisible during single-threaded testing but corrupt data in production — they cannot be safely retrofitted.
- Phase 2 before Phase 3: `/rekap` and `/budget` depend on having correctly-stored expense data. If the Claude integration is fragile (malformed output, silent drops), the summary features will report wrong numbers. Validate the core loop first.
- Roast mode ships in Phase 2 (not Phase 3) because it is a system prompt behavior, not a separate feature — it costs nothing extra and defines the product personality from the first logged expense.
- The weekly cron ships in Phase 3 because it depends on having enough expense data to summarize meaningfully, and it introduces the only background infrastructure concern (error handling for blocked users, rate limit staggering).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Indonesian NLP prompt engineering is the least-documented aspect of this build. The system prompt must be tested against real edge-case inputs before Phase 2 is considered done. Consider a dedicated prompt-testing spike before implementing the storage write.
- **Phase 2:** Anthropic model IDs — `claude-3-5-haiku-20241022` and `claude-3-5-sonnet-20241022` were current as of Aug 2025 training data. Verify current model IDs at `docs.anthropic.com/en/docs/models-overview` before implementing `claude.js`.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Node.js Telegram bot setup with polling is well-documented. The atomic write and per-user queue patterns are standard Node.js concurrency patterns with no ambiguity.
- **Phase 3:** `node-cron` scheduling, `date-fns` period filtering, and Telegram command handling are all well-understood patterns with no unusual requirements.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core packages are well-established. Package versions and model IDs must be verified against live npm/Anthropic docs before pinning — research is from training data (Aug 2025 cutoff). node-telegram-bot-api is listed as having maintenance concerns; grammY would be preferred if the project constraint allowed it. |
| Features | MEDIUM | Core feature set and Indonesian market context are well-grounded. Indonesian user behavior patterns (screenshot culture, short message preference, WhatsApp-first mental model) are MEDIUM confidence and should be validated with real Indonesian users before v1.x feature decisions. |
| Architecture | HIGH | The 4-file structure is derived directly from project constraints. The `tool_use` pattern for structured output and the stateless AI layer pattern are well-documented Anthropic recommendations. Component boundaries are clear and unambiguous. |
| Pitfalls | MEDIUM-HIGH | Polling, JSON, and Claude API pitfalls are based on documented library behavior and Anthropic API specs with high confidence. Indonesian amount parsing edge cases are based on established IDR locale conventions (HIGH). Cron scaling thresholds are rough estimates (LOW — validate with real usage). |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Verify npm package versions before starting Phase 1:** Run `npm info node-telegram-bot-api version`, `npm info @anthropic-ai/sdk version` to confirm versions match research recommendations.
- **Verify current Anthropic model IDs before starting Phase 2:** Check `https://docs.anthropic.com/en/docs/models-overview` for the current `claude-3-5-haiku` and `claude-3-5-sonnet` model ID strings. Model IDs change with new releases.
- **Indonesian user behavior is unvalidated:** The research assumes young adult Indonesians aged 18-30 are the primary segment. Roast mode frequency, category preferences, and onboarding copy should be tested with at least 3-5 real Indonesian users before v1.x feature decisions.
- **Indonesian amount slang edge cases:** The system prompt approach to parsing "1.5jt", "1,5jt", "dua ratus rb" is the correct approach, but the specific prompt wording is untested. Build a unit test suite for the amount normaliser in Phase 2 and iterate on prompt wording based on test failures.
- **node-telegram-bot-api maintenance:** The library has known maintenance concerns as of 2025. If development stalls significantly or breaking bugs appear, migration to `grammY` is the documented upgrade path — it is TypeScript-first, actively maintained, and has equivalent feature coverage.

## Sources

### Primary (HIGH confidence)
- Anthropic Claude API documentation (tool_use, model IDs, error codes 429/529) — structured output pattern, error handling
- Telegram Bot API official documentation — 4096-character limit, webhook vs polling mutual exclusivity, chatId vs userId distinction
- POSIX standard / Node.js documentation — atomic write-then-rename pattern, `fs.promises` async I/O
- Project constraints from `.planning/PROJECT.md` — 4-file structure, polling mode, CommonJS requirement

### Secondary (MEDIUM confidence)
- Training data: node-telegram-bot-api ecosystem (polling behavior, polling_error event, 409 Conflict) — documented library behavior, no live verification
- Training data: Indonesian e-wallet ecosystem (GoPay, OVO, DANA, ShopeePay, LinkAja) — well-documented as of Aug 2025
- Training data: Cleo AI feature set (roast mode, weekly digest, budget alerts) — HIGH for core features; verify at meetcleo.com for current state
- Training data: Jenius (BTPN digital bank) Indonesian feature set — HIGH for features as of 2024
- Training data: Indonesian expense categories and amount slang (rb/ribu/jt/juta) — HIGH for universally-used abbreviations; LOW for street-level slang (ceban, gopek)

### Tertiary (LOW confidence)
- Indonesian user behavior patterns (screenshot culture, WhatsApp-first mental model, short message preference) — MEDIUM inference from market knowledge; validate with real users before v1.x decisions
- Scaling thresholds (JSON file I/O at 500+ users, Anthropic rate limits at 20+ concurrent cron users) — rough estimates; validate with actual benchmarks during scaling

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
