'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

const tmpDataDir = path.join(__dirname, `tmp-summary-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.DATA_DIR = tmpDataDir;
process.env.ANTHROPIC_API_KEY = 'test-key';

const { buildMonthlySummary, buildWeeklySummary, generateInsight,
        _filterCurrentMonth, _filterPastWeek, _buildBreakdown } = require('../summary.js');

function makeMockClient(text) {
  return {
    messages: { create: async () => ({ content: [{ type: 'text', text }] }) }
  };
}

const NOW_ISO = new Date().toISOString();
const OLD_ISO = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(); // 40 days ago

describe('summary helpers', () => {
  it('filterCurrentMonth keeps current-month expenses', () => {
    const expenses = [
      { amount: 35000, category: 'makan', description: 'test', timestamp: NOW_ISO },
      { amount: 20000, category: 'transport', description: 'test', timestamp: OLD_ISO },
    ];
    const result = _filterCurrentMonth(expenses);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, 35000);
  });

  it('filterPastWeek keeps only last 7 days', () => {
    const recentISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const expenses = [
      { amount: 35000, category: 'makan', description: 'test', timestamp: recentISO },
      { amount: 20000, category: 'transport', description: 'test', timestamp: OLD_ISO },
    ];
    const result = _filterPastWeek(expenses);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, 35000);
  });

  it('buildBreakdown aggregates amounts and counts by category', () => {
    const expenses = [
      { amount: 35000, category: 'makan', description: 'a', timestamp: NOW_ISO },
      { amount: 35000, category: 'makan', description: 'b', timestamp: NOW_ISO },
      { amount: 20000, category: 'transport', description: 'c', timestamp: NOW_ISO },
    ];
    const result = _buildBreakdown(expenses);
    assert.equal(result.makan.total, 70000);
    assert.equal(result.makan.count, 2);
    assert.equal(result.transport.total, 20000);
    assert.equal(result.transport.count, 1);
  });
});

describe('buildMonthlySummary', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('returns empty-state string when no expenses this month', async () => {
    const mockClient = makeMockClient('Pengeluaran bulan ini cukup terkontrol!');
    const result = await buildMonthlySummary('summaryuser1', mockClient);
    assert.ok(result.includes('belum ada pengeluaran'), `got: ${result}`);
    assert.ok(result.includes('makan siang 35rb'), `got: ${result}`);
  });

  it('returns string containing category name when expenses exist', async () => {
    const { appendExpense } = require('../storage.js');
    await appendExpense('summaryuser2', { amount: 35000, category: 'makan', description: 'nasi', timestamp: NOW_ISO });
    const mockClient = makeMockClient('Pengeluaran bulanan kamu oke!');
    const result = await buildMonthlySummary('summaryuser2', mockClient);
    assert.ok(typeof result === 'string' && result.length > 0, `got: ${result}`);
    assert.ok(result.toLowerCase().includes('makan'), `got: ${result}`);
  });

  it('does not call Claude when no expenses (avoids unnecessary API call)', async () => {
    let called = false;
    const spyClient = { messages: { create: async () => { called = true; return { content: [] }; } } };
    await buildMonthlySummary('summaryuser3', spyClient);
    assert.equal(called, false, 'Claude should not be called with no expenses');
  });
});

describe('buildWeeklySummary', () => {
  beforeEach(async () => { await fs.mkdir(tmpDataDir, { recursive: true }); });
  afterEach(async () => { await fs.rm(tmpDataDir, { recursive: true, force: true }); });

  it('returns null when no expenses in past 7 days', async () => {
    const mockClient = makeMockClient('No activity');
    const result = await buildWeeklySummary('weekuser1', mockClient);
    assert.equal(result, null);
  });

  it('returns string when expenses exist in past 7 days', async () => {
    const { appendExpense } = require('../storage.js');
    const recentISO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await appendExpense('weekuser2', { amount: 25000, category: 'transport', description: 'grab', timestamp: recentISO });
    const mockClient = makeMockClient('Minggu ini kamu lumayan hemat!');
    const result = await buildWeeklySummary('weekuser2', mockClient);
    assert.ok(typeof result === 'string' && result.length > 0, `got: ${result}`);
  });
});

describe('generateInsight', () => {
  it('calls Claude with max_tokens 512', async () => {
    let captured;
    const spyClient = { messages: { create: async (args) => { captured = args; return { content: [{ type: 'text', text: 'Insight.' }] }; } } };
    const expenses = [{ amount: 35000, category: 'makan', description: 'nasi', timestamp: NOW_ISO }];
    await generateInsight(expenses, 'bulanan', spyClient);
    assert.equal(captured.max_tokens, 512, `got max_tokens: ${captured.max_tokens}`);
  });

  it('returns non-empty string from text block', async () => {
    const mockClient = makeMockClient('Pengeluaran kamu bulan ini cukup oke!');
    const expenses = [{ amount: 35000, category: 'makan', description: 'nasi', timestamp: NOW_ISO }];
    const result = await generateInsight(expenses, 'bulanan', mockClient);
    assert.equal(result, 'Pengeluaran kamu bulan ini cukup oke!');
  });
});
