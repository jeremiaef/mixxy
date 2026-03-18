---
phase: 5
slug: classification-and-command-delivery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node:test (built-in) + assert/strict |
| **Config file** | none — invoked via `node --test 'tests/*.test.js'` |
| **Quick run command** | `node --test 'tests/predict.test.js'` |
| **Full suite command** | `node --test 'tests/*.test.js'` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test 'tests/predict.test.js'`
- **After every plan wave:** Run `node --test 'tests/*.test.js'`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | PRED-05 | unit | `node --test 'tests/predict.test.js'` | ✅ extend | ⬜ pending |
| 5-01-02 | 01 | 1 | PRED-05 | unit | `node --test 'tests/predict.test.js'` | ✅ extend | ⬜ pending |
| 5-01-03 | 01 | 1 | PRED-06 | unit | `node --test 'tests/predict.test.js'` | ✅ extend | ⬜ pending |
| 5-01-04 | 01 | 1 | PRED-07 | unit | `node --test 'tests/predict.test.js'` | ✅ extend | ⬜ pending |
| 5-01-05 | 01 | 2 | PRED-01 | integration | `node --test 'tests/bot.test.js'` | ✅ extend | ⬜ pending |
| 5-01-06 | 01 | 2 | PRED-01 | unit | `node --test 'tests/bot.test.js'` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed; extend `tests/predict.test.js` for PRED-05/PRED-06/PRED-07 and `tests/bot.test.js` for PRED-01 + HELP_MESSAGE assertion.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude API tool_use response parses classification correctly | PRED-05 | Live API call needed for end-to-end verification | Send `/prediksi` in Telegram with 30+ days of test data; confirm each category labeled tetap/variabel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
