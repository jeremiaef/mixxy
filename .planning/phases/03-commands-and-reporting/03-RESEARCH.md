# Phase 3: Commands and Reporting - Research

**Researched:** 2026-03-17
**Domain:** Node.js Telegram bot — cron scheduling, summary generation, budget alerts, Claude intent extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Summary format & length**
- Multi-line is OK for summaries — the 1-sentence rule was for expense confirmations only
- Show only categories with spending (skip zero-spend categories)
- Per category: amount + count — e.g. "Makan: 5x • 235.000"
- Claude-generated insight appears as 1-2 sentences at the bottom of the summary (after category breakdown)
- Empty state for /rekap with no expenses: short casual message with usage example, same redirect pattern as BOT-03 — e.g. "Bulan ini belum ada pengeluaran yang dicatat. Coba: 'makan siang 35rb'"

**Budget storage & UX**
- /budget 500000 = set budget; /budget (no arg) = view current budget + spending progress
- Budget stored in a separate metadata file: data/{userId}_meta.json — keeps expenses array clean and extensible
- Budget limit persists month-to-month until user changes it; monthly spending resets naturally via timestamp-based filtering
- 80%/100% alerts trigger after each expense is logged: recalculate monthly total, and if it just crossed 80% or 100%, append the warning to the expense confirmation reply
- At 100%, include a light roast (consistent with Phase 2 personality)
- /budget with no budget set: short casual message explaining how to set one

**Weekly digest architecture**
- Library: node-cron — lightweight, CJS-compatible. Schedule: '0 3 * * 0' = Sundays 03:00 UTC (10:00 WIB)
- User discovery: iterate the data/ directory — each {userId}.json filename is a user ID. No separate user registry needed.
- Digest content: same structure as /rekap but scoped to the past 7 days — category breakdown + count, total, Claude-generated weekly insight/suggestions
- If bot is blocked by a user (sendMessage throws), catch and continue — do not crash the cron job
- Cron runs inside the same index.js process (no separate worker)

**Natural language rekap routing**
- "rekap bulan ini", "pengeluaran bulan ini berapa?" etc. route through processMessage — Claude detects intent
- Claude returns two new intent signals via tool_use or a flag: rekap_bulan (monthly summary) and rekap_minggu (weekly summary)
- index.js checks the returned intent and calls the appropriate summary function, then sends the result
- This keeps routing logic in one place and handles phrasing variants naturally

**Commands**
- /start: onboarding message with at least 2-3 concrete examples of how to log expenses in Bahasa Indonesia
- /help: lists all commands (/rekap, /budget, /hapus, /start, /help) with short Bahasa Indonesia descriptions
- Both in casual Bahasa Indonesia

### Claude's Discretion
- Exact wording for budget progress display (e.g. "500rb budget, udah kepake 350rb (70%)")
- Exact wording for 80% and 100% alerts (100% must include a roast)
- /start onboarding text and examples
- /help command descriptions
- Summary header/title format
- How processMessage API change is structured to return intent (rekap_bulan / rekap_minggu) vs isExpense

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CATEG-02 | User can set a monthly budget limit per category via /budget | Budget stored in `data/{userId}_meta.json`; `readMeta`/`writeMeta` in storage.js; /budget command guard before processMessage |
| SUMM-01 | User can request current month expense summary via /rekap command | /rekap guard in index.js before processMessage; `buildSummary` function filters expenses by current UTC month |
| SUMM-02 | User can request summaries via natural language | processMessage extended to return `intent: 'rekap_bulan'`; SYSTEM_PROMPT updated with rekap intent instructions |
| SUMM-03 | User can request weekly summary via natural language | processMessage extended to return `intent: 'rekap_minggu'`; 7-day timestamp filter in summary builder |
| SUMM-04 | Bot auto-sends weekly spending digest every Sunday (03:00 UTC / 10:00 WIB) | node-cron 4.2.1, schedule `'0 3 * * 0'`, cron setup inside `require.main === module` guard in index.js |
| SUMM-05 | Summaries include Claude-generated insights and suggestions | Separate `generateInsight(expenses, period)` call to Claude; appended below category breakdown |
| BUDG-01 | User can set a monthly budget via /budget command | `/budget <amount>` parsed before processMessage; writes `{budget: amount}` to `_meta.json` |
| BUDG-02 | User can view current budget and spending progress via /budget | `/budget` with no arg reads meta + computes current month total via timestamp filter |
| BUDG-03 | Bot warns user when 80% of monthly budget is reached | After `appendExpense`, compute month total; if >= 80% and previous total was < 80%, append warning to reply |
| BUDG-04 | Bot notifies user at 100% budget exceeded, with light roast | Same post-append threshold check at 100%; roast appended to reply |
| BOT-01 | /start delivers onboarding message with concrete BI examples | Static handler before processMessage; casual Bahasa Indonesia text with 3+ logging examples |
| BOT-02 | /help lists all available commands with short BI descriptions | Static handler before processMessage; lists /rekap, /budget, /hapus, /start, /help |
</phase_requirements>

---

## Summary

Phase 3 completes the v1 feature set by adding four categories of work to the existing Node.js/Telegram bot: (1) command handlers for /rekap, /budget, /start, /help; (2) natural-language intent recognition for rekap requests routed through Claude; (3) budget persistence and threshold alerting in the expense logging flow; and (4) a weekly digest cron job.

All work builds directly on established Phase 1/2 patterns. The codebase is CommonJS throughout, uses `node:test` for testing, and applies the `clientOverride` pattern for unit-testability of Claude calls. The single Anthropic API call in `processMessage` is extended from triple-duty to quad-duty by adding two new intent signals (`rekap_bulan`, `rekap_minggu`). Budget state lives in `data/{userId}_meta.json` — a new file type alongside the existing `{userId}.json` expenses array. The cron job runs inside the main process behind the existing `require.main === module` guard.

**Primary recommendation:** Work in four clean units — (a) static commands + summary builder, (b) budget storage + alert wiring, (c) Claude intent extension, (d) cron digest. Each unit is independently testable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | 4.2.1 | Cron scheduling in-process | Lightweight, CJS-compatible (`dist/cjs/node-cron.js`), project decision |
| @anthropic-ai/sdk | ^0.79.0 (already installed) | Claude API for insight generation | Already in use |
| node-telegram-bot-api | ^0.67.0 (already installed) | sendMessage to users | Already in use |
| write-file-atomic | ^7.0.1 (already installed) | Atomic writes for meta files | Already in use for expenses |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | Directory listing for user discovery | `fs.readdir(DATA_DIR)` to enumerate `{userId}.json` files |
| node:test + node:assert | built-in | Unit testing | Existing test runner for all new test files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | node-schedule | node-cron is already the decision; both work equally well for weekly jobs |
| in-process cron | Separate worker / systemd timer | Decided against — simpler deployment |

**Installation:**
```bash
npm install node-cron
```

**Version verification:** `npm view node-cron version` returns `4.2.1` as of 2026-03-17.

---

## Architecture Patterns

### Recommended File Structure Changes
```
index.js         # add cron setup, /rekap, /budget, /start, /help guards
storage.js       # add readMeta(userId), writeMeta(userId, meta)
claude.js        # extend processMessage to return intent field
prompts.js       # extend SYSTEM_PROMPT with rekap intent instructions
summary.js       # NEW: buildSummary(expenses, period), generateInsight(expenses, period, clientOverride)
tests/
  summary.test.js    # NEW: unit tests for summary builder + insight call
  storage.test.js    # EXTEND: tests for readMeta / writeMeta
  budget.test.js     # NEW: unit tests for threshold detection logic
  bot.test.js        # EXTEND: /start, /help, /rekap, /budget command paths
  claude.test.js     # EXTEND: rekap_bulan / rekap_minggu intent returns
```

### Pattern 1: Command Guard Before processMessage (established)
**What:** Exact-match or prefix-match on `text` before calling Claude, return early after handling.
**When to use:** Any Telegram slash command that does not need NLP.
```javascript
// Follows /hapus pattern established in Phase 2
if (text === '/start' || text.startsWith('/start@')) {
  await bot.sendMessage(chatId, START_MESSAGE);
  return;
}
if (text === '/help' || text.startsWith('/help@')) {
  await bot.sendMessage(chatId, HELP_MESSAGE);
  return;
}
if (text === '/rekap' || text.startsWith('/rekap@')) {
  const summary = await buildMonthlySummary(userId, client);
  await bot.sendMessage(chatId, summary);
  return;
}
if (text === '/budget' || text.startsWith('/budget ') || text.startsWith('/budget@')) {
  // parse arg, read/write meta, send reply
  return;
}
```

### Pattern 2: processMessage Intent Extension
**What:** Add `intent` field to processMessage return; `isExpense` remains for backward compat.
**When to use:** Natural language variants of /rekap route through Claude, not command guards.

`processMessage` return shape becomes:
```javascript
// Intent values: 'expense' | 'rekap_bulan' | 'rekap_minggu' | 'redirect'
{
  intent: 'expense',    // or 'rekap_bulan', 'rekap_minggu', 'redirect'
  isExpense: true,      // true only when intent === 'expense' (backward compat)
  expense: { ... },     // present when intent === 'expense'
  reply: '...',         // present for expense and redirect; absent for rekap intents
}
```

SYSTEM_PROMPT extension:
```
Jika pesan = permintaan rekap bulanan (contoh: "rekap bulan ini", "pengeluaran bulan ini berapa?"):
panggil tool report_intent dengan type="rekap_bulan".

Jika pesan = permintaan rekap mingguan (contoh: "rekap minggu ini", "minggu ini berapa?"):
panggil tool report_intent dengan type="rekap_minggu".
```

New `REKAP_TOOL`:
```javascript
const REKAP_TOOL = {
  name: 'report_intent',
  description: 'Signal that the user wants a spending report, not to log an expense.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['rekap_bulan', 'rekap_minggu'],
        description: 'Which period the user is asking about'
      }
    },
    required: ['type']
  }
};
```

index.js routing:
```javascript
const result = await processMessage(userId, text);
if (result.intent === 'rekap_bulan') {
  const summary = await buildMonthlySummary(userId);
  await bot.sendMessage(chatId, summary);
  return;
}
if (result.intent === 'rekap_minggu') {
  const summary = await buildWeeklySummary(userId);
  await bot.sendMessage(chatId, summary);
  return;
}
if (result.isExpense) {
  await storage.appendExpense(userId, result.expense);
  // budget threshold check here
}
await bot.sendMessage(chatId, result.reply);
```

### Pattern 3: Budget Threshold Detection
**What:** After appending an expense, recalculate monthly total and compare to budget. Append a warning to the reply if a threshold was just crossed.
**When to use:** Every expense append when user has a budget set.

```javascript
async function checkBudgetAlert(userId, currentReply) {
  const meta = await storage.readMeta(userId);
  if (!meta.budget) return currentReply;
  const expenses = await storage.readExpenses(userId);
  const now = new Date();
  const monthTotal = expenses
    .filter(e => {
      const d = new Date(e.timestamp);
      return d.getUTCFullYear() === now.getUTCFullYear() &&
             d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((sum, e) => sum + e.amount, 0);
  const pct = monthTotal / meta.budget;
  if (pct >= 1.0 && (monthTotal - lastExpenseAmount) / meta.budget < 1.0) {
    return currentReply + '\n\n' + generate100Alert(meta.budget, monthTotal);
  }
  if (pct >= 0.8 && (monthTotal - lastExpenseAmount) / meta.budget < 0.8) {
    return currentReply + '\n\n' + generate80Alert(meta.budget, monthTotal);
  }
  return currentReply;
}
```

Note: the "just crossed" check requires the expense amount to compute what percent was before. Pass `expense.amount` as a parameter.

### Pattern 4: Cron Setup Inside require.main Guard
**What:** Initialize node-cron inside `if (require.main === module)` so tests that require index.js do not start the scheduler.
**When to use:** Any process-level side effect (polling, cron).

```javascript
const cron = require('node-cron');

if (require.main === module) {
  const bot = new TelegramBot(token, { polling: true });
  // ... message handler ...

  // Weekly digest: every Sunday 03:00 UTC (10:00 WIB)
  cron.schedule('0 3 * * 0', async () => {
    const userIds = await discoverUsers();
    for (const userId of userIds) {
      try {
        const digest = await buildWeeklyDigest(userId);
        if (digest) {
          await bot.sendMessage(userId, digest);
        }
      } catch (err) {
        // User blocked bot or chat not found — log and continue
        console.error(`Weekly digest failed for ${userId}:`, err.message);
      }
    }
  });
}
```

### Pattern 5: User Discovery via data/ Directory
**What:** List all `{userId}.json` files in DATA_DIR to find known users.
**When to use:** Cron job sending to all users.

```javascript
async function discoverUsers() {
  const files = await fs.readdir(DATA_DIR).catch(() => []);
  return files
    .filter(f => f.endsWith('.json') && !f.endsWith('_meta.json'))
    .map(f => f.replace('.json', ''));
}
```

### Pattern 6: Meta Storage (New, Follows Established Storage Pattern)
```javascript
async function readMeta(userId) {
  const file = path.join(DATA_DIR, `${userId}_meta.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeMeta(userId, meta) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const mutex = getMutex(`${userId}_meta`);
  return mutex.runExclusive(async () => {
    const file = path.join(DATA_DIR, `${userId}_meta.json`);
    await writeFileAtomic(file, JSON.stringify(meta, null, 2));
  });
}
```

Note: `getMutex` key must be distinct from expense mutex — use `${userId}_meta` not `${userId}`.

### Pattern 7: Summary Builder (New Module — summary.js)
```javascript
// summary.js
async function buildMonthlySummary(userId, clientOverride) {
  const expenses = await storage.readExpenses(userId);
  const now = new Date();
  const monthly = expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getUTCFullYear() === now.getUTCFullYear() &&
           d.getUTCMonth() === now.getUTCMonth();
  });
  if (monthly.length === 0) {
    return "Bulan ini belum ada pengeluaran yang dicatat. Coba: 'makan siang 35rb'";
  }
  const breakdown = buildBreakdown(monthly);   // group by category, skip zeros
  const insight = await generateInsight(monthly, 'bulanan', clientOverride);
  return formatSummary(breakdown, insight);
}
```

### Anti-Patterns to Avoid
- **Calling Claude inside the cron loop without a per-user try/catch:** Any single API failure or blocked bot error crashes the entire digest run. Each user must be wrapped independently.
- **Using a single mutex key for both expenses and meta:** `getMutex('user123')` is already used for expenses. Meta must use `getMutex('user123_meta')` or a separate mutex map.
- **Checking budget before appendExpense completes:** The threshold check must happen after the expense is durably written, so it reads the updated total.
- **Multi-line expense confirmations:** The 1-sentence rule from Phase 2 applies to confirmations. Budget alert text is appended as a second paragraph — not the same line.
- **Blocking the message handler during digest generation:** Cron runs async in background, does not affect the message handler event loop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom `setTimeout` loop, `setInterval` drift | node-cron | Handles DST, month rollover, cron expression parsing |
| Atomic meta writes | Direct `fs.writeFile` | write-file-atomic (already used) | Same crash-safety needs as expense writes |
| Natural language rekap detection | Regex keyword matching | Claude via REKAP_TOOL | Handles "minggu ini", "7 hari terakhir", "seminggu", etc. with zero regex maintenance |

**Key insight:** The pattern of using Claude for intent detection — already proven for expense vs. off-topic — extends cleanly to rekap_bulan vs. rekap_minggu without any new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Budget "Just Crossed" Logic
**What goes wrong:** Checking `monthTotal >= 0.8 * budget` after every expense fires the alert repeatedly — every expense after the threshold re-triggers the warning.
**Why it happens:** Simple threshold check without memory of previous state.
**How to avoid:** Compute `previousTotal = monthTotal - expense.amount`. Check if `previousTotal < threshold <= monthTotal`. This is a pure calculation — no state needed.
**Warning signs:** Test: add 5 expenses past 80%, should get exactly 1 warning.

### Pitfall 2: node-cron v4 API Change
**What goes wrong:** Using `require('node-cron').schedule(expr, fn)` — this is the correct API for v4. The issue is that older tutorials show `cron.validate(expr)` as a separate method; in v4 it still exists as `cron.validate()`. No breaking change for `schedule()` itself.
**Why it happens:** Version confusion from outdated tutorials.
**How to avoid:** Use `const cron = require('node-cron'); cron.schedule('0 3 * * 0', fn);` — confirmed CJS entry at `dist/cjs/node-cron.js`.
**Warning signs:** `Cannot find module 'node-cron'` — package not yet installed (verify with `npm install node-cron`).

### Pitfall 3: _meta.json Files Showing Up as User IDs
**What goes wrong:** `discoverUsers()` using `f.endsWith('.json')` picks up `123456_meta.json` and tries to send a digest to user `123456_meta`.
**Why it happens:** Simple suffix filter without excluding meta files.
**How to avoid:** Filter: `f.endsWith('.json') && !f.endsWith('_meta.json')`.

### Pitfall 4: Claude Intent Tool With Two Tools Active
**What goes wrong:** When both `log_expense` and `report_intent` tools are passed, Claude may call `log_expense` for a rekap request or vice versa.
**Why it happens:** Ambiguous system prompt instructions or poor tool descriptions.
**How to avoid:** Make SYSTEM_PROMPT instructions mutually exclusive and explicit. Tool descriptions should clearly state triggering conditions. Test with the exact phrases: "rekap bulan ini", "pengeluaran bulan ini berapa?", "rekap minggu ini".

### Pitfall 5: Digest Sent to Users With Zero Expenses This Week
**What goes wrong:** Users who exist in data/ (from months ago) get an empty digest every Sunday.
**Why it happens:** discoverUsers() returns all users regardless of recent activity.
**How to avoid:** In `buildWeeklyDigest`, if filtered expenses (past 7 days) is empty, return `null`. The cron loop skips `null` digests and does not call `sendMessage`.

### Pitfall 6: Month Boundary in Timestamp Filtering
**What goes wrong:** Using local time for month filtering while timestamps are stored in UTC ISO format.
**Why it happens:** `new Date().getMonth()` returns local month, but `new Date(timestamp)` is UTC.
**How to avoid:** Use `getUTCFullYear()` / `getUTCMonth()` consistently for both the current date and stored timestamps. The bot runs on a server — UTC is the safe baseline.

### Pitfall 7: max_tokens Too Small for Summary Responses
**What goes wrong:** Claude's insight generation gets cut off mid-sentence because `max_tokens: 256` is set in the current `processMessage` call.
**Why it happens:** 256 tokens is enough for a 1-sentence confirmation but not for a multi-paragraph summary with insight.
**How to avoid:** The summary insight call must be a separate `client.messages.create` invocation with `max_tokens: 512` or higher (not reusing the main processMessage which is constrained to 256).

---

## Code Examples

### node-cron Basic Setup (CJS)
```javascript
// Source: npm view node-cron exports -- verified 2026-03-17
// CJS entry: ./dist/cjs/node-cron.js
const cron = require('node-cron');

cron.schedule('0 3 * * 0', async () => {
  // runs every Sunday at 03:00 UTC
  console.log('Weekly digest running');
});
```

### Timestamp-Based Month Filter
```javascript
// Filter expenses to current UTC month
function filterCurrentMonth(expenses) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
}
```

### Timestamp-Based Week Filter (past 7 days)
```javascript
function filterPastWeek(expenses) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return expenses.filter(e => new Date(e.timestamp).getTime() >= cutoff);
}
```

### Category Breakdown Aggregation
```javascript
function buildBreakdown(expenses) {
  const map = {};
  for (const e of expenses) {
    if (!map[e.category]) map[e.category] = { total: 0, count: 0 };
    map[e.category].total += e.amount;
    map[e.category].count += 1;
  }
  // Skip zero-spend categories (they won't appear in map anyway)
  return map;
}
```

### Budget Threshold Detection (just-crossed pattern)
```javascript
function detectThreshold(prevTotal, newTotal, budget) {
  const prev = prevTotal / budget;
  const curr = newTotal / budget;
  if (prev < 1.0 && curr >= 1.0) return '100%';
  if (prev < 0.8 && curr >= 0.8) return '80%';
  return null;
}
```

### processMessage Extended Return Shape
```javascript
// claude.js — extended to handle rekap intents
const rekapBlock = response.content.find(
  b => b.type === 'tool_use' && b.name === 'report_intent'
);
if (rekapBlock) {
  return {
    intent: rekapBlock.input.type,  // 'rekap_bulan' or 'rekap_minggu'
    isExpense: false,
  };
}

const expenseBlock = response.content.find(
  b => b.type === 'tool_use' && b.name === 'log_expense'
);
if (expenseBlock) {
  return {
    intent: 'expense',
    isExpense: true,
    expense: { ... },
    reply: expenseBlock.input.reply,
  };
}

return {
  intent: 'redirect',
  isExpense: false,
  reply: textBlock ? textBlock.text : 'fallback',
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-tool processMessage (expense only) | Multi-tool processMessage (expense + rekap) | Phase 3 | index.js must check `intent` field, not just `isExpense` |
| No user state beyond expenses | Meta file `{userId}_meta.json` | Phase 3 | Budget persists across sessions; storage.js gets 2 new exports |
| No scheduled jobs | node-cron inside require.main guard | Phase 3 | Tests that require index.js do not start cron |

**Not deprecated in this phase:**
- `_formatAmount` in index.js — still used for budget progress display (e.g. "500rb" not "500000")
- `clientOverride` pattern — extended to `buildMonthlySummary(userId, clientOverride)` for testability

---

## Open Questions

1. **Max tokens for summary insight call**
   - What we know: main processMessage uses `max_tokens: 256` which is tight for summaries
   - What's unclear: whether 512 is sufficient for a 2-sentence insight over a month of expenses
   - Recommendation: Use `max_tokens: 512` for the insight call; 2 sentences in Bahasa Indonesia is ~80-100 tokens, leaving headroom

2. **Budget threshold: what is "previous total" when checking just-crossed**
   - What we know: `appendExpense` is called before the threshold check in index.js
   - What's unclear: the planner must ensure expense.amount is passed to the threshold checker so `prevTotal = newTotal - expense.amount` works
   - Recommendation: Pass `expense.amount` explicitly into the budget check helper; do not re-read expenses twice

3. **node-cron timezone parameter**
   - What we know: cron.schedule in node-cron v4 accepts a third options object with `{ timezone: 'Asia/Jakarta' }` — allows expressing schedule in WIB directly
   - What's unclear: the decision specifies UTC cron expression `'0 3 * * 0'` — either approach yields 10:00 WIB
   - Recommendation: Use the UTC expression `'0 3 * * 0'` as decided; no timezone option needed

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | none — invoked via `node --test 'tests/*.test.js'` |
| Quick run command | `node --test 'tests/*.test.js'` |
| Full suite command | `node --test 'tests/*.test.js'` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUMM-01 | /rekap returns monthly summary | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/summary.test.js` |
| SUMM-02 | Natural language rekap_bulan intent returned | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/claude.test.js` (extend) |
| SUMM-03 | Natural language rekap_minggu intent returned | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/claude.test.js` (extend) |
| SUMM-04 | Cron job created with correct schedule | unit (index.js smoke) | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/bot.test.js` (extend) |
| SUMM-05 | Summary includes insight string from Claude | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/summary.test.js` |
| BUDG-01 | /budget 500000 writes meta file | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/storage.test.js` (extend) |
| BUDG-02 | /budget (no arg) returns progress string | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/budget.test.js` |
| BUDG-03 | 80% threshold appends warning exactly once | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/budget.test.js` |
| BUDG-04 | 100% threshold appends roast exactly once | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/budget.test.js` |
| CATEG-02 | Budget scoped to single category (if per-category) | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/budget.test.js` |
| BOT-01 | /start returns non-empty Bahasa Indonesia string | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/bot.test.js` (extend) |
| BOT-02 | /help lists all 5 commands | unit | `node --test 'tests/*.test.js'` | ❌ Wave 0: `tests/bot.test.js` (extend) |

### Sampling Rate
- **Per task commit:** `node --test 'tests/*.test.js'`
- **Per wave merge:** `node --test 'tests/*.test.js'`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/summary.test.js` — covers SUMM-01, SUMM-05 (buildMonthlySummary, buildWeeklySummary, generateInsight mock)
- [ ] `tests/budget.test.js` — covers BUDG-02, BUDG-03, BUDG-04, CATEG-02 (detectThreshold, formatProgress, readMeta/writeMeta integration)
- [ ] `tests/storage.test.js` extension — covers BUDG-01 (readMeta returns {}, writeMeta persists budget field)
- [ ] `tests/claude.test.js` extension — covers SUMM-02, SUMM-03 (processMessage returns intent: 'rekap_bulan' and 'rekap_minggu')
- [ ] `tests/bot.test.js` extension — covers BOT-01, BOT-02, SUMM-04 (command guard paths, cron setup does not crash require)

---

## Sources

### Primary (HIGH confidence)
- npm registry: `npm view node-cron version` → 4.2.1 (verified 2026-03-17)
- npm registry: `npm view node-cron exports` → CJS at `./dist/cjs/node-cron.js` (verified 2026-03-17)
- Project source: `index.js`, `claude.js`, `storage.js`, `prompts.js` — established patterns read directly
- Project tests: `tests/claude.test.js`, `tests/storage.test.js`, `tests/bot.test.js` — test patterns read directly
- `package.json` — `node --test 'tests/*.test.js'` test command, existing dependencies

### Secondary (MEDIUM confidence)
- node-cron v4 API: `cron.schedule(expr, fn)` — consistent with npm exports structure and package description

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — node-cron version verified from npm registry; all other packages already installed and in use
- Architecture: HIGH — patterns derived directly from reading existing source files; no assumptions
- Pitfalls: HIGH for code-level pitfalls (derived from reading existing patterns); MEDIUM for cron edge cases (based on node-cron docs structure)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (node-cron is stable; Anthropic model IDs change — re-verify `claude-haiku-4-5` is still current before implementation)
