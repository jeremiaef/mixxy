# Phase 2: Core Expense Loop - Research

**Researched:** 2026-03-17
**Domain:** Anthropic tool_use API, Bahasa Indonesia NLP, Telegram message routing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Confirmation Reply Style**
- Show all three fields: amount + category + description — e.g. "Oke, nasi goreng 35rb (makan) dicatat!"
- Always casual personality — varied phrasings every time ("Oke!", "Siip!", "Noted ya") — Claude generates wording, not a template
- Emoji: Claude decides per-message — a food emoji for makan, skip it for tagihan — organic, not forced
- Length: 1 line max — texting-friend speed, no multi-line responses

**Non-Expense Handling (BOT-03)**
- Claude generates the redirect — same API call detects no tool was called = not an expense
- Response is short, friendly, always includes an example: e.g. "Gue cuma bisa bantu catat pengeluaran. Coba: 'makan siang 35rb' 😊"
- The example is always included — teaches the pattern every time, especially for new users
- No separate hardcoded fallback — personality stays consistent through Claude

**/hapus Response**
- Name the deleted item explicitly: "Dihapus: nasi goreng 35rb (makan)" — user sees what was removed, can catch mistakes
- If nothing to delete: "Belum ada pengeluaran yang dicatat." — short, casual, no error tone, no nudge

**Roast Trigger Context**
- Expense amount only — no budget context needed
- Claude decides when an amount warrants a roast based on the expense alone (e.g. "200rb buat kopi?")
- Works immediately for all users, even before any budget is set
- Roast intensity: Cleo-style, sharper wit — "literally where does your money go" energy, not just light teasing
- Roast is appended to the confirmation line (keeping 1-line limit means roast replaces or is the confirmation line)

### Claude's Discretion
- Exact tool schema for expense extraction (tool name, field names, required vs optional)
- System prompt length and structure in prompts.js
- How to distinguish "35rb" from "35.000" from "35ribu" — Claude handles all Indonesian amount formats
- Error handling when Claude API is unavailable

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | User can log an expense by typing naturally in Bahasa Indonesia (e.g. "tadi makan siang 35rb") | tool_use API with well-crafted system prompt handles free-text; model understands Indonesian |
| CORE-02 | Claude extracts amount, category, description from free-text via tool_use — including Indonesian slang (35rb, 1.5jt, 22ribu, dua ratus ribu) | Single `log_expense` tool call; system prompt instructs Claude to normalize all IDR variants to integer |
| CORE-03 | Bot replies with a short confirmation in casual Bahasa Indonesia after each logged expense | Claude generates reply text in the tool call's `reply` field, or as a text block when no tool used |
| CORE-04 | User can delete the last logged expense via /hapus command | `/hapus` bypasses Claude entirely; calls `storage.popExpense()` directly, formats hardcoded-style reply from returned object |
| CATEG-01 | Bot auto-categorizes every expense into one of 9 Indonesian categories | `category` is a required enum field in tool schema; system prompt lists the 9 categories |
| PERS-01 | All bot responses use casual Bahasa Indonesia — "kamu" not "anda", short replies | Enforced via system prompt persona instructions |
| PERS-02 | Bot applies Cleo-style roast when user overspends — Claude decides when | System prompt grants Claude discretion to roast; no external trigger needed |
| BOT-03 | Bot handles off-topic messages gracefully — redirects back to finance context | Detected by absence of `tool_use` block in response; Claude's text block IS the redirect reply |
</phase_requirements>

---

## Summary

This phase wires together three components: the Anthropic SDK (not yet installed), a tool schema that captures expense data, and the Telegram message handler. The critical insight from CONTEXT.md is that a **single Claude API call handles everything**: if Claude calls the `log_expense` tool, the message is an expense; if Claude returns only a text block (no tool called), the message is off-topic and that text IS the redirect reply. This eliminates a separate intent-classification step.

The Anthropic SDK (`@anthropic-ai/sdk` v0.79.0) is the standard Node.js client and must be installed. It works in CommonJS with `require()`. The recommended model is `claude-haiku-4-5` for this use case — it is the fastest current model, the task is simple extraction, and cost matters at scale. Haiku 4.5's IDR slang understanding is adequate; the system prompt handles all edge cases explicitly.

The `/hapus` command is handled outside Claude entirely — it is a pure storage operation with a deterministic reply format. This keeps the Claude call path clean and avoids wasting tokens on a trivial operation.

**Primary recommendation:** Install `@anthropic-ai/sdk`, implement `claude.processMessage()` using a single `messages.create()` call with one `log_expense` tool, detect tool use vs. text response to route expense vs. off-topic, and handle `/hapus` as a direct storage call.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.79.0 (latest) | Anthropic API client — tool_use, messages | Official SDK; CJS-compatible via `require()` |
| node-telegram-bot-api | 0.67.0 (already installed) | Telegram polling, sendMessage | Already in project |
| dotenv | 17.3.1 (already installed) | ANTHROPIC_API_KEY env var | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test + node:assert | built-in (Node 24) | Unit tests for claude.js | Already used in Phase 1 test suite |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| claude-haiku-4-5 | claude-sonnet-4-6 | Sonnet is 3x more expensive per token; Haiku is sufficient for structured extraction |
| Single tool + reply field | Two API calls (extract then reply) | Two calls doubles latency and cost; single call is the correct pattern |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```

**Version verification (confirmed 2026-03-17):**
```
@anthropic-ai/sdk: 0.79.0 (dist-tags.latest)
```

---

## Architecture Patterns

### Recommended Project Structure

No new files needed — Phase 1 created all stubs:
```
index.js      — add /hapus routing + call claude.processMessage()
claude.js     — implement processMessage(userId, text) — the main Phase 2 deliverable
prompts.js    — export SYSTEM_PROMPT string
tests/
└── claude.test.js   — new: unit tests for processMessage (mocked API)
```

### Pattern 1: Single-Call Tool Use for Expense Extraction

**What:** One `messages.create()` call does intent classification AND data extraction simultaneously. If Claude uses the `log_expense` tool, it's an expense. If Claude returns only text, it's off-topic.

**When to use:** Any time you need to both classify intent and extract structured data from the same input.

**Tool schema (Claude's discretion to finalize field names, but this is the recommended structure):**
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/tool-use/overview
const EXPENSE_TOOL = {
  name: 'log_expense',
  description: 'Log a user expense. Call this when the user message describes spending money.',
  input_schema: {
    type: 'object',
    properties: {
      amount: {
        type: 'integer',
        description: 'Amount in IDR as plain integer. Convert all formats: "35rb"->35000, "1.5jt"->1500000, "22ribu"->22000, "dua ratus ribu"->200000, "35K"->35000'
      },
      category: {
        type: 'string',
        enum: ['makan', 'transport', 'hiburan', 'tagihan', 'kost', 'pulsa', 'ojol', 'jajan', 'lainnya'],
        description: 'Best matching category for the expense'
      },
      description: {
        type: 'string',
        description: 'Short description of what was purchased, in the user\'s own words'
      },
      reply: {
        type: 'string',
        description: 'The confirmation message to send back to the user in casual Bahasa Indonesia, 1 line max. Include roast if amount is notably large for the category.'
      }
    },
    required: ['amount', 'category', 'description', 'reply']
  }
};
```

**Pattern 2: Tool call detection (expense vs. off-topic)**
```javascript
// Source: Anthropic tool_use docs — stop_reason and content block type
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 256,
  system: SYSTEM_PROMPT,
  tools: [EXPENSE_TOOL],
  messages: [{ role: 'user', content: text }]
});

const toolBlock = response.content.find(b => b.type === 'tool_use');
if (toolBlock) {
  // expense path: toolBlock.input has { amount, category, description, reply }
  const { amount, category, description, reply } = toolBlock.input;
  await storage.appendExpense(userId, { amount, category, description });
  return { isExpense: true, reply };
} else {
  // off-topic path: Claude's text IS the redirect message
  const textBlock = response.content.find(b => b.type === 'text');
  return { isExpense: false, reply: textBlock.text };
}
```

### Pattern 3: /hapus Direct Storage Path (no Claude involved)

```javascript
// index.js message handler
if (text === '/hapus') {
  const removed = await storage.popExpense(userId);
  if (removed) {
    const amountFormatted = (removed.amount / 1000).toFixed(0) + 'rb';
    reply = `Dihapus: ${removed.description} ${amountFormatted} (${removed.category})`;
  } else {
    reply = 'Belum ada pengeluaran yang dicatat.';
  }
  await bot.sendMessage(chatId, reply);
  return;
}
// ... then call claude.processMessage() for non-commands
```

### Anti-Patterns to Avoid

- **Two-step classify then extract:** Making one API call to detect intent then a second to extract fields wastes tokens and adds latency. The single tool call approach does both.
- **Regex-based Indonesian amount parsing:** Indonesian amount slang has too many variants (35rb, 35K, 35ribu, tiga puluh lima ribu, 35.000, 0.035jt). Claude handles this reliably in the tool schema description — don't hand-roll a parser.
- **Hardcoding reply templates in index.js:** CONTEXT.md explicitly requires Claude to generate varied reply text. Never call `bot.sendMessage` with a template string for expense confirmations — only use what comes back from `toolBlock.input.reply`.
- **Passing userId to Claude:** Claude doesn't need user history for Phase 2. Don't send conversation history or user spend summaries — keep the API call stateless and cheap.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Indonesian amount parsing | Custom regex/grammar for "35rb", "1.5jt", "dua ratus ribu" | Claude via tool schema description | 50+ variants exist; written-out numbers ("dua ratus") require genuine language understanding |
| Intent classification | Keyword matching for "is this an expense?" | Tool use absence detection | Claude's judgment is more robust; keyword lists miss novel phrasings |
| Reply template generation | String interpolation with random phrase picker | Claude's `reply` field in tool input | Context-aware replies require language model judgment (e.g., roast trigger) |
| Category mapping | Keyword → category lookup table | Claude's category enum in tool schema | Category inference requires semantic understanding ("ngopi" → jajan vs. makan) |

**Key insight:** The Anthropic tool_use API is doing triple duty here — intent classification, data extraction, and reply generation — all in one call. Custom solutions for any of these layers would be more fragile and more expensive to maintain.

---

## Common Pitfalls

### Pitfall 1: Anthropic SDK Not Installed

**What goes wrong:** `claude.js` does `require('@anthropic-ai/sdk')` but the package isn't in `node_modules` — immediate runtime crash.
**Why it happens:** Phase 1 didn't install it (it was a stub file).
**How to avoid:** First task of Phase 2 must be `npm install @anthropic-ai/sdk`.
**Warning signs:** `MODULE_NOT_FOUND` error on startup.

### Pitfall 2: Missing ANTHROPIC_API_KEY

**What goes wrong:** SDK initializes but `messages.create()` returns 401 / throws AuthenticationError.
**Why it happens:** `.env` only has `TELEGRAM_TOKEN` from Phase 1.
**How to avoid:** Add `ANTHROPIC_API_KEY=...` to `.env` and `.env.example`; check for it at startup like TELEGRAM_TOKEN is checked.
**Warning signs:** Bot starts but replies with an error message (or crashes) on first user message.

### Pitfall 3: tool_use stop_reason vs. content block type

**What goes wrong:** Checking `response.stop_reason === 'tool_use'` but the content check uses wrong field, or checking `content[0]` directly instead of finding by type.
**Why it happens:** When Claude uses a tool, the response has `stop_reason: 'tool_use'` AND `content` is an array that may contain both text blocks and tool_use blocks. Array index 0 is not guaranteed to be the tool block.
**How to avoid:** Always use `response.content.find(b => b.type === 'tool_use')` to locate the tool block. Check for null before accessing `.input`.
**Warning signs:** Occasional `Cannot read properties of undefined` when content array order varies.

### Pitfall 4: Amount Formatting in /hapus Reply

**What goes wrong:** Displaying raw `35000` in the deletion confirmation instead of "35rb".
**Why it happens:** `popExpense()` returns the stored integer; the reply format is a code-side decision.
**How to avoid:** Format amount for display: amounts < 1,000,000 divide by 1,000 and append "rb"; amounts >= 1,000,000 divide by 1,000,000 and append "jt". This matches the user's mental model.
**Warning signs:** "Dihapus: nasi goreng 35000 (makan)" — confusing to users.

### Pitfall 5: Claude Generates Multi-line or Verbose Replies

**What goes wrong:** Despite system prompt instructions, Claude occasionally returns multi-sentence confirmations.
**Why it happens:** Claude's default verbosity; system prompt constraints need to be explicit and repeated.
**How to avoid:** Include explicit constraints in the system prompt AND in the `reply` field description: "1 line max, no newlines, texting-friend register". Test with several phrasings to validate.
**Warning signs:** Confirmation messages with `\n` characters or longer than ~80 chars.

### Pitfall 6: /hapus Triggers Claude API Call

**What goes wrong:** `/hapus` gets passed to `claude.processMessage()` and Claude gets confused, possibly logging a phantom expense named "hapus".
**Why it happens:** index.js doesn't check for the command before the Claude call.
**How to avoid:** Route `/hapus` (and all future `/` commands) BEFORE the Claude call in the message handler. Check `text.startsWith('/')` or exact match before any API call.
**Warning signs:** "Dihapus" never works; instead produces strange confirmations.

---

## Code Examples

### Anthropic SDK — CommonJS require pattern (verified)

```javascript
// Source: @anthropic-ai/sdk README and npm package
'use strict';
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY  // or omit — SDK reads env var automatically
});
```

Note: The SDK auto-reads `ANTHROPIC_API_KEY` from environment if no `apiKey` option is provided. Both patterns work.

### Full processMessage() structure

```javascript
// Source: Anthropic tool_use docs + project conventions
async function processMessage(userId, text) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: prompts.SYSTEM_PROMPT,
    tools: [prompts.EXPENSE_TOOL],
    messages: [{ role: 'user', content: text }]
  });

  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (toolBlock) {
    return {
      isExpense: true,
      expense: {
        amount: toolBlock.input.amount,
        category: toolBlock.input.category,
        description: toolBlock.input.description,
      },
      reply: toolBlock.input.reply,
    };
  }

  // No tool called — off-topic message, Claude's text is the redirect
  const textBlock = response.content.find(b => b.type === 'text');
  return {
    isExpense: false,
    reply: textBlock ? textBlock.text : 'Hm, gue kurang ngerti. Coba: "makan siang 35rb" 😊',
  };
}
```

### System prompt skeleton

```javascript
// prompts.js — export SYSTEM_PROMPT and EXPENSE_TOOL
const SYSTEM_PROMPT = `Kamu adalah Mixxy, asisten pencatat pengeluaran via Telegram.
Bahasa: Bahasa Indonesia kasual. Pakai "kamu" bukan "anda". Maksimal 1 kalimat per respons.
Tugas utama: catat pengeluaran dari pesan bebas.

Jika pesan = pengeluaran: panggil tool log_expense. Field reply = konfirmasi 1 baris, kasual, boleh pakai emoji sesuai konteks.
Jika jumlah terasa besar untuk kategorinya, tambahkan roast tajam di field reply (contoh: "Siipp, kopi 75rb dicatat — emang uang lo kertas?").
Jika pesan BUKAN pengeluaran: balas teks singkat, redirect ke contoh pengeluaran. JANGAN jawab pertanyaan umum.`;
```

### Test pattern for claude.js (with mock)

```javascript
// Source: Node:test built-in + module mock pattern consistent with existing tests
'use strict';
const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');

// Mock before requiring claude.js
// Pattern: override require cache or use dependency injection
// Simplest for CJS: export a setClient() or accept client as parameter
```

Note: Testing `claude.js` requires either dependency injection (pass client as param) or mocking the Anthropic constructor. The planner should design `processMessage` to accept an optional `client` parameter for testability.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `claude-3-haiku-20240307` | `claude-haiku-4-5` (alias) | Haiku 4.5 released 2025 | Haiku 3 deprecated April 19 2026 — do not use |
| `claude-3-sonnet-*` | `claude-sonnet-4-6` | Mid-2025 | All 3.x models deprecated or deprecated path |
| Checking `response.stop_reason` only | Check `response.content.find(b => b.type === 'tool_use')` | Current docs | More robust — stop_reason is a hint, content blocks are the truth |

**Deprecated / do not use:**
- `claude-3-haiku-20240307`: Deprecated, retires April 19 2026
- Any `claude-3-*` model: legacy, lower capability, higher per-token cost relative to Haiku 4.5
- Model ID `claude-haiku-4-5-20251001`: Use alias `claude-haiku-4-5` — cleaner and forward-compatible

---

## Open Questions

1. **Testability of claude.js without live API**
   - What we know: Node:test has `mock` module; existing tests don't mock external APIs
   - What's unclear: Best CJS-compatible pattern for mocking `@anthropic-ai/sdk` constructor without TypeScript or ESM
   - Recommendation: Design `processMessage(userId, text, clientOverride)` — accept optional Anthropic client instance as third parameter. Tests pass a mock client; production passes nothing (default to module-level client).

2. **ANTHROPIC_API_KEY missing at startup — fail-fast or degrade gracefully?**
   - What we know: TELEGRAM_TOKEN uses fail-fast (throws on missing). CONTEXT.md marks error handling as Claude's discretion.
   - What's unclear: Whether to throw at startup or only when first message arrives
   - Recommendation: Fail-fast at startup (same pattern as TELEGRAM_TOKEN check in index.js). A bot with no Claude key is non-functional.

3. **max_tokens for Haiku call**
   - What we know: Confirmation reply is 1 line; tool input JSON adds overhead
   - What's unclear: Exact token budget needed for tool_use response
   - Recommendation: Use 256 tokens. Tool schema overhead + 1-line reply + JSON wrapping comfortably fits within 256. Increase to 512 only if truncation occurs.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 24) |
| Config file | none — invoked via `node --test 'tests/*.test.js'` |
| Quick run command | `node --test 'tests/claude.test.js'` |
| Full suite command | `npm test` (runs all `tests/*.test.js`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | processMessage returns isExpense:true for expense text | unit | `node --test 'tests/claude.test.js'` | ❌ Wave 0 |
| CORE-02 | Amount normalization: "35rb"→35000, "1.5jt"→1500000, "22ribu"→22000 | unit | `node --test 'tests/claude.test.js'` | ❌ Wave 0 |
| CORE-02 | Category returned is one of 9 valid values | unit | `node --test 'tests/claude.test.js'` | ❌ Wave 0 |
| CORE-03 | reply field is non-empty string, no newlines | unit | `node --test 'tests/claude.test.js'` | ❌ Wave 0 |
| CORE-04 | /hapus routing in index.js calls popExpense, not Claude | unit | `node --test 'tests/bot.test.js'` | ❌ extend existing |
| CATEG-01 | category is always one of the enum values | unit | `node --test 'tests/claude.test.js'` | ❌ Wave 0 |
| PERS-01 | reply does not contain "anda" | unit | `node --test 'tests/claude.test.js'` | ❌ Wave 0 |
| PERS-02 | roast behavior: manual-only (requires live API + subjective judgment) | manual | n/a | manual-only |
| BOT-03 | processMessage returns isExpense:false for off-topic input | unit | `node --test 'tests/claude.test.js'` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test 'tests/claude.test.js'`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/claude.test.js` — covers CORE-01, CORE-02, CORE-03, CATEG-01, PERS-01, BOT-03 (all with mocked Anthropic client)
- [ ] `processMessage` must accept `clientOverride` parameter for testability — design requirement

---

## Sources

### Primary (HIGH confidence)

- `https://platform.claude.com/docs/en/docs/models-overview` — verified model IDs (claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-6), context windows, pricing, deprecation dates (2026-03-17)
- `https://platform.claude.com/docs/en/build-with-claude/tool-use/overview` — tool schema structure, `input_schema` field names, content block detection pattern, stop_reason semantics (2026-03-17)
- `npm view @anthropic-ai/sdk version` → 0.79.0 (verified 2026-03-17)

### Secondary (MEDIUM confidence)

- Existing project code (`storage.js`, `index.js`, `tests/storage.test.js`) — confirmed CJS patterns, Node:test usage, DATA_DIR isolation pattern

### Tertiary (LOW confidence)

- Token budget estimate (256 max_tokens) — estimated from tool schema size; validate empirically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, official Anthropic docs checked same day
- Architecture: HIGH — patterns drawn directly from official tool_use documentation
- Pitfalls: HIGH — derived from reading actual project code + official API docs
- Test approach: MEDIUM — Node:test mock CJS pattern untested; dependency injection recommendation is a safe workaround

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (model IDs stable; SDK minor versions may update but are backward compatible)
