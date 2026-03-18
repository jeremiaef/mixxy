---
phase: 05-classification-and-command-delivery
plan: 01
subsystem: prediction
tags: [classification, formatting, savings-headroom, tool-use, tdd]
dependency_graph:
  requires: [predict.js/buildPrediction, prompts.js, storage.js, @anthropic-ai/sdk]
  provides: [classifyPrediction, _formatPrediction, PREDICT_CLASSIFY_TOOL]
  affects: [predict.js, prompts.js, tests/predict.test.js]
tech_stack:
  added: []
  patterns: [clientOverride-spy, local-_formatAmount-clone, tool_choice-required, max-min-variance]
key_files:
  created: []
  modified:
    - prompts.js
    - predict.js
    - tests/predict.test.js
decisions:
  - "PREDICT_CLASSIFY_TOOL uses tool_choice required to guarantee structured tetap/variabel output"
  - "kost hardcoded as tetap without Claude call per roadmap decision — saves tokens, prevents misclassification"
  - "kurang data categories filtered from Claude call (typeof value === 'number' guard)"
  - "savings headroom uses max-min range variance, requires >= 2 active windows per category"
  - "local _formatAmount clone in predict.js — avoids circular dep with index.js (same pattern as budget.js)"
  - "_formatPrediction is pure synchronous function — no async, no Claude, testable without mocks"
  - "classifyPrediction re-reads expenses for variance computation (Option A — no interface change to buildPrediction)"
metrics:
  duration: 3 minutes
  completed: 2026-03-18
  tasks_completed: 2
  files_modified: 3
---

# Phase 5 Plan 1: Classification and Formatting Summary

**One-liner:** Claude-powered tetap/variabel classification via PREDICT_CLASSIFY_TOOL with JS variance-based savings headroom and hedged Bahasa Indonesia output formatting.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PREDICT_CLASSIFY_TOOL, classifyPrediction, _formatPrediction | 8a25b4a | prompts.js, predict.js |
| 2 | Add PRED-05, PRED-06, PRED-07 test blocks (Tests 15-25) | cff1793 | tests/predict.test.js |

## What Was Built

### prompts.js
- Added `PREDICT_CLASSIFY_TOOL` constant with `classify_categories` tool schema
- Schema uses `additionalProperties: { type: 'string', enum: ['tetap', 'variabel'] }` for structured map output
- Exported alongside existing `SYSTEM_PROMPT`, `EXPENSE_TOOL`, `REKAP_TOOL`

### predict.js
- Added `classifyPrediction(userId, _options, clientOverride)` orchestrator:
  - Calls `buildPrediction()` first; returns `{ sufficient: false, daysLogged }` if gate fails
  - Pre-populates `kost = 'tetap'` without Claude call
  - Filters to numeric categories only (`typeof val === 'number' && cat !== 'kost'`)
  - Single batch Claude call via `tool_choice: { type: 'tool', name: 'classify_categories' }`
  - Re-reads expenses for variance computation; uses max-min range per variable category
  - Requires >= 2 active windows with data per category for savings suggestion
  - Returns `{ sufficient, monthsUsed, categories, classifications, savings }`
- Added `_formatPrediction(result)` pure synchronous formatter:
  - Insufficient data path: `"Data kamu baru X hari — butuh minimal 30 hari..."`
  - Sufficient path: header + category rows (emoji + name + label + ~Rp amount) + total + optional savings footer
- Added local `_formatAmount(amount)` clone (prevents circular dep with index.js)
- Added `CATEGORY_EMOJI` map for 9 supported categories

### tests/predict.test.js
- Updated import to include `classifyPrediction` and `_formatPrediction`
- Added 11 new tests (Tests 15-25) across 3 new describe blocks:
  - PRED-05: Tests 15-17 (classification correctness, insufficient path, kurang data filtering)
  - PRED-06: Tests 18-20 (savings min/avg/headroom, null when 1 window, highest-variance selection)
  - PRED-07: Tests 21-25 (header, total, insufficient message, savings footer, kurang data row)
- All 25 tests pass; zero real Anthropic API calls (clientOverride spy pattern throughout)

## Verification Results

- `node -c prompts.js` — syntax OK
- `node -c predict.js` — syntax OK
- `node --test 'tests/predict.test.js'` — 25/25 tests pass
- No `require('./index')` in predict.js — no circular dep

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
