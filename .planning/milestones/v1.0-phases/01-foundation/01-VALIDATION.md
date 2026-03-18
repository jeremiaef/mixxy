---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node --test tests/` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | Foundation | unit | `node --test tests/storage.test.js` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | Foundation | integration | `node --test tests/bot.test.js` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | Foundation | unit | `node --test tests/dedup.test.js` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | Foundation | unit | `node --test tests/concurrency.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/storage.test.js` — stubs for file-per-user JSON storage
- [ ] `tests/bot.test.js` — stubs for bot startup and placeholder reply
- [ ] `tests/dedup.test.js` — stubs for polling dedup guard
- [ ] `tests/concurrency.test.js` — stubs for concurrent write safety

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bot responds to real Telegram message | Foundation | Requires live Telegram token and network | Start bot with `node index.js`, send a message from Telegram, confirm placeholder reply |
| .env is gitignored | Foundation | File system state | Run `git status` and confirm `.env` not shown; confirm `.env.example` tracked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
