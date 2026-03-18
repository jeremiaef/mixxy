'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

const tmpDataDir = path.join(__dirname, `tmp-predict-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.DATA_DIR = tmpDataDir;
process.env.ANTHROPIC_API_KEY = 'test-key';

const { buildPrediction, _selectMonthWindows, _computeCategories, classifyPrediction, _formatPrediction } = require('../predict.js');
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

// Old expense > 30 days ago from NOW, and BEFORE December 2025 (m-3 window)
// so it does not affect monthly computations. November 2025 is before all 3 active windows.
const OLD_EXPENSE = '2025-11-15T08:00:00.000Z'; // > 30 days before March 18, 2026; before m-3 (Dec)

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

describe('PRED-05 — Classification', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('Test 15: classifyPrediction returns classifications.makan from spy and kost=tetap hardcoded; spy not called for kost', async () => {
    const userId = 'classify-user-15';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old', timestamp: OLD_EXPENSE });

    // makan: 3 months x 3 distinct days each
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec1', timestamp: DEC_DAY1 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec2', timestamp: DEC_DAY2 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec3', timestamp: DEC_DAY3 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 26666, category: 'makan', description: 'jan3', timestamp: JAN_DAY3 });
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    // kost: 3 months x 3 distinct days each
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-dec1', timestamp: DEC_DAY1 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-dec2', timestamp: DEC_DAY2 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-dec3', timestamp: DEC_DAY3 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-jan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-jan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-jan3', timestamp: JAN_DAY3 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 500000, category: 'kost', description: 'kost-feb3', timestamp: FEB_DAY3 });

    let spyCallCount = 0;
    let spyParams = null;
    const spyClient = {
      messages: {
        create: async (params) => {
          spyCallCount++;
          spyParams = params;
          return {
            content: [{ type: 'tool_use', name: 'classify_categories', input: { classifications: { makan: 'variabel' } } }]
          };
        }
      }
    };

    const result = await classifyPrediction(userId, { now: NOW }, spyClient);

    assert.equal(result.sufficient, true);
    assert.equal(result.classifications.makan, 'variabel');
    assert.equal(result.classifications.kost, 'tetap');
    assert.equal(spyCallCount, 1, 'Spy should be called exactly once');
    assert.ok(spyParams !== null, 'Spy params should be captured');
    assert.ok(
      !spyParams.messages[0].content.includes('kost'),
      'kost should NOT be in Claude prompt — it is hardcoded as tetap'
    );
  });

  it('Test 16: classifyPrediction with insufficient data returns { sufficient: false, daysLogged: 10 }', async () => {
    const userId = 'classify-user-16';
    // Only 1 expense from 10 days ago — does not pass 30-day gate
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await appendExpense(userId, { amount: 50000, category: 'makan', description: 'test', timestamp: tenDaysAgo });

    let spyCalled = false;
    const spyClient = {
      messages: { create: async () => { spyCalled = true; return { content: [] }; } }
    };

    const result = await classifyPrediction(userId, { now: NOW }, spyClient);

    assert.equal(result.sufficient, false);
    assert.equal(typeof result.daysLogged, 'number');
    assert.equal(result.daysLogged, 10);
    assert.equal(spyCalled, false, 'Spy should NOT be called when data is insufficient');
  });

  it('Test 17: kurang data categories are NOT sent to Claude spy — only numeric categories included', async () => {
    const userId = 'classify-user-17';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old', timestamp: OLD_EXPENSE });

    // makan: 3 distinct days in Feb (passes sparsity gate) => numeric
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    // transport: only 2 distinct days in Feb => kurang data (should NOT be sent to Claude)
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 15000, category: 'transport', description: 't2', timestamp: FEB_DAY2 });

    let spyParams = null;
    const spyClient = {
      messages: {
        create: async (params) => {
          spyParams = params;
          return {
            content: [{ type: 'tool_use', name: 'classify_categories', input: { classifications: { makan: 'variabel' } } }]
          };
        }
      }
    };

    await classifyPrediction(userId, { now: NOW }, spyClient);

    assert.ok(spyParams !== null, 'Spy should have been called');
    assert.ok(
      spyParams.messages[0].content.includes('makan'),
      'makan (numeric) should be in Claude prompt'
    );
    assert.ok(
      !spyParams.messages[0].content.includes('transport'),
      'transport (kurang data) should NOT be in Claude prompt'
    );
  });
});

describe('PRED-06 — Savings headroom', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('Test 18: With 3 months of variable category data, savings contains correct min/avg/headroom', async () => {
    const userId = 'savings-user-18';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old', timestamp: OLD_EXPENSE });

    // makan: Dec=60000, Jan=80000, Feb=100000 — 3 distinct days each month
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec1', timestamp: DEC_DAY1 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec2', timestamp: DEC_DAY2 });
    await appendExpense(userId, { amount: 20000, category: 'makan', description: 'dec3', timestamp: DEC_DAY3 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 26667, category: 'makan', description: 'jan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 26666, category: 'makan', description: 'jan3', timestamp: JAN_DAY3 });
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    const spyClient = {
      messages: {
        create: async () => ({
          content: [{ type: 'tool_use', name: 'classify_categories', input: { classifications: { makan: 'variabel' } } }]
        })
      }
    };

    const result = await classifyPrediction(userId, { now: NOW }, spyClient);

    assert.ok(result.savings !== null, 'savings should not be null');
    assert.equal(result.savings.category, 'makan');
    assert.equal(result.savings.min, 60000); // Dec total
    assert.equal(result.savings.avg, 80000); // (60000+80000+100000)/3 = 80000
    assert.equal(result.savings.headroom, 20000); // avg - min = 80000 - 60000
  });

  it('Test 19: With only 1 active window for a variable category, savings is null', async () => {
    const userId = 'savings-user-19';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old', timestamp: OLD_EXPENSE });

    // makan: only Feb (1 window — 3 distinct days, passes sparsity)
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'feb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'feb3', timestamp: FEB_DAY3 });

    const spyClient = {
      messages: {
        create: async () => ({
          content: [{ type: 'tool_use', name: 'classify_categories', input: { classifications: { makan: 'variabel' } } }]
        })
      }
    };

    const result = await classifyPrediction(userId, { now: NOW }, spyClient);

    assert.equal(result.savings, null, 'savings should be null with only 1 active window');
  });

  it('Test 20: savings.category is the variable category with highest variance', async () => {
    const userId = 'savings-user-20';
    // Old expense to pass gate
    await appendExpense(userId, { amount: 1000, category: 'makan', description: 'old', timestamp: OLD_EXPENSE });

    // makan: low variance — Dec=90k, Jan=95k, Feb=100k (range=10k)
    await appendExpense(userId, { amount: 30000, category: 'makan', description: 'mdec1', timestamp: DEC_DAY1 });
    await appendExpense(userId, { amount: 30000, category: 'makan', description: 'mdec2', timestamp: DEC_DAY2 });
    await appendExpense(userId, { amount: 30000, category: 'makan', description: 'mdec3', timestamp: DEC_DAY3 });
    await appendExpense(userId, { amount: 31667, category: 'makan', description: 'mjan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 31667, category: 'makan', description: 'mjan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 31666, category: 'makan', description: 'mjan3', timestamp: JAN_DAY3 });
    await appendExpense(userId, { amount: 33334, category: 'makan', description: 'mfeb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'mfeb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 33333, category: 'makan', description: 'mfeb3', timestamp: FEB_DAY3 });

    // hiburan: high variance — Dec=20k, Jan=60k, Feb=80k (range=60k)
    await appendExpense(userId, { amount: 6667, category: 'hiburan', description: 'hdec1', timestamp: DEC_DAY1 });
    await appendExpense(userId, { amount: 6667, category: 'hiburan', description: 'hdec2', timestamp: DEC_DAY2 });
    await appendExpense(userId, { amount: 6666, category: 'hiburan', description: 'hdec3', timestamp: DEC_DAY3 });
    await appendExpense(userId, { amount: 20000, category: 'hiburan', description: 'hjan1', timestamp: JAN_DAY1 });
    await appendExpense(userId, { amount: 20000, category: 'hiburan', description: 'hjan2', timestamp: JAN_DAY2 });
    await appendExpense(userId, { amount: 20000, category: 'hiburan', description: 'hjan3', timestamp: JAN_DAY3 });
    await appendExpense(userId, { amount: 26667, category: 'hiburan', description: 'hfeb1', timestamp: FEB_DAY1 });
    await appendExpense(userId, { amount: 26667, category: 'hiburan', description: 'hfeb2', timestamp: FEB_DAY2 });
    await appendExpense(userId, { amount: 26666, category: 'hiburan', description: 'hfeb3', timestamp: FEB_DAY3 });

    const spyClient = {
      messages: {
        create: async () => ({
          content: [{ type: 'tool_use', name: 'classify_categories', input: { classifications: { makan: 'variabel', hiburan: 'variabel' } } }]
        })
      }
    };

    const result = await classifyPrediction(userId, { now: NOW }, spyClient);

    assert.equal(result.savings.category, 'hiburan', 'hiburan has higher variance (60k) than makan (10k)');
  });
});

describe('PRED-07 — Formatting', () => {
  it('Test 21: _formatPrediction with sufficient=true produces header with monthsUsed', () => {
    const output = _formatPrediction({
      sufficient: true,
      monthsUsed: 3,
      categories: { makan: 450000 },
      classifications: { makan: 'variabel' },
      savings: null
    });
    assert.ok(output.includes('Prediksi bulan depan (berdasarkan 3 bulan terakhir):'), `Expected header in output, got: ${output}`);
  });

  it('Test 22: _formatPrediction with sufficient=true produces total line with ~Rp', () => {
    const output = _formatPrediction({
      sufficient: true,
      monthsUsed: 3,
      categories: { makan: 450000 },
      classifications: { makan: 'variabel' },
      savings: null
    });
    assert.ok(output.includes('Total kira-kira: ~Rp 450rb'), `Expected total line in output, got: ${output}`);
  });

  it('Test 23: _formatPrediction with sufficient=false and daysLogged=12 contains days message', () => {
    const output = _formatPrediction({ sufficient: false, daysLogged: 12 });
    assert.ok(output.includes('Data kamu baru 12 hari'), `Expected days message in output, got: ${output}`);
    assert.ok(output.includes('butuh minimal 30 hari'), `Expected 30-day mention in output, got: ${output}`);
  });

  it('Test 24: _formatPrediction with savings data contains Ada ruang ~ savings line', () => {
    const output = _formatPrediction({
      sufficient: true,
      monthsUsed: 3,
      categories: { makan: 450000 },
      classifications: { makan: 'variabel' },
      savings: { category: 'makan', min: 280000, avg: 450000, headroom: 170000 }
    });
    assert.ok(output.includes('Ada ruang ~170rb buat dihemat'), `Expected savings line in output, got: ${output}`);
  });

  it("Test 25: _formatPrediction with kurang data category shows 'kurang data' without tetap/variabel label", () => {
    const output = _formatPrediction({
      sufficient: true,
      monthsUsed: 2,
      categories: { makan: 450000, tagihan: 'kurang data' },
      classifications: { makan: 'variabel' },
      savings: null
    });
    assert.ok(output.includes('kurang data'), `Expected 'kurang data' in output, got: ${output}`);
    // tagihan should not be followed by tetap or variabel
    assert.ok(!output.match(/tagihan.*tetap/), `tagihan should not have tetap label in output: ${output}`);
    assert.ok(!output.match(/tagihan.*variabel/), `tagihan should not have variabel label in output: ${output}`);
  });
});
