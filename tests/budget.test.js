'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

const tmpDataDir = path.join(__dirname, `tmp-budget-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.DATA_DIR = tmpDataDir;
process.env.ANTHROPIC_API_KEY = 'test-key';

const { detectThreshold, formatBudgetProgress, checkBudgetAlert } = require('../budget.js');

describe('detectThreshold', () => {
  it('returns null below 80%', () => {
    // 300000/500000 = 60%, prev 0%, clearly below threshold
    assert.equal(detectThreshold(0, 300000, 500000), null);
  });

  it('returns 80% when just crossing from below', () => {
    assert.equal(detectThreshold(0, 450000, 500000), '80%');
  });

  it('returns 80% when crossing mid-range', () => {
    assert.equal(detectThreshold(380000, 420000, 500000), '80%');
  });

  it('returns 100% when crossing from below 100%', () => {
    assert.equal(detectThreshold(450000, 520000, 500000), '100%');
  });

  it('returns 100% when prev is between 80-100%', () => {
    assert.equal(detectThreshold(420000, 520000, 500000), '100%');
  });

  it('returns null when already past 100% (no new crossing)', () => {
    assert.equal(detectThreshold(520000, 570000, 500000), null);
  });

  it('returns null when between 80-100% with no new crossing', () => {
    assert.equal(detectThreshold(420000, 450000, 500000), null);
  });

  it('returns 80% at exact 80% boundary (>= fix)', () => {
    // 400000/500000 = 0.8 exactly — must return 80%, not null
    assert.equal(detectThreshold(0, 400000, 500000), '80%');
  });
});

describe('formatBudgetProgress', () => {
  it('returns non-empty string', () => {
    const result = formatBudgetProgress(500000, 0);
    assert.ok(typeof result === 'string' && result.length > 0, `got: ${result}`);
  });

  it('contains percentage for 0 spending', () => {
    const result = formatBudgetProgress(500000, 0);
    assert.ok(result.includes('0%'), `got: ${result}`);
  });

  it('contains 70% for 350000/500000', () => {
    const result = formatBudgetProgress(500000, 350000);
    assert.ok(result.includes('70%'), `got: ${result}`);
  });

  it('contains 100% when fully spent', () => {
    const result = formatBudgetProgress(500000, 500000);
    assert.ok(result.includes('100%'), `got: ${result}`);
  });

  it('shows category name in output when category provided', () => {
    const result = formatBudgetProgress(200000, 170000, 'makan');
    assert.ok(result.includes('makan'), `expected 'makan' in: ${result}`);
    assert.ok(result.includes('85%'), `expected 85% in: ${result}`);
  });

  it('omits category reference when no category provided (backward compat)', () => {
    const result = formatBudgetProgress(500000, 350000);
    assert.ok(result.includes('bulan ini'), `expected 'bulan ini' in: ${result}`);
  });
});

describe('checkBudgetAlert', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('returns reply unchanged when no budget set', async () => {
    const result = await checkBudgetAlert('alertuser1', 50000, 'makan', 'Noted ya!');
    assert.equal(result, 'Noted ya!');
  });

  it('returns reply unchanged below 80% threshold', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    await writeMeta('alertuser2', { budget: 500000 });
    // Add expenses totaling 200000 (40%)
    await appendExpense('alertuser2', { amount: 200000, category: 'makan', description: 'test', timestamp: new Date().toISOString() });
    const result = await checkBudgetAlert('alertuser2', 50000, 'makan', 'Oke!');
    // 200000 + 50000 = 250000 = 50%, prev=200000=40%, no threshold crossed
    assert.equal(result, 'Oke!');
  });

  it('appends 80% warning when just crossing 80%', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    await writeMeta('alertuser3', { budget: 500000 });
    // Add 350000 expenses (70%), then append new expense of 80000 (crosses to 86%)
    await appendExpense('alertuser3', { amount: 350000, category: 'makan', description: 'test', timestamp: new Date().toISOString() });
    // checkBudgetAlert is called AFTER the expense is appended — append 80000 first
    await appendExpense('alertuser3', { amount: 80000, category: 'makan', description: 'new', timestamp: new Date().toISOString() });
    const result = await checkBudgetAlert('alertuser3', 80000, 'makan', 'Siip!');
    // prev=350000 (70%), new=430000 (86%) — crosses 80%
    assert.ok(result.startsWith('Siip!'), `reply should start with original: ${result}`);
    assert.ok(result.includes('\n\n'), `should have paragraph separator: ${result}`);
    assert.ok(result.length > 'Siip!'.length, `should have appended text: ${result}`);
  });

  it('appends 100% roast when just crossing 100%', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    await writeMeta('alertuser4', { budget: 500000 });
    // 450000 expenses (90%), new expense of 100000 crosses to 110%
    await appendExpense('alertuser4', { amount: 450000, category: 'makan', description: 'test', timestamp: new Date().toISOString() });
    // checkBudgetAlert is called AFTER the expense is appended — append 100000 first
    await appendExpense('alertuser4', { amount: 100000, category: 'makan', description: 'new', timestamp: new Date().toISOString() });
    const result = await checkBudgetAlert('alertuser4', 100000, 'makan', 'Noted!');
    assert.ok(result.startsWith('Noted!'), `reply should start with original: ${result}`);
    assert.ok(result.includes('\n\n'), `should have paragraph separator: ${result}`);
    assert.ok(result.length > 'Noted!'.length, `should have roast appended: ${result}`);
  });

  it('returns reply unchanged when already past 100%', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    await writeMeta('alertuser5', { budget: 500000 });
    // 550000 already over budget
    await appendExpense('alertuser5', { amount: 550000, category: 'makan', description: 'test', timestamp: new Date().toISOString() });
    const result = await checkBudgetAlert('alertuser5', 30000, 'makan', 'Catat!');
    // prev=550000 (110%), new=580000 (116%) — already past 100%, null threshold
    assert.equal(result, 'Catat!');
  });

  it('per-category: appends 80% warning for category with per-category budget', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    // meta.budgets.makan = 200000, makan expenses totaling 120000 before new expense
    await writeMeta('alertuser6', { budgets: { makan: 200000 } });
    await appendExpense('alertuser6', { amount: 120000, category: 'makan', description: 'lunch', timestamp: new Date().toISOString() });
    // New expense: 50000 → total makan = 170000 (85%), prev = 120000 (60%) → crosses 80%
    await appendExpense('alertuser6', { amount: 50000, category: 'makan', description: 'dinner', timestamp: new Date().toISOString() });
    const result = await checkBudgetAlert('alertuser6', 50000, 'makan', 'Noted!');
    assert.ok(result.startsWith('Noted!'), `reply should start with original: ${result}`);
    assert.ok(result.length > 'Noted!'.length, `should have 80% warning appended: ${result}`);
  });

  it('per-category: returns unchanged when expense category has no budget', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    // meta.budgets only has makan, but expense is transport
    await writeMeta('alertuser7', { budgets: { makan: 200000 } });
    await appendExpense('alertuser7', { amount: 300000, category: 'transport', description: 'grab', timestamp: new Date().toISOString() });
    const result = await checkBudgetAlert('alertuser7', 50000, 'transport', 'Noted!');
    assert.equal(result, 'Noted!');
  });

  it('per-category: cross-category isolation — transport expenses do not count toward makan budget', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    // meta.budgets.makan = 200000, but all expenses are transport
    await writeMeta('alertuser8', { budgets: { makan: 200000 } });
    await appendExpense('alertuser8', { amount: 180000, category: 'transport', description: 'grab', timestamp: new Date().toISOString() });
    await appendExpense('alertuser8', { amount: 50000, category: 'transport', description: 'ojol', timestamp: new Date().toISOString() });
    // call checkBudgetAlert for 'makan' — makan spend is 0, so no threshold crossed
    const result = await checkBudgetAlert('alertuser8', 50000, 'makan', 'Noted!');
    assert.equal(result, 'Noted!');
  });

  it('global budget fallback: uses meta.budget when no meta.budgets map', async () => {
    const { writeMeta, appendExpense } = require('../storage.js');
    // Old global format: meta.budget = 500000, no budgets map
    await writeMeta('alertuser9', { budget: 500000 });
    await appendExpense('alertuser9', { amount: 350000, category: 'transport', description: 'grab', timestamp: new Date().toISOString() });
    await appendExpense('alertuser9', { amount: 80000, category: 'makan', description: 'dinner', timestamp: new Date().toISOString() });
    // Total = 430000 (86%), prev = 350000 (70%) — crosses 80% — with ANY category arg
    const result = await checkBudgetAlert('alertuser9', 80000, 'makan', 'Noted!');
    assert.ok(result.length > 'Noted!'.length, `should have 80% warning from global budget: ${result}`);
  });
});
