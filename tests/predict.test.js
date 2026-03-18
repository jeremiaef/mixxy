'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

const tmpDataDir = path.join(__dirname, `tmp-predict-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.DATA_DIR = tmpDataDir;
process.env.ANTHROPIC_API_KEY = 'test-key';

const { buildPrediction, _selectMonthWindows, _computeCategories } = require('../predict.js');
const { appendExpense } = require('../storage.js');

// Fixture "now" date: March 18, 2026 at 12:00 UTC
const NOW = new Date('2026-03-18T12:00:00.000Z');

// Fixture UTC timestamps for complete months before NOW
// February 2026 (m-1)
const FEB_DAY1 = '2026-02-05T08:00:00.000Z';
const FEB_DAY2 = '2026-02-12T08:00:00.000Z';
const FEB_DAY3 = '2026-02-20T08:00:00.000Z';

// January 2026 (m-2)
const JAN_DAY1 = '2026-01-07T08:00:00.000Z';
const JAN_DAY2 = '2026-01-14T08:00:00.000Z';
const JAN_DAY3 = '2026-01-21T08:00:00.000Z';

// December 2025 (m-3)
const DEC_DAY1 = '2025-12-03T08:00:00.000Z';
const DEC_DAY2 = '2025-12-10T08:00:00.000Z';
const DEC_DAY3 = '2025-12-17T08:00:00.000Z';

// Old expense >= 90 days ago from NOW (passes 30-day gate)
const OLD_EXPENSE = '2025-12-01T08:00:00.000Z'; // > 30 days before March 18, 2026

describe('_selectMonthWindows helper', () => {
  it('returns [Feb, Jan, Dec] when now is in March 2026', () => {
    const now = new Date('2026-03-18T12:00:00.000Z');
    const windows = _selectMonthWindows(now);
    assert.deepEqual(windows, [
      { year: 2026, month: 1 }, // February (month index 1)
      { year: 2026, month: 0 }, // January (month index 0)
      { year: 2025, month: 11 }, // December (month index 11)
    ]);
  });

  it('wraps correctly when now is in January 2026 — returns [Dec, Nov, Oct]', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    const windows = _selectMonthWindows(now);
    assert.deepEqual(windows, [
      { year: 2025, month: 11 }, // December
      { year: 2025, month: 10 }, // November
      { year: 2025, month: 9 },  // October
    ]);
  });
});

describe('PRED-02 — History gate', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('Test 3: Empty expenses array returns { sufficient: false }', async () => {
    const result = await buildPrediction('gate-user-empty', { now: NOW }, null);
    assert.deepEqual(result, { sufficient: false });
  });

  it('Test 4: All expenses within last 29 days returns { sufficient: false }', async () => {
    // 29 days before NOW = Feb 17, 2026
    const recentDate = '2026-02-17T12:00:00.000Z';
    await appendExpense('gate-user-recent', { amount: 50000, category: 'makan', description: 'test', timestamp: recentDate });
    const result = await buildPrediction('gate-user-recent', { now: NOW }, null);
    assert.deepEqual(result, { sufficient: false });
  });

  it('Test 5: Earliest expense exactly 30 days ago passes the gate (sufficient: true)', async () => {
    // Exactly 30 days before NOW = Feb 16, 2026 12:00 UTC
    const exactly30 = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await appendExpense('gate-user-30', { amount: 50000, category: 'makan', description: 'test', timestamp: exactly30 });
    const result = await buildPrediction('gate-user-30', { now: NOW }, null);
    // Gate passes but may not have monthsUsed data — could return sufficient: true with empty or sparse categories
    assert.equal(result.sufficient, true);
  });
});

describe('PRED-03 — Weighted average computation', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('Test 6: 3 months of makan data → weighted estimate 83400', async () => {
    const userId = 'weight-user-3m';
    // Seed old expense first to guarantee 30-day gate passes
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old', timestamp: OLD_EXPENSE });

    // December 2025 (m-3): total 60000 across 3 distinct days
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec1', timestamp: DEC_DAY1 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec2', timestamp: DEC_DAY2 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec3', timestamp: DEC_DAY3 });

    // January 2026 (m-2): total 80000 across 3 distinct days
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 26666, category: 'makan', description: 'jan3', timestamp: JAN_DAY3 });

    // February 2026 (m-1): total 100000 across 3 distinct days
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.equal(result.monthsUsed, 3);
    // Expected: Math.round(100000*0.42 + 80000*0.33 + 60000*0.25)
    // = Math.round(42000 + 26400 + 15000) = Math.round(83400) = 83400
    // Note: Actual monthly totals depend on sum of appended amounts
    // Feb: 33334+33333+33333 = 100000, Jan: 26667+26667+26666 = 80000, Dec: 20000+20000+20000 = 60000
    assert.equal(result.categories.makan, 83400);
  });

  it('Test 7: Only 2 complete months exist → 56/44% weights, monthsUsed=2', async () => {
    const userId = 'weight-user-2m';
    // Old expense to pass gate (in Dec 2025, > 30 days ago)
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });

    // January 2026 (m-2): total 80000 across 3 distinct days
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 26666, category: 'makan', description: 'jan3', timestamp: JAN_DAY3 });

    // February 2026 (m-1): total 100000 across 3 distinct days
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.equal(result.monthsUsed, 2);
    // Expected: Math.round(100000*0.56 + 80000*0.44)
    // = Math.round(56000 + 35200) = Math.round(91200) = 91200
    assert.equal(result.categories.makan, 91200);
  });

  it('Test 8: Only 1 complete month (gate passes) → 100% weight, monthsUsed=1', async () => {
    const userId = 'weight-user-1m';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });

    // February 2026 (m-1): total 100000 across 3 distinct days
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.equal(result.monthsUsed, 1);
    // Expected: Math.round(100000*1.00) = 100000
    assert.equal(result.categories.makan, 100000);
  });

  it('Test 9: Category in only 1 of 3 months (hiburan in Feb only) → weighted by 42%', async () => {
    const userId = 'weight-user-partial';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });

    // makan in all 3 months (3 distinct days each) to ensure 3 months are active
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec1', timestamp: DEC_DAY1 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec2', timestamp: DEC_DAY2 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec3', timestamp: DEC_DAY3 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 26666, category: 'makan', description: 'jan3', timestamp: JAN_DAY3 });
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    // hiburan only in February (3 distinct days, total 50000)
    await appendExpense(userId, { amount: 16667, category: 'hiburan', description: 'hib-feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 16667, category: 'hiburan', description: 'hib-feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 16666, category: 'hiburan', description: 'hib-feb3', timestamp: FEB_DAY3 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.equal(result.monthsUsed, 3);
    // hiburan only in Feb (m-1 = 42% weight): Math.round(50000*0.42 + 0*0.33 + 0*0.25) = Math.round(21000) = 21000
    assert.equal(result.categories.hiburan, 21000);
  });

  it('Test 10: monthsUsed field matches actual complete months used', async () => {
    const userId = 'months-used-user';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });

    // Only January (m-2) and February (m-1) have data — December has none
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 26666, category: 'makan', description: 'jan3', timestamp: JAN_DAY3 });
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.equal(result.monthsUsed, 2);
  });
});

describe('PRED-04 — Sparsity gate', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('Test 11: Category with 5 expenses all on 2 distinct UTC days returns kurang data', async () => {
    const userId = 'sparse-user-2days';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });
    // makan in Feb with 3 distinct days (so it passes sparsity)
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    // transport: 5 expenses but only 2 distinct UTC days — should return kurang data
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't2', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't3', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't4', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't5', timestamp: FEB_DAY2 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.equal(result.categories.transport, 'kurang data');
  });

  it('Test 12: Category with 3 expenses on 3 distinct UTC days returns numeric estimate', async () => {
    const userId = 'sparse-user-3days';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });

    // transport: 3 expenses on 3 distinct UTC days in Feb
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 20000, category: 'transport', description: 't3', timestamp: FEB_DAY3 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.ok(typeof result.categories.transport === 'number', `expected number, got: ${result.categories.transport}`);
    assert.ok(result.categories.transport !== 'kurang data');
  });

  it('Test 13: Category with exactly 2 distinct days returns kurang data (boundary)', async () => {
    const userId = 'sparse-user-boundary';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });
    // makan in Feb with 3 distinct days (passes sparsity)
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    // transport: expenses on exactly 2 distinct days
    await appendExpense(userId, { amount: 20000, category: 'transport', description: 't1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 20000, category: 'transport', description: 't2', timestamp: FEB_DAY2 });

    const result = await buildPrediction(userId, { now: NOW }, null);
    assert.equal(result.sufficient, true);
    assert.equal(result.categories.transport, 'kurang data');
  });
});

describe('No-Claude guarantee', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('Test 14: buildPrediction never calls the clientOverride spy', async () => {
    const userId = 'no-claude-user';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old-gate', timestamp: OLD_EXPENSE });
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    let called = false;
    const spyClient = {
      messages: { create: async () => { called = true; return { content: [] }; } }
    };

    await buildPrediction(userId, { now: NOW }, spyClient);
    assert.equal(called, false, 'No Claude call expected in Phase 4 — predict.js is pure JS');
  });
});
