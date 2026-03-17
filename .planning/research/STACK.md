# Stack Research

**Domain:** Telegram bot (Node.js) with Claude AI integration and local JSON storage
**Researched:** 2026-03-17
**Confidence:** MEDIUM — all findings are from training data (cutoff Aug 2025). No live npm/web verification was possible in this session. Validate versions before pinning in package.json.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | v22 is the current LTS line (Oct 2024–Apr 2027). v20 LTS also acceptable. Avoid v18 (reaches EOL Sep 2025). Native `fetch`, `--env-file`, and top-level `await` reduce dependency count. |
| node-telegram-bot-api | ^0.66.0 | Telegram Bot API client | Mandated by project constraints. Polling mode works zero-config for dev/MVP. Has maintenance concerns (see below) but is stable for basic use. |
| @anthropic-ai/sdk | ^0.26.x | Claude API client | Official Anthropic SDK for Node.js. Handles auth, retries, streaming, and typed responses. Use `messages.create()` for expense parsing. |
| dotenv | ^16.x | Env variable loading | Standard env management. Node 22 `--env-file` flag is a built-in alternative for simple cases — skip `dotenv` if targeting Node 22 only. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.x | Schema validation + parse | Use to validate JSON extracted from Claude responses before writing to disk. Claude occasionally returns malformed JSON — Zod catches it. |
| date-fns | ^3.x | Date arithmetic for summaries | Weekly recap needs "start of week" and "start of month" boundaries. `date-fns` is tree-shakeable and has no side effects. |
| node-cron | ^3.x | Scheduled Sunday summaries | Pure-Node cron implementation. Use for the Sunday auto-summary feature. Runs in-process; no external scheduler needed for MVP. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| nodemon | Fast dev reload on file change | `nodemon index.js` — avoids manual restart during development. |
| eslint + @eslint/js | Linting | Use flat config (eslint.config.js) — the legacy .eslintrc format is deprecated as of ESLint 9. |
| prettier | Formatting | Pair with eslint; prevents style drift across the 4-file codebase. |

---

## Installation

```bash
# Core runtime dependencies
npm install node-telegram-bot-api @anthropic-ai/sdk dotenv zod date-fns node-cron

# Dev dependencies
npm install -D nodemon eslint prettier
```

---

## Project Structure (Prescribed)

The project brief specifies a clean 4-file structure. Expand only when a file exceeds ~200 lines.

```
mixxy/
├── index.js          # Bot init, command routing, message handler
├── claude.js         # All Claude API calls: parseExpense(), generateSummary()
├── storage.js        # Read/write per-user JSON files under data/
├── prompts.js        # System prompt + prompt builder functions
├── data/             # One JSON file per Telegram user ID (gitignored)
│   └── {userId}.json
├── .env              # TELEGRAM_TOKEN, ANTHROPIC_API_KEY (gitignored)
├── .env.example      # Committed, blank values
└── package.json
```

**Why this structure works:**
- `claude.js` isolates all AI logic — prompt changes don't touch routing code
- `storage.js` as a module means swapping JSON→SQLite later touches one file only
- `prompts.js` separation lets you tune personality without touching business logic

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| node-telegram-bot-api | **grammY** | grammY is more actively maintained, TypeScript-first, and better documented as of 2025. Use grammY if starting fresh with no constraint to node-telegram-bot-api. |
| node-telegram-bot-api | **Telegraf v4** | Telegraf has a middleware model similar to Express/Koa. Good for complex bots with many commands. Heavier than needed for MVP. |
| node-telegram-bot-api | **Telegram Bot API direct (node-fetch)** | Only if you want zero dependencies. Not worth the maintenance cost. |
| zod | **JSON.parse + try/catch** | Acceptable for MVP if you trust Claude output. But zod catches malformed Claude responses early and gives readable error messages. |
| date-fns | **Luxon** | Luxon is better for timezone-heavy apps. This bot is IDR/Jakarta-focused — add timezone support only when users report issues. |
| node-cron | **External cron (crontab, GitHub Actions)** | Better for production reliability (in-process cron dies if process crashes). For MVP with one user, in-process is fine. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **moment.js** | Deprecated by its own maintainers since 2020. Huge bundle, mutable API. | `date-fns` (functional, tree-shakeable) |
| **request / node-fetch v2** | `request` is deprecated. `node-fetch` v2 is CommonJS-only. | Native `fetch` (Node 18+) or `node-fetch` v3 (ESM) |
| **Telegraf v3** | Telegraf v3 is incompatible with v4, and v3 is EOL. | Telegraf v4 or grammY |
| **Synchronous `fs` in message handlers** | `fs.readFileSync` blocks the event loop during bot message handling — other users stall. | Always use `fs.promises` (async read/write) |
| **Storing raw Claude responses without validation** | Claude will occasionally return invalid JSON or extra prose. Storing it unchecked corrupts user data files. | Parse with Zod before writing; log + reply with error if parse fails |
| **Top-level API key strings** | Hardcoding `ANTHROPIC_API_KEY` in source triggers secret scanning and is a security risk. | `process.env.ANTHROPIC_API_KEY` via `.env` |

---

## node-telegram-bot-api: Polling vs Webhooks

**Polling is correct for this MVP. Webhooks add operational complexity with no benefit at one-user scale.**

### Polling (recommended for MVP)

```js
const bot = new TelegramBot(token, { polling: true });
```

**Gotchas:**
- `polling: true` starts immediately on instantiation — ensure your handlers are registered synchronously before anything async
- If the process crashes and restarts within 30 seconds, Telegram may queue duplicate updates. Use `{ polling: { timeout: 10 } }` to reduce conflict window
- `node-telegram-bot-api` emits an `polling_error` event — you MUST handle it or unhandled errors will crash Node: `bot.on('polling_error', console.error)`
- Long polling with `node-telegram-bot-api` uses HTTP long-poll internally (30s timeout per request) — it is not a busy-loop

### Webhooks (defer until production with public URL)

Webhooks require:
1. A public HTTPS URL with a valid TLS certificate
2. A web server (Express or similar) to receive POST requests
3. Calling `bot.setWebHook(url)` on startup

Not worth the setup for MVP. Revisit when deploying to a VPS/cloud provider.

---

## Claude API: Expense Parsing Pattern

**Use structured JSON output via the system prompt, not function calling, for simplicity.**

```js
// claude.js pattern
async function parseExpense(userMessage) {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',  // fast + cheap for parsing
    max_tokens: 256,
    system: SYSTEM_PROMPT,  // from prompts.js
    messages: [{ role: 'user', content: userMessage }]
  });

  const text = response.content[0].text;
  // Claude returns JSON wrapped in prose sometimes — extract it
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response');
  return ExpenseSchema.parse(JSON.parse(match[0]));  // Zod validates
}
```

**Model choice: `claude-3-5-haiku-20241022`** for expense parsing (fast, cheap, accurate for structured extraction). Use `claude-3-5-sonnet-20241022` for weekly summary generation where richer prose matters.

**Confidence: MEDIUM** — model IDs are correct as of Aug 2025 training data. Anthropic releases new models frequently. Check https://docs.anthropic.com/en/docs/models-overview before pinning model strings.

**Indonesian amount slang handling:** Include examples directly in the system prompt:
- "35rb" → 35000
- "22ribu" → 22000
- "50k" → 50000
- "1,5jt" → 1500000

Claude handles this reliably with few-shot examples. No custom parser needed.

---

## Stack Patterns by Variant

**If deploying to a VPS (e.g., DigitalOcean, Railway):**
- Switch to webhooks to reduce outbound polling connections
- Add PM2 or systemd for process management
- Add a log file rotation strategy (pino or winston)

**If user count exceeds ~50 concurrent:**
- JSON files with `fs.promises` will show contention under concurrent writes
- Migrate storage.js to SQLite (via `better-sqlite3`) — single file, no server, minimal change to the module interface
- Keep the same storage.js API; only the implementation changes

**If adding multi-currency later:**
- Add a `currency` field to the expense schema from day one (default `"IDR"`)
- Easier to add a field to an existing JSON structure than to migrate without it

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| node-telegram-bot-api ^0.66 | Node.js 18, 20, 22 | No native ESM — use CommonJS (`require`) or configure interop |
| @anthropic-ai/sdk ^0.26 | Node.js 18+ | ESM and CJS both supported |
| zod ^3.x | Node.js 14+ | No compatibility issues expected |
| node-cron ^3.x | Node.js 12+ | No compatibility issues expected |
| date-fns ^3.x | Node.js 14+ | v3 is ESM-first; CJS build included |

**Package type recommendation:** Use `"type": "commonjs"` in package.json. `node-telegram-bot-api` is CJS-only and mixing CJS/ESM in a small 4-file project adds friction with no benefit.

---

## Sources

- Training data (cutoff Aug 2025) — node-telegram-bot-api, telegraf, grammY ecosystem comparison — **LOW-MEDIUM confidence** (verify against current npm before pinning)
- Training data — Anthropic SDK API (`messages.create`, model IDs) — **MEDIUM confidence** (model IDs change frequently; verify at https://docs.anthropic.com/en/docs/models-overview)
- Training data — Node.js LTS schedule — **HIGH confidence** (LTS dates are published years ahead at https://nodejs.org/en/about/previous-releases)
- Training data — node-telegram-bot-api polling gotchas (`polling_error` event, restart deduplication) — **MEDIUM confidence** (these are documented behaviors, but library version matters)
- Project constraints from `.planning/PROJECT.md` — **HIGH confidence** (source of truth for this project)

---

## Open Validation Items

Before writing first line of code, verify:

1. `npm info node-telegram-bot-api version` — confirm latest is 0.66.x or newer
2. `npm info @anthropic-ai/sdk version` — confirm latest version
3. Check https://docs.anthropic.com/en/docs/models-overview for current claude-3-5-haiku model ID string
4. Confirm `node --version` in deployment environment is 20+ (avoid v18 EOL)

---

*Stack research for: Mixxy — Telegram Finance Bot (Bahasa Indonesia)*
*Researched: 2026-03-17*
