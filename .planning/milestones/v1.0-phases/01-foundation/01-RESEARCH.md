# Phase 1: Foundation - Research

**Researched:** 2026-03-17
**Domain:** Node.js Telegram bot scaffolding, polling, concurrency-safe JSON file storage
**Confidence:** HIGH (standard stack confirmed against npm registry; patterns verified from official sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each expense stored as `{ amount, category, description, timestamp }` — `amount` is a plain IDR integer, `timestamp` is ISO 8601 UTC string
- Storage: `data/{user_id}.json` is a flat JSON array of expense objects; array grows indefinitely in Phase 1
- Long polling (not webhook) — `node-telegram-bot-api` with `{polling: true}`
- Duplicate guard: in-memory `Set` of processed `update_id` values — resets on restart (acceptable)
- Placeholder reply text: `"Bot aktif! Fitur expense logging segera hadir."` (or close equivalent)
- CommonJS throughout (`require`/`module.exports`) — node-telegram-bot-api is CJS-only
- 4-file structure: `index.js`, `claude.js`, `storage.js`, `prompts.js`

### Claude's Discretion
- Concurrency approach for safe concurrent file writes (file locking library vs atomic temp-file swap)
- `.gitignore` contents
- `.env.example` formatting and comments
- Error handling depth for Phase 1 (try/catch scope)

### Deferred Ideas (OUT OF SCOPE)
- None declared — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 1 is pure infrastructure: no user-facing NLP, no Claude API calls. The three implementation concerns are (1) wiring up `node-telegram-bot-api` with long polling and a `Set`-based duplicate guard, (2) concurrency-safe JSON reads and writes to per-user files under `data/`, and (3) standard project scaffolding (`.env`, `.gitignore`, `package.json`).

The concurrency challenge is subtle. Node.js is single-threaded, but `async/await` creates suspension points: two concurrent `await readFile` calls for the same user file can both read the old state before either write completes, producing a lost-update. For Phase 1 (only a placeholder reply), there are no writes during message handling, so the risk is deferred — but the storage module must be designed for Phase 2 where writes happen. The recommended solution for single-process use is an in-process `Map<userId, Mutex>` using `async-mutex`, which is zero-config and avoids file-system overhead.

The project is greenfield CommonJS. All packages confirmed at their current registry versions as of 2026-03-17.

**Primary recommendation:** Wire `node-telegram-bot-api` polling with a `Set` guard in `index.js`; implement `storage.js` with per-user `async-mutex` mutexes protecting read-parse-modify-write sequences; use `write-file-atomic` inside the mutex for crash-safe final writes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-telegram-bot-api | 0.67.0 | Telegram Bot API client, polling | The dominant CJS Telegram library for Node.js; locked by project decision |
| dotenv | 17.3.1 | Load `.env` into `process.env` | Industry standard; zero-config |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| async-mutex | 0.5.0 | In-process per-user mutex for read-modify-write safety | Use inside `storage.js` to serialize concurrent operations per `user_id` |
| write-file-atomic | 7.0.1 | Atomic temp-file-then-rename write | Use inside the mutex for crash-safe writes — readers never see half-written JSON |

**Installation:**
```bash
npm install node-telegram-bot-api dotenv async-mutex write-file-atomic
```

**Version verification (confirmed 2026-03-17 against npm registry):**
- `node-telegram-bot-api`: 0.67.0 (published 2025-12-13)
- `dotenv`: 17.3.1 (latest)
- `async-mutex`: 0.5.0 (latest)
- `write-file-atomic`: 7.0.1 (latest)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| async-mutex | proper-lockfile 4.1.2 | proper-lockfile is process-safe AND machine-safe (via mkdir); overkill for a single-process bot — adds file-system state, stale lock cleanup complexity |
| write-file-atomic | `fs.writeFile` directly | No partial-write protection on crash; fine inside a mutex but write-file-atomic adds defence-in-depth |
| async-mutex Map per user | Single global mutex | Global mutex serializes ALL users; per-user mutex allows true concurrency across different users |

---

## Architecture Patterns

### Recommended Project Structure
```
mixxy/
├── index.js          # Bot entry point: polling setup, update_id dedup, message routing
├── storage.js        # All file I/O: read/write data/{user_id}.json with mutex + atomic write
├── claude.js         # Phase 2: Claude API calls (stub/empty in Phase 1)
├── prompts.js        # Phase 2: system prompt strings (stub/empty in Phase 1)
├── data/             # Runtime: per-user JSON files (gitignored)
├── .env              # Runtime secrets (gitignored)
├── .env.example      # Committed template
├── .gitignore
└── package.json
```

### Pattern 1: Polling Setup with Duplicate Guard
**What:** Create bot with `{polling: true}`; maintain a module-level `Set` of seen `update_id` values; check before processing each message.
**When to use:** Always — this is the locked architecture.
**Example:**
```javascript
// Source: node-telegram-bot-api GitHub (yagop/node-telegram-bot-api)
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const processedUpdates = new Set();

bot.on('message', (msg) => {
  const updateId = msg.update_id; // NOTE: update_id is on the Update object, not msg
  // See Pattern Note below
  if (processedUpdates.has(updateId)) return;
  processedUpdates.add(updateId);

  bot.sendMessage(msg.chat.id, 'Bot aktif! Fitur expense logging segera hadir.');
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.code, err.message);
});
```

**Pattern Note on `update_id`:** `node-telegram-bot-api` internally manages the offset via `getUpdates` and increments it after each acknowledgment — this already prevents Telegram from redelivering processed updates on restart. The in-memory `Set` guard protects against the edge case where the same update arrives twice within a single process lifetime (e.g., rapid-fire delivery before the offset is acknowledged). The `Set` is on `msg.update_id` — verify this field is exposed in the event payload; if not, use a combination of `msg.chat.id + msg.message_id` as the dedup key.

### Pattern 2: Per-User Storage with Mutex + Atomic Write
**What:** `Map<userId, Mutex>` in module scope; every read-modify-write inside `mutex.runExclusive()`.
**When to use:** Whenever Phase 2 writes an expense; the pattern must be built in Phase 1 even if the write path isn't called yet.
**Example:**
```javascript
// Source: async-mutex (DirtyHairy/async-mutex), write-file-atomic (npm/write-file-atomic)
const { Mutex } = require('async-mutex');
const writeFileAtomic = require('write-file-atomic');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const mutexes = new Map(); // userId -> Mutex

function getMutex(userId) {
  if (!mutexes.has(userId)) mutexes.set(userId, new Mutex());
  return mutexes.get(userId);
}

async function readExpenses(userId) {
  const file = path.join(DATA_DIR, `${userId}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function appendExpense(userId, expense) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const mutex = getMutex(userId);
  await mutex.runExclusive(async () => {
    const expenses = await readExpenses(userId);
    expenses.push(expense);
    const file = path.join(DATA_DIR, `${userId}.json`);
    await writeFileAtomic(file, JSON.stringify(expenses, null, 2));
  });
}

module.exports = { readExpenses, appendExpense };
```

### Pattern 3: Expense Record Shape
**What:** Plain JS object matching the locked schema.
**Example:**
```javascript
// Locked in CONTEXT.md
const expense = {
  amount: 35000,            // integer IDR, no encoding
  category: 'makan',       // string
  description: 'makan siang warung padang',
  timestamp: new Date().toISOString(),  // ISO 8601 UTC
};
```

### Pattern 4: dotenv Setup
```javascript
// Must be the FIRST require in index.js — before any other module that reads env vars
require('dotenv').config();
```

### .env.example
```
# Telegram bot token from @BotFather
TELEGRAM_TOKEN=your_telegram_bot_token_here

# Anthropic API key (used in Phase 2)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### .gitignore (recommended)
```
node_modules/
.env
data/
*.log
```

### Anti-Patterns to Avoid
- **Single global mutex:** Serializes all users behind one lock — user B must wait for user A's file operation. Use `Map<userId, Mutex>` instead.
- **Raw `fs.writeFile` inside the mutex:** Still safe from race conditions but not crash-safe (partial write on SIGKILL). Use `write-file-atomic` for defence-in-depth.
- **`require('dotenv').config()` after other imports:** If any imported module reads `process.env` at require-time, the env vars won't be available. Always dotenv first.
- **`JSON.stringify` without indent in storage:** Hard to debug. Use `JSON.stringify(data, null, 2)` for readable files.
- **Starting two bot instances against the same token:** Two processes polling the same token causes both to receive every update — only one will reply, but it's non-deterministic. Ensure single instance.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom temp-file + rename logic | `write-file-atomic` 7.0.1 | Handles temp file naming, rename, sync, cleanup on error — dozens of edge cases |
| In-process serialization | Promise chain queuing by hand | `async-mutex` 0.5.0 | Correct cancellation, re-entrancy, timeout support baked in |
| Telegram polling loop | Custom `getUpdates` loop with offset tracking | `node-telegram-bot-api` polling mode | Library handles offset increment, exponential backoff, error recovery |

**Key insight:** The read-modify-write pattern on JSON files looks simple but has at least three failure modes (concurrent read before write, crash between write and rename, corrupt JSON on partial write). All three are handled by mutex + write-file-atomic.

---

## Common Pitfalls

### Pitfall 1: update_id Not on `msg` Object
**What goes wrong:** `msg.update_id` is undefined — the dedup Set never hits.
**Why it happens:** `node-telegram-bot-api` parses the Telegram Update object and passes only the `Message` sub-object to `bot.on('message', ...)`. `update_id` lives on the Update, not the Message.
**How to avoid:** Use `msg.message_id` + `msg.chat.id` as the composite dedup key, or listen at a lower level. Alternatively, accept that the library's own offset management already handles redelivery — the in-memory guard only matters for within-session rapid duplicates.
**Warning signs:** Duplicate replies being sent in testing.

### Pitfall 2: Polling Error on Startup (409 Conflict)
**What goes wrong:** `polling_error` event fires with code `ETELEGRAM` and body containing `409: Conflict`.
**Why it happens:** A previous bot process is still running and polling. Telegram rejects two simultaneous pollers.
**How to avoid:** Ensure only one process runs at a time. In development, kill the old process before `node index.js`.
**Warning signs:** `polling_error` events on startup with 409 status.

### Pitfall 3: Lost Update on Concurrent Writes (No Mutex)
**What goes wrong:** Two messages from the same user arrive near-simultaneously. Both `readExpenses` calls return the same array. Both `appendExpense` calls write their own version — whichever writes last wins, dropping the other expense.
**Why it happens:** `async/await` yields at every `await`; both coroutines interleave between read and write.
**How to avoid:** Per-user mutex as described in Pattern 2. This is especially critical for Phase 2.
**Warning signs:** User reports "I added two expenses, only one shows in /rekap."

### Pitfall 4: `data/` Directory Not Created
**What goes wrong:** `writeFileAtomic` or `fs.writeFile` throws `ENOENT` because `data/` doesn't exist.
**How to avoid:** `await fs.mkdir(DATA_DIR, { recursive: true })` before any write. Either in `appendExpense` or once at bot startup.
**Warning signs:** Crash on first write with `ENOENT`.

### Pitfall 5: Stale `processedUpdates` Set Growing Unbounded
**What goes wrong:** `processedUpdates` Set accumulates message IDs across the entire process lifetime, eventually consuming memory in a long-running bot.
**How to avoid:** For Phase 1 this is acceptable (the set only grows during one process run). If needed in later phases, cap the Set size or use a `Map<id, timestamp>` and prune entries older than 60 seconds.
**Warning signs:** Memory usage climbing over days of uptime.

---

## Code Examples

### Complete index.js Skeleton
```javascript
// Source: node-telegram-bot-api (yagop/node-telegram-bot-api), dotenv
'use strict';
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;
if (!token) throw new Error('TELEGRAM_TOKEN not set in .env');

const bot = new TelegramBot(token, { polling: true });
// Dedup by composite key: chatId + messageId (update_id not exposed on Message)
const processedMessages = new Set();

bot.on('message', async (msg) => {
  const key = `${msg.chat.id}:${msg.message_id}`;
  if (processedMessages.has(key)) return;
  processedMessages.add(key);

  try {
    await bot.sendMessage(msg.chat.id, 'Bot aktif! Fitur expense logging segera hadir.');
  } catch (err) {
    console.error('sendMessage failed:', err.message);
  }
});

bot.on('polling_error', (err) => {
  console.error('[polling_error]', err.code, err.message);
});

console.log('Bot started.');
```

### storage.js Skeleton (Phase 1 — read-only surface)
```javascript
// Source: async-mutex (DirtyHairy/async-mutex), write-file-atomic (npm/write-file-atomic)
'use strict';
const { Mutex } = require('async-mutex');
const writeFileAtomic = require('write-file-atomic');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const mutexes = new Map();

function getMutex(userId) {
  if (!mutexes.has(String(userId))) {
    mutexes.set(String(userId), new Mutex());
  }
  return mutexes.get(String(userId));
}

async function readExpenses(userId) {
  const file = path.join(DATA_DIR, `${userId}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function appendExpense(userId, expense) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const mutex = getMutex(userId);
  return mutex.runExclusive(async () => {
    const expenses = await readExpenses(userId);
    expenses.push({
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      timestamp: expense.timestamp || new Date().toISOString(),
    });
    const file = path.join(DATA_DIR, `${userId}.json`);
    await writeFileAtomic(file, JSON.stringify(expenses, null, 2));
    return expenses;
  });
}

async function popExpense(userId) {
  const mutex = getMutex(userId);
  return mutex.runExclusive(async () => {
    const expenses = await readExpenses(userId);
    if (expenses.length === 0) return null;
    const removed = expenses.pop();
    const file = path.join(DATA_DIR, `${userId}.json`);
    await writeFileAtomic(file, JSON.stringify(expenses, null, 2));
    return removed;
  });
}

module.exports = { readExpenses, appendExpense, popExpense };
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.writeFile` for JSON persistence | `write-file-atomic` (temp + rename) | npm ecosystem standard since ~2018 | Crash-safe writes — no corrupt JSON on SIGKILL |
| Global mutex per process | Per-resource `Map<key, Mutex>` | async-mutex 0.3+ | True user-level parallelism without cross-user blocking |
| Manual polling loop with `getUpdates` | Library polling with `{polling: true}` | node-telegram-bot-api since early versions | Offset management, error recovery handled automatically |

**Deprecated/outdated:**
- **`lockfile` npm package** (not `proper-lockfile`): Uses `O_EXCL` open flag which has issues on network filesystems. `proper-lockfile` uses `mkdir` instead. However, both are overkill for single-process — prefer `async-mutex`.
- **Webhook mode for local dev**: Requires a public HTTPS endpoint. Long polling is the correct local development mode (and the locked decision).

---

## Open Questions

1. **Does `msg.update_id` exist on the Message object passed by `node-telegram-bot-api`?**
   - What we know: Telegram's Update object has `update_id`; the library passes the `Message` sub-object to `bot.on('message', ...)`.
   - What's unclear: Whether the library attaches `update_id` to the message for convenience.
   - Recommendation: Use composite `chatId:messageId` as the dedup key — it is definitely available and achieves the same goal.

2. **`data/` directory git behavior**
   - What we know: `data/` should be gitignored.
   - What's unclear: Whether to commit `data/.gitkeep` to ensure the directory exists in a fresh clone, or rely on runtime `mkdir -p`.
   - Recommendation: Runtime `mkdir(DATA_DIR, { recursive: true })` on first write — no need for `.gitkeep`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — greenfield project |
| Config file | None — Wave 0 must create |
| Quick run command | `node --test` (Node.js built-in test runner, no install needed) or `npx jest --testPathPattern=<file>` |
| Full suite command | `node --test` or `npx jest` |

**Recommendation:** Use Node.js built-in test runner (`node:test` + `node:assert`) — zero dependencies, works in any Node 18+ environment, appropriate for this project's simplicity.

### Phase Requirements → Test Map

Phase 1 has no v1 requirement IDs (it's the infrastructure substrate). Tests map to success criteria instead:

| Success Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-------------------|----------|-----------|-------------------|-------------|
| SC-1: Bot starts without errors | `index.js` loads without throwing | smoke | `node -e "require('./index.js')"` (with mock token) | ❌ Wave 0 |
| SC-2: Duplicate message guard | Same `chatId:messageId` key not processed twice | unit | `node --test tests/dedup.test.js` | ❌ Wave 0 |
| SC-3: Storage survives restart | `readExpenses` returns written data from file | unit | `node --test tests/storage.test.js` | ❌ Wave 0 |
| SC-4: Concurrent writes don't corrupt | Two `appendExpense` calls for same user run concurrently, both appear in file | unit | `node --test tests/storage.test.js` | ❌ Wave 0 |
| SC-5: .env.example exists | File exists at repo root with required keys | smoke | `node -e "require('fs').readFileSync('.env.example')"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/storage.test.js` (fast, no network)
- **Per wave merge:** `node --test` (all tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/storage.test.js` — covers SC-3, SC-4 (concurrent write correctness, file persistence)
- [ ] `tests/dedup.test.js` — covers SC-2 (duplicate message guard logic)
- [ ] Framework: `node:test` built-in (Node 18+, no install) — confirm Node version in environment

---

## Sources

### Primary (HIGH confidence)
- npm registry (2026-03-17 live query) — `node-telegram-bot-api@0.67.0`, `dotenv@17.3.1`, `async-mutex@0.5.0`, `write-file-atomic@7.0.1` version confirmation
- [yagop/node-telegram-bot-api GitHub](https://github.com/yagop/node-telegram-bot-api) — polling setup, message event, polling_error event
- [DirtyHairy/async-mutex GitHub](https://github.com/DirtyHairy/async-mutex) — `Mutex.runExclusive()` API
- [npm/write-file-atomic GitHub](https://github.com/npm/write-file-atomic) — atomic write pattern

### Secondary (MEDIUM confidence)
- [moxystudio/node-proper-lockfile GitHub](https://github.com/moxystudio/node-proper-lockfile) — lock/unlock API (reviewed as ruled-out alternative)
- [Telegram Bot FAQ](https://core.telegram.org/bots/faq) — offset and duplicate handling behavior
- [node-telegram-bot-api PR #265](https://github.com/yagop/node-telegram-bot-api/pull/265/files) — offset loop fix, confirming library manages offset internally

### Tertiary (LOW confidence)
- Various Medium/DEV articles on Node.js race conditions — used only to confirm the general pattern, not cited as authoritative

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions live-verified from npm registry 2026-03-17
- Architecture patterns: HIGH — derived from official library documentation and locked decisions in CONTEXT.md
- Pitfalls: MEDIUM — most verified against library source/issues; update_id exposure on Message object is LOW (needs runtime verification)
- Validation approach: HIGH — Node.js built-in test runner is version-stable

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable ecosystem — packages unlikely to have breaking changes in 30 days)
