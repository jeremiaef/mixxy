'use strict';
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

// Generate a unique temp dir for each test run
const tmpDataDir = path.join(__dirname, `tmp-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Set DATA_DIR before requiring storage so it uses the temp dir
process.env.DATA_DIR = tmpDataDir;

const { readExpenses, appendExpense, popExpense } = require('../storage.js');

describe('storage module', () => {

  beforeEach(async () => {
    // Create fresh temp dir before each test
    await fs.mkdir(tmpDataDir, { recursive: true });
  });

  afterEach(async () => {
    // Remove temp dir after each test
    await fs.rm(tmpDataDir, { recursive: true, force: true });
  });

  it('readExpenses returns empty array for nonexistent user', async () => {
    const result = await readExpenses('user999');
    assert.deepEqual(result, []);
  });

  it('appendExpense creates file and stores expense', async () => {
    const userId = 'user1';
    const expense = {
      amount: 35000,
      category: 'makan',
      description: 'nasi goreng',
      timestamp: '2026-03-17T10:00:00.000Z',
    };
    await appendExpense(userId, expense);
    const result = await readExpenses(userId);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, 35000);
  });

  it('appendExpense appends to existing expenses', async () => {
    const userId = 'user2';
    const expense1 = { amount: 35000, category: 'makan', description: 'nasi goreng', timestamp: '2026-03-17T10:00:00.000Z' };
    const expense2 = { amount: 15000, category: 'transport', description: 'ojek', timestamp: '2026-03-17T11:00:00.000Z' };
    await appendExpense(userId, expense1);
    await appendExpense(userId, expense2);
    const result = await readExpenses(userId);
    assert.equal(result.length, 2);
  });

  it('concurrent appendExpense for same user preserves both', async () => {
    const userId = 'user3';
    const exp1 = { amount: 35000, category: 'makan', description: 'nasi goreng', timestamp: '2026-03-17T10:00:00.000Z' };
    const exp2 = { amount: 15000, category: 'transport', description: 'ojek', timestamp: '2026-03-17T11:00:00.000Z' };
    await Promise.all([
      appendExpense(userId, exp1),
      appendExpense(userId, exp2),
    ]);
    const result = await readExpenses(userId);
    assert.equal(result.length, 2);
  });

  it('concurrent appendExpense for different users does not interfere', async () => {
    const exp1 = { amount: 35000, category: 'makan', description: 'nasi goreng', timestamp: '2026-03-17T10:00:00.000Z' };
    const exp2 = { amount: 15000, category: 'transport', description: 'ojek', timestamp: '2026-03-17T11:00:00.000Z' };
    await Promise.all([
      appendExpense('userA', exp1),
      appendExpense('userB', exp2),
    ]);
    const resultA = await readExpenses('userA');
    const resultB = await readExpenses('userB');
    assert.equal(resultA.length, 1);
    assert.equal(resultB.length, 1);
  });

  it('popExpense removes last expense', async () => {
    const userId = 'user4';
    const exp1 = { amount: 35000, category: 'makan', description: 'nasi goreng', timestamp: '2026-03-17T10:00:00.000Z' };
    const exp2 = { amount: 15000, category: 'transport', description: 'ojek', timestamp: '2026-03-17T11:00:00.000Z' };
    await appendExpense(userId, exp1);
    await appendExpense(userId, exp2);
    const removed = await popExpense(userId);
    const remaining = await readExpenses(userId);
    assert.equal(remaining.length, 1);
    assert.equal(removed.amount, 15000);
    assert.equal(removed.category, 'transport');
  });

  it('popExpense on empty user returns null', async () => {
    const result = await popExpense('nonexistent_user');
    assert.equal(result, null);
  });

  it('expense has correct shape', async () => {
    const userId = 'user5';
    const expense = {
      amount: 35000,
      category: 'makan',
      description: 'nasi goreng',
      timestamp: '2026-03-17T10:00:00.000Z',
    };
    await appendExpense(userId, expense);
    const result = await readExpenses(userId);
    const stored = result[0];
    assert.ok('amount' in stored, 'should have amount');
    assert.ok('category' in stored, 'should have category');
    assert.ok('description' in stored, 'should have description');
    assert.ok('timestamp' in stored, 'should have timestamp');
  });

});
