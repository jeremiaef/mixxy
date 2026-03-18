'use strict';
// predict.js — Prediction engine for monthly spend estimates.
// Read-only consumer of storage.js. No writes.
// Note: relies on storage.readExpenses returning expenses in append (ascending timestamp) order.
const storage = require('./storage');
const { PREDICT_CLASSIFY_TOOL } = require('./prompts');
const Anthropic = require('@anthropic-ai/sdk');
const defaultClient = new Anthropic();

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

// Local clone of _formatAmount — do NOT import from index.js (circular dep risk).
// Same implementation as budget.js _formatAmount.
function _formatAmount(amount) {
  if (amount >= 1000000) {
    const jt = amount / 1000000;
    return Number.isInteger(jt) ? jt + 'jt' : jt.toFixed(1) + 'jt';
  }
  return (amount / 1000) + 'rb';
}

const CATEGORY_EMOJI = {
  makan: '\u{1F35C}', transport: '\u{1F697}', hiburan: '\u{1F3AC}',
  tagihan: '\u{1F4C4}', kost: '\u{1F3E0}', pulsa: '\u{1F4F1}',
  ojol: '\u{1F6B5}', jajan: '\u{1F369}', lainnya: '\u{1F4E6}'
};

/**
 * Orchestrates prediction with Claude-powered fixed/variable classification,
 * variance-based savings headroom, and structured result.
 * @param {string} userId
 * @param {Object|null} _options — optional { now: Date } for deterministic testing
 * @param {Object|null} clientOverride — Anthropic client for test isolation
 * @returns {Promise<{sufficient: false, daysLogged: number} | {sufficient: true, monthsUsed: number, categories: Object, classifications: Object, savings: null | {category, min, avg, headroom}}>}
 */
async function classifyPrediction(userId, _options, clientOverride) {
  const now = (_options && _options.now) ? _options.now : new Date();

  const result = await buildPrediction(userId, _options, clientOverride);

  if (!result.sufficient) {
    // Compute daysLogged from first expense
    const expenses = await storage.readExpenses(userId);
    let daysLogged = 0;
    if (expenses.length > 0) {
      daysLogged = Math.floor((now.getTime() - new Date(expenses[0].timestamp).getTime()) / (24 * 60 * 60 * 1000));
    }
    return { sufficient: false, daysLogged };
  }

  const { categories } = result;

  // Pre-populate kost as tetap — hardcoded per roadmap decision
  const classifications = {};
  if (categories.kost !== undefined) {
    classifications.kost = 'tetap';
  }

  // Separate numeric categories (exclude 'kurang data' and kost from Claude call)
  const numericCats = Object.entries(categories).filter(
    ([cat, val]) => typeof val === 'number' && cat !== 'kost'
  );

  if (numericCats.length > 0) {
    // Build category list string for Claude
    const categoryList = numericCats
      .map(([cat, val]) => `- ${cat}: ~Rp ${_formatAmount(val)}`)
      .join('\n');

    const client = clientOverride || defaultClient;
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      tools: [PREDICT_CLASSIFY_TOOL],
      tool_choice: { type: 'tool', name: 'classify_categories' },
      messages: [{ role: 'user', content: `Klasifikasikan kategori pengeluaran berikut sebagai tetap atau variabel:\n${categoryList}` }]
    });
    const block = response.content.find(b => b.type === 'tool_use' && b.name === 'classify_categories');
    if (block && block.input && block.input.classifications) {
      Object.assign(classifications, block.input.classifications);
    }
  }

  // Compute variance for savings headroom — Option A: re-read expenses inside classifyPrediction
  const allExpenses = await storage.readExpenses(userId);
  const allWindows = _selectMonthWindows(now);
  // Active windows: those with at least one expense
  const activeWindows = allWindows.filter(window =>
    allExpenses.some(e => {
      const d = new Date(e.timestamp);
      return d.getUTCFullYear() === window.year && d.getUTCMonth() === window.month;
    })
  );

  let savings = null;
  let highestVariance = -1;

  for (const [cat, val] of Object.entries(categories)) {
    // Only variable categories with numeric estimates
    if (classifications[cat] !== 'variabel') continue;
    if (typeof val !== 'number') continue;

    // Compute monthly totals for each active window where category has at least 1 expense
    const windowsWithData = activeWindows
      .map(window => {
        const monthExpenses = _filterToWindow(allExpenses, window).filter(e => e.category === cat);
        if (monthExpenses.length === 0) return null;
        return monthExpenses.reduce((s, e) => s + e.amount, 0);
      })
      .filter(total => total !== null);

    // Need at least 2 windows with data to compute variance
    if (windowsWithData.length < 2) continue;

    const minTotal = Math.min(...windowsWithData);
    const maxTotal = Math.max(...windowsWithData);
    const variance = maxTotal - minTotal;
    const avg = Math.round(windowsWithData.reduce((s, t) => s + t, 0) / windowsWithData.length);
    const headroom = avg - minTotal;

    if (variance > highestVariance) {
      highestVariance = variance;
      savings = { category: cat, min: minTotal, avg, headroom };
    }
  }

  return {
    sufficient: true,
    monthsUsed: result.monthsUsed,
    categories,
    classifications,
    savings
  };
}

/**
 * Pure synchronous formatter for classifyPrediction result.
 * @param {Object} result — from classifyPrediction()
 * @returns {string}
 */
function _formatPrediction(result) {
  if (!result.sufficient) {
    return `Data kamu baru ${result.daysLogged} hari \u2014 butuh minimal 30 hari buat prediksi yang akurat. Terus catat ya!`;
  }

  const lines = [];
  lines.push(`Prediksi bulan depan (berdasarkan ${result.monthsUsed} bulan terakhir):\n`);

  let total = 0;
  for (const [cat, val] of Object.entries(result.categories)) {
    const emoji = CATEGORY_EMOJI[cat] || '\u{1F4E6}';
    if (val === 'kurang data') {
      lines.push(`${emoji} ${cat} \u2014 kurang data`);
    } else {
      total += val;
      const label = result.classifications[cat] || '';
      lines.push(`${emoji} ${cat} \u2014 ${label} \u2014 ~Rp ${_formatAmount(val)}`);
    }
  }

  lines.push('');
  lines.push(`Total kira-kira: ~Rp ${_formatAmount(total)}`);

  if (result.savings) {
    lines.push('');
    lines.push(
      `Kalau mau hemat, coba kurangin ${result.savings.category} \u2014 bulan lalu bisa se-rendah ${_formatAmount(result.savings.min)}, rata-ratanya ${_formatAmount(result.savings.avg)}. Ada ruang ~${_formatAmount(result.savings.headroom)} buat dihemat.`
    );
  }

  return lines.join('\n');
}

module.exports = { buildPrediction, _selectMonthWindows, _computeCategories, classifyPrediction, _formatPrediction, _formatAmount };
