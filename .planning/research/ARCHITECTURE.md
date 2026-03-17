# Architecture Research

**Domain:** Node.js Telegram bot with Claude AI LLM integration (finance assistant)
**Researched:** 2026-03-17
**Confidence:** MEDIUM (training data, no live docs available — well-understood domain)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       External Services                           │
│  ┌──────────────────────┐    ┌──────────────────────────────┐    │
│  │   Telegram Servers    │    │   Anthropic Claude API        │    │
│  │  (Bot API / polling)  │    │  (claude-3-5-haiku / sonnet)  │    │
│  └──────────┬───────────┘    └────────────────┬─────────────┘    │
└─────────────┼───────────────────────────────── ┼────────────────┘
              │ incoming messages                 │ completions
              ▼                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                       index.js — Entry Point                      │
│  - Bot instance setup (node-telegram-bot-api)                     │
│  - Event handlers (on 'message', on 'polling_error')              │
│  - Command routing (/start, /rekap, /budget, /hapus, /help)       │
│  - Cron job setup (node-cron, Sunday weekly summary)              │
└───────┬──────────────────┬───────────────────────────────────────┘
        │ calls            │ calls
        ▼                  ▼
┌──────────────┐   ┌───────────────────────────────────────────────┐
│  storage.js  │   │                 claude.js                      │
│              │   │  - parseExpense(text, userId)                  │
│  - load(uid) │◄──│  - generateSummary(expenses, budget, userId)   │
│  - save(uid) │   │  - buildMessages(history, newMessage)          │
│              │   │  - callAnthropic(messages, system)             │
│  data/       │   └───────────────────────────────────────────────┘
│  {uid}.json  │             │ imports
│              │             ▼
└──────────────┘   ┌───────────────────────────────────────────────┐
        ▲          │                 prompts.js                     │
        │          │  - SYSTEM_PROMPT (finance scope, personality)  │
        │          │  - PARSE_EXPENSE_PROMPT (structured output)    │
        │          │  - SUMMARY_PROMPT (weekly/monthly recap)       │
        └──────────│  - BUDGET_WARNING_PROMPT                       │
                   └───────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | What it knows about |
|-----------|----------------|---------------------|
| `index.js` | Bot lifecycle, routing, cron | Telegram API, command names, user IDs |
| `claude.js` | All Claude API calls, response shaping | Anthropic SDK, prompts.js, storage.js (read-only) |
| `storage.js` | Read/write per-user JSON data | File system, data/ directory, JSON schema |
| `prompts.js` | All prompt strings, no logic | Nothing — pure data/strings |

**Critical boundary:** `claude.js` never writes to storage. `index.js` calls `claude.js` for a result, then calls `storage.js` to persist it. This keeps the AI layer stateless.

## Recommended Project Structure

```
mixxy/
├── index.js              # Entry point, bot setup, command routing, cron
├── claude.js             # All Claude API calls
├── storage.js            # JSON file read/write per user
├── prompts.js            # All prompt strings as named exports
├── package.json
├── .env                  # TELEGRAM_TOKEN, ANTHROPIC_API_KEY
├── .env.example          # Committed template
└── data/                 # Gitignored, one JSON per user
    ├── 123456789.json
    └── 987654321.json
```

### Structure Rationale

- **Flat 4-file layout:** Matches project constraint; avoids over-engineering a bot with ~500 lines total
- **`data/` directory:** Runtime-created, gitignored — never commit user data
- **`prompts.js` as pure strings:** Allows editing prompts without touching business logic; makes prompt iteration fast
- **`claude.js` as the only Anthropic-aware file:** If Anthropic SDK changes or model is swapped, one file changes

## Architectural Patterns

### Pattern 1: Command Router in index.js

**What:** A single `bot.on('message', handler)` that inspects `msg.text` and dispatches to command-specific functions or the default expense parser.

**When to use:** Always — this is the standard pattern for `node-telegram-bot-api`.

**Trade-offs:** Simple and readable for <10 commands; would need to extract to a router module at 20+ commands.

**Example:**
```javascript
bot.on('message', async (msg) => {
  const text = msg.text || '';
  const userId = String(msg.from.id);
  const chatId = msg.chat.id;

  if (text.startsWith('/start')) return handleStart(bot, chatId, userId);
  if (text.startsWith('/rekap')) return handleRekap(bot, chatId, userId);
  if (text.startsWith('/budget')) return handleBudget(bot, chatId, userId, text);
  if (text.startsWith('/hapus')) return handleHapus(bot, chatId, userId);
  if (text.startsWith('/help')) return handleHelp(bot, chatId);

  // Default: treat as expense input
  return handleExpenseInput(bot, chatId, userId, text);
});
```

### Pattern 2: Structured Output via Claude Tool Use (Function Calling)

**What:** Use Claude's tool_use feature to force structured JSON output for expense parsing, rather than parsing free-text Claude responses with regex.

**When to use:** Expense parsing — any time you need a guaranteed schema from Claude.

**Trade-offs:** More reliable than asking Claude to "respond in JSON"; slightly more verbose API call setup. Preferred over raw JSON mode for Anthropic's API.

**Example:**
```javascript
// In claude.js
const tools = [{
  name: 'record_expense',
  description: 'Record a parsed expense from user message',
  input_schema: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'Amount in IDR (full number, e.g. 35000 not 35rb)' },
      category: { type: 'string', enum: ['food', 'transport', 'entertainment', 'bills', 'shopping', 'health', 'other'] },
      description: { type: 'string', description: 'Short description in Bahasa Indonesia' },
      is_expense: { type: 'boolean', description: 'False if message is not an expense report' }
    },
    required: ['amount', 'category', 'description', 'is_expense']
  }
}];

const response = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 256,
  tools,
  tool_choice: { type: 'auto' },
  system: PARSE_EXPENSE_PROMPT,
  messages: [{ role: 'user', content: text }]
});

// Extract tool result
const toolUse = response.content.find(b => b.type === 'tool_use');
if (toolUse) return toolUse.input; // Guaranteed schema
```

**Confidence:** HIGH — tool_use / function calling is the documented Anthropic approach for structured output. The `input_schema` follows JSON Schema format.

### Pattern 3: Stateless Claude Layer with Stateful Storage

**What:** `claude.js` receives all needed data as function arguments. It never reads from the file system directly. `index.js` loads user data via `storage.js`, passes relevant slice to `claude.js`, and writes results back via `storage.js`.

**When to use:** Always — keeps the AI layer pure and testable.

**Trade-offs:** Slightly more wiring in `index.js`; pays off in testability and clear ownership.

**Example flow:**
```javascript
// In index.js handleExpenseInput()
const userData = await storage.load(userId);
const result = await claude.parseExpense(text, userData.recentContext);
if (result.is_expense) {
  userData.expenses.push({ ...result, date: new Date().toISOString() });
  await storage.save(userId, userData);
  bot.sendMessage(chatId, formatExpenseConfirmation(result, userData));
}
```

### Pattern 4: node-cron for Weekly Sunday Summary

**What:** Use `node-cron` (or `node-schedule`) to fire a job at a specific time on Sundays. The job iterates all JSON files in `data/`, generates a summary per user, and sends it via bot.

**When to use:** Weekly auto-summary requirement.

**Trade-offs:** Works fine for low user counts (< 1000); at scale, firing 1000 Claude calls simultaneously would hit rate limits — needs a queue at that point.

**Confidence:** MEDIUM — `node-cron` is the standard lightweight cron for Node.js, well-maintained as of 2025.

**Example:**
```javascript
// In index.js — runs at 10:00 AM WIB (UTC+7 = 03:00 UTC) every Sunday
cron.schedule('0 3 * * 0', async () => {
  const userIds = await storage.listUsers();
  for (const userId of userIds) {
    const userData = await storage.load(userId);
    const summary = await claude.generateWeeklySummary(userData);
    await bot.sendMessage(userData.chatId, summary);
    await delay(1000); // Rate limit buffer
  }
});
```

**Note:** The user's Telegram `chatId` must be stored at first interaction — `chatId` and `userId` are different in Telegram.

## Data Flow

### Request Flow: Expense Input

```
User types: "tadi makan siang 35rb"
    ↓
Telegram servers → polling → bot.on('message')
    ↓
index.js: identify as non-command text
    ↓
storage.js: load data/{userId}.json
    ↓
claude.js: parseExpense(text) → Anthropic API (tool_use)
    ↓
Anthropic returns: { amount: 35000, category: 'food', description: 'makan siang', is_expense: true }
    ↓
index.js: append to userData.expenses[], check budget proximity
    ↓
storage.js: save data/{userId}.json
    ↓
index.js: format confirmation message (optionally include roast if overspending)
    ↓
bot.sendMessage(chatId, confirmationText)
    ↓
User sees: "Oke, makan siang 35rb tercatat 🍜"
```

### Request Flow: /rekap Command

```
User types: "/rekap"
    ↓
index.js routes to handleRekap()
    ↓
storage.js: load data/{userId}.json
    ↓
index.js: filter expenses for current month
    ↓
claude.js: generateSummary(expenses, budget) → Anthropic API (text response)
    ↓
Anthropic returns: natural language summary in Bahasa Indonesia
    ↓
bot.sendMessage(chatId, summary)
```

### Request Flow: Weekly Cron

```
node-cron fires at Sunday 03:00 UTC
    ↓
storage.js: listUsers() → all user IDs from data/ directory
    ↓
For each userId:
    storage.js: load data/{userId}.json
    ↓
    claude.js: generateWeeklySummary(expenses, budget) → Anthropic API
    ↓
    bot.sendMessage(userData.chatId, summary)
    ↓
    delay(1000ms) // Avoid Telegram rate limits
```

## JSON Storage Schema

Per-user file: `data/{userId}.json`

```json
{
  "userId": "123456789",
  "chatId": 123456789,
  "username": "budi_santoso",
  "firstSeen": "2026-03-01T10:00:00.000Z",
  "budget": {
    "monthly": 3000000,
    "currency": "IDR"
  },
  "expenses": [
    {
      "id": "uuid-or-timestamp",
      "amount": 35000,
      "category": "food",
      "description": "makan siang",
      "rawText": "tadi makan siang 35rb",
      "date": "2026-03-17T05:30:00.000Z"
    }
  ],
  "lastActivity": "2026-03-17T05:30:00.000Z"
}
```

**Schema notes:**
- `chatId` separate from `userId` — required for bot to send proactive messages (cron)
- `rawText` kept for debugging Claude parsing mistakes
- `expenses` is an append-only array; `/hapus` pops the last entry
- No soft deletes needed for MVP — `/hapus` physically removes last entry
- `budget.monthly` is null/omitted until user sets it via `/budget`

## Build Order (Dependency Graph)

```
prompts.js          ← no dependencies, build first
    ↓
storage.js          ← no dependencies, build second
    ↓
claude.js           ← depends on prompts.js
    ↓
index.js            ← depends on claude.js + storage.js, wire last
```

**Rationale:**
1. `prompts.js` first — pure strings, no imports, needed by claude.js
2. `storage.js` second — pure file I/O, needed by index.js and indirectly by claude.js test flows
3. `claude.js` third — needs prompts.js; can be tested in isolation with mock data before index.js exists
4. `index.js` last — the integration layer; nothing depends on it

This order allows each module to be tested independently before wiring them together.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 users | Current design is perfect — no changes needed |
| 10-500 users | Add cron rate limiting (delay between users); consider batching Claude calls |
| 500-5000 users | JSON files become unwieldy for queries; migrate to SQLite (better-sqlite3) as drop-in replacement |
| 5000+ users | SQLite → PostgreSQL; add Redis queue for cron jobs; separate bot process from cron worker |

### First Bottleneck

File system I/O when listing all users for cron. At 500+ JSON files, `fs.readdir()` + reading each file is slow. Fix: maintain an index file `data/index.json` with `{ userId, chatId }` pairs — cron reads index, not every file.

### Second Bottleneck

Anthropic API rate limits during cron (429 errors). Fix: use `p-limit` to cap concurrent Claude calls (e.g., 5 at a time) instead of sequential `delay()`.

## Anti-Patterns

### Anti-Pattern 1: Parsing Claude's Text Response for Expense Data

**What people do:** Ask Claude to "respond with JSON" in the system prompt, then JSON.parse the response string.

**Why it's wrong:** Claude occasionally adds prose around the JSON ("Here is the data: `{...}`"), breaking the parse. Error handling becomes complex and fragile.

**Do this instead:** Use Claude's tool_use / function calling. Anthropic guarantees the `tool_use` block has valid JSON matching the schema. Zero parsing needed.

### Anti-Pattern 2: Storing chatId === userId

**What people do:** Use `msg.from.id` as both the user identifier and the target for `bot.sendMessage()`.

**Why it's wrong:** In group chats, `msg.chat.id` is the group chat ID, not the user ID. For private chats they happen to be equal, but relying on this silently breaks group chat support and makes the cron code wrong.

**Do this instead:** Always store both `userId` (from `msg.from.id`) and `chatId` (from `msg.chat.id`) in the user record at first interaction.

### Anti-Pattern 3: Importing storage.js Inside claude.js

**What people do:** Have `claude.js` call `storage.load(userId)` directly to fetch context.

**Why it's wrong:** Creates circular dependencies (if index.js ever needs to pass data between them) and makes `claude.js` untestable without a real file system.

**Do this instead:** `index.js` loads data from `storage.js`, passes relevant slices as function arguments to `claude.js`. Claude functions are pure input/output.

### Anti-Pattern 4: Single Global Claude Conversation History

**What people do:** Maintain one `messages` array that grows forever, passing full history to every API call.

**Why it's wrong:** Token costs grow linearly; very old "makan siang 35rb" messages have zero value in new requests.

**Do this instead:** For expense parsing, use zero-shot calls (no history — one user message, one response). For summary generation, pass only the structured expense data, not chat history. History is only useful for multi-turn clarification, which this bot doesn't need.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telegram Bot API | `node-telegram-bot-api` with polling | Polling is simpler for development/VPS; webhooks require HTTPS endpoint |
| Anthropic Claude API | `@anthropic-ai/sdk` official Node SDK | Use `claude-3-5-haiku-20241022` for expense parsing (fast, cheap); `claude-3-5-sonnet` optional for summaries |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `index.js` ↔ `claude.js` | Direct function calls, async/await | claude.js exports named async functions |
| `index.js` ↔ `storage.js` | Direct function calls, async/await | storage.js exports `load(userId)` and `save(userId, data)` |
| `claude.js` ↔ `prompts.js` | ES module imports, string constants | prompts.js is imported at top; no runtime dependency |
| `index.js` ↔ Telegram | Event emitter (`bot.on`) + `bot.sendMessage()` | node-telegram-bot-api wraps the Bot API |
| `claude.js` ↔ Anthropic | `@anthropic-ai/sdk` `messages.create()` | All Anthropic calls go through this one module |

## Model Selection Guidance

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| Expense parsing (per-message) | `claude-3-5-haiku-20241022` | Fast (< 1s), cheap, handles structured Indonesian slang well |
| Weekly summary (once/week/user) | `claude-3-5-haiku-20241022` | Adequate for summary generation; upgrade to Sonnet if quality disappoints |
| `/rekap` on-demand summary | `claude-3-5-haiku-20241022` | Same reasoning as weekly |

**Confidence:** MEDIUM — Haiku was the fast/cheap tier as of 2025. Model names may have changed; verify against Anthropic's current model list before building.

## Environment Configuration

```
TELEGRAM_TOKEN=your_bot_token_here
ANTHROPIC_API_KEY=sk-ant-...
DATA_DIR=./data              # Optional, defaults to ./data
CRON_TIMEZONE=Asia/Jakarta   # Optional, for correct Sunday timing
PORT=3000                    # Only needed if using webhooks (not polling)
```

**Note on timezone:** Indonesian users are at UTC+7 (WIB). A Sunday summary sent at 10:00 WIB = 03:00 UTC. Use `Asia/Jakarta` in node-cron's `scheduled: true` option, or calculate UTC offset manually.

## Sources

- Training data knowledge of `node-telegram-bot-api` (well-established package, stable API)
- Training data knowledge of Anthropic Claude API tool_use / function calling (documented pattern as of 2025)
- Training data knowledge of `node-cron` scheduling patterns
- PROJECT.md context for Mixxy project constraints

**Confidence notes:**
- Component boundaries and 4-file structure: HIGH (derived from project constraints in PROJECT.md)
- Tool_use for structured output: HIGH (core Anthropic API feature, stable since 2023)
- Model names/versions: MEDIUM (verify against current Anthropic docs before building)
- Scaling thresholds: LOW (rough estimates, validate with actual file system benchmarks)

---
*Architecture research for: Node.js Telegram finance bot with Claude AI (Mixxy)*
*Researched: 2026-03-17*
