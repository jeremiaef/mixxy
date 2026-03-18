---
phase: 3
slug: commands-and-reporting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `package.json` (jest config) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | CATEG-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | SUMM-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | SUMM-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 1 | SUMM-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-05 | 01 | 1 | SUMM-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-01-06 | 01 | 1 | SUMM-05 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | BUDG-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | BUDG-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | BUDG-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 2 | BUDG-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | BOT-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | BOT-02 | manual | n/a | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/rekap.test.js` — stubs for SUMM-01 through SUMM-05, CATEG-02
- [ ] `tests/budget.test.js` — stubs for BUDG-01 through BUDG-04
- [ ] `tests/bot-commands.test.js` — stubs for BOT-01 (/start, /help handlers)

*Existing infrastructure covers jest setup and expense/parseExpense tests from Phase 1–2.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Weekly cron fires at 10:00 WIB Sunday | BOT-02 | Time-based scheduler; cannot simulate in unit test | Set cron to 1-minute interval, wait for digest message to arrive in Telegram |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
