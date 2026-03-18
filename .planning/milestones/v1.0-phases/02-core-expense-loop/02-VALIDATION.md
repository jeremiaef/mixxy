---
phase: 2
slug: core-expense-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node 24) |
| **Config file** | none — invoked via `node --test 'tests/*.test.js'` |
| **Quick run command** | `node --test 'tests/claude.test.js'` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test 'tests/claude.test.js'`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | CORE-01, CORE-02, CORE-03, CATEG-01, PERS-01, BOT-03 | unit | `node --test 'tests/claude.test.js'` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | CORE-01, CORE-02 | unit | `node --test 'tests/claude.test.js'` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | CORE-03, PERS-01 | unit | `node --test 'tests/claude.test.js'` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | CATEG-01 | unit | `node --test 'tests/claude.test.js'` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | BOT-03 | unit | `node --test 'tests/claude.test.js'` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | CORE-04 | unit | `node --test 'tests/bot.test.js'` | ✅ extend | ⬜ pending |
| 2-02-02 | 02 | 2 | PERS-02 | manual | n/a | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/claude.test.js` — stub test file covering CORE-01, CORE-02, CORE-03, CATEG-01, PERS-01, BOT-03 with mocked Anthropic client
- [ ] `processMessage(userId, text, clientOverride)` — must accept optional 3rd param for testability (design requirement, not a separate file)

*Existing `tests/bot.test.js` and `tests/storage.test.js` infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cleo-style roast when amount is high | PERS-02 | Roast trigger requires live Claude judgment on contextual appropriateness; mock can't validate when Claude "decides" to roast | Send 3+ expensive messages (e.g. "kopi 200rb", "makan 150rb") and verify at least one response includes a sharp, witty roast appended to the confirmation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
