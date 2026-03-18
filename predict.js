'use strict';
// predict.js — Prediction engine for monthly spend estimates.
// Read-only consumer of storage.js. No writes, no Anthropic calls.
// Note: relies on storage.readExpenses returning expenses in append (ascending timestamp) order.
const storage = require('./storage');

const WEIGHTS = { 3: [0.42, 0.33, 0.25], 2: [0.56, 0.44], 1: [1.00] };

/**
 * Returns up to 3 complete calendar month windows before now's month.
 * Each window is { year, month } where month is 0-indexed (Jan=0, Dec=11).
 * Result is ordered [m-1, m-2, m-3] (most recent first).
 * @param {Date} now
 * @returns {Array<{year: number, month: number}>}
 */
function _selectMonthWindows(now) {
  const result = [];
  for (let i = 1; i <= 3; i++) {
    let m = now.getUTCMonth() - i;
    let y = now.getUTCFullYear();
    if (m < 0) { m += 12; y -= 1; }
    result.push({ year: y, month: m });
  }
  return result;
}

/**
 * Filters expenses to those that fall within a specific month window.
 * @param {Array} expenses
 * @param {{year: number, month: number}} window
 * @returns {Array}
 */
function _filterToWindow(expenses, { year, month }) {
  return expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
}

/**
 * Computes per-category estimates using weighted averages over the given windows.
 * Categories with fewer than 3 distinct UTC transaction days return 'kurang data'.
 * @param {Array} expenses — all expenses within the active windows
 * @param {Array<{year: number, month: number}>} windows — active month windows (1-3)
 * @returns {Object} categories map: { cat: number | 'kurang data' }
 */
function _computeCategories(expenses, windows) {
  const allCats = [...new Set(expenses.map(e => e.category))];
  const n = windows.length;
  const weights = WEIGHTS[n];
  const categories = {};

  for (const cat of allCats) {
    const catExpenses = expenses.filter(e => e.category === cat);

    // Sparsity gate: count distinct UTC calendar days for this category
    const distinctDays = new Set(
      catExpenses.map(e => new Date(e.timestamp).toISOString().slice(0, 10))
    );
    if (distinctDays.size < 3) {
      categories[cat] = 'kurang data';
      continue;
    }

    // Weighted average over available windows (missing window contributes 0)
    let estimate = 0;
    for (let i = 0; i < n; i++) {
      const monthExpenses = _filterToWindow(catExpenses, windows[i]);
      const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
      estimate += monthTotal * weights[i];
    }
    categories[cat] = Math.round(estimate);
  }

  return categories;
}

/**
 * Builds a spend prediction for a user.
 * @param {string} userId
 * @param {Object|null} _options — optional { now: Date } for deterministic testing
 * @param {Object|null} clientOverride — unused in Phase 4, reserved for Phase 5
 * @returns {Promise<{sufficient: false} | {sufficient: true, monthsUsed: number, categories: Object}>}
 */
async function buildPrediction(userId, _options, clientOverride) {
  const now = (_options && _options.now) ? _options.now : new Date();

  const expenses = await storage.readExpenses(userId);

  // Outer gate: no expenses
  if (expenses.length === 0) return { sufficient: false };

  // Outer gate: 30-day history check — expenses[0] is oldest (append order from storage)
  const earliest = new Date(expenses[0].timestamp).getTime();
  if (earliest > now.getTime() - 30 * 24 * 60 * 60 * 1000) {
    return { sufficient: false };
  }

  // Determine active month windows (windows that have at least one expense)
  const allWindows = _selectMonthWindows(now);
  const activeWindows = allWindows.filter(window =>
    expenses.some(e => {
      const d = new Date(e.timestamp);
      return d.getUTCFullYear() === window.year && d.getUTCMonth() === window.month;
    })
  );

  if (activeWindows.length === 0) return { sufficient: false };

  const monthsUsed = activeWindows.length;

  // Collect only expenses within the active windows for computation
  const windowExpenses = expenses.filter(e => {
    const d = new Date(e.timestamp);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    return activeWindows.some(w => w.year === y && w.month === m);
  });

  const categories = _computeCategories(windowExpenses, activeWindows);

  return { sufficient: true, monthsUsed, categories };
}

module.exports = { buildPrediction, _selectMonthWindows, _computeCategories };
