'use strict';
const { Mutex } = require('async-mutex');
const writeFileAtomic = require('write-file-atomic');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const mutexes = new Map();

function getMutex(userId) {
  const key = String(userId);
  if (!mutexes.has(key)) {
    mutexes.set(key, new Mutex());
  }
  return mutexes.get(key);
}

async function readExpenses(userId) {
  const file = path.join(DATA_DIR, `${userId}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function appendExpense(userId, expense) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const mutex = getMutex(userId);
  return mutex.runExclusive(async () => {
    const expenses = await readExpenses(userId);
    expenses.push({
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      timestamp: expense.timestamp || new Date().toISOString(),
    });
    const file = path.join(DATA_DIR, `${userId}.json`);
    await writeFileAtomic(file, JSON.stringify(expenses, null, 2));
    return expenses;
  });
}

async function popExpense(userId) {
  const mutex = getMutex(userId);
  return mutex.runExclusive(async () => {
    const expenses = await readExpenses(userId);
    if (expenses.length === 0) return null;
    const removed = expenses.pop();
    const file = path.join(DATA_DIR, `${userId}.json`);
    await writeFileAtomic(file, JSON.stringify(expenses, null, 2));
    return removed;
  });
}

async function readMeta(userId) {
  const file = path.join(DATA_DIR, `${userId}_meta.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeMeta(userId, meta) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const mutex = getMutex(`${userId}_meta`);
  return mutex.runExclusive(async () => {
    const file = path.join(DATA_DIR, `${userId}_meta.json`);
    await writeFileAtomic(file, JSON.stringify(meta, null, 2));
  });
}

module.exports = { readExpenses, appendExpense, popExpense, readMeta, writeMeta };
