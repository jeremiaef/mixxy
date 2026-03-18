---
phase: 4
slug: prediction-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) — Node 24 |
| **Config file** | None — `npm test` glob in package.json covers `tests/*.test.js` |
| **Quick run command** | `node --test 'tests/predict.test.js'` |
| **Full suite command** | `node --test 'tests/*.test.js'` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test 'tests/predict.test.js'`
- **After every plan wave:** Run `node --test 'tests/*.test.js'`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | PRED-02, PRED-03, PRED-04 | unit stub | `node --test 'tests/predict.test.js'` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | PRED-02 | unit | `node --test 'tests/predict.test.js'` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | PRED-03 | unit | `node --test 'tests/predict.test.js'` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 1 | PRED-04 | unit | `node --test 'tests/predict.test.js'` | ❌ W0 | ⬜ pending |
| 4-01-05 | 01 | 1 | All | unit (spy) | `node --test 'tests/predict.test.js'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `predict.js` — module under test (must exist before tests can run)
- [ ] `tests/predict.test.js` — covers all PRED-02, PRED-03, PRED-04 behaviors

*No framework or config gaps — Node:test is built-in and package.json glob already covers `tests/*.test.js`.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
