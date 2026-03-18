'use strict';
const storage = require('./storage');

// Local formatAmount — same logic as index.js _formatAmount, no circular import
function _formatAmount(amount) {
  if (amount >= 1000000) {
    const jt = amount / 1000000;
    return Number.isInteger(jt) ? jt + 'jt' : jt.toFixed(1) + 'jt';
  }
  return (amount / 1000) + 'rb';
}

/**
 * Returns '80%', '100%', or null.
 * prevTotal = month total BEFORE the new expense
 * newTotal  = month total AFTER the new expense (prevTotal + expense.amount)
 */
function detectThreshold(prevTotal, newTotal, budget) {
  const prev = prevTotal / budget;
  const curr = newTotal / budget;
  if (prev < 1.0 && curr >= 1.0) return '100%';
  if (prev < 0.8 && curr >= 0.8) return '80%';
  return null;
}

/**
 * Returns a Bahasa Indonesia string summarizing budget usage.
 * If category provided: "Budget makan bulan ini: 200rb. Udah kepake 170rb (85%)."
 * If no category: "Budget bulan ini: 500rb. Udah kepake 350rb (70%)."
 *
 * @param {number} budget
 * @param {number} monthTotal
 * @param {string} [category]
 */
function formatBudgetProgress(budget, monthTotal, category) {
  const pct = Math.round((monthTotal / budget) * 100);
  const label = category ? `Budget ${category} bulan ini` : 'Budget bulan ini';
  return `${label}: ${_formatAmount(budget)}. Udah kepake ${_formatAmount(monthTotal)} (${pct}%).`;
}

/**
 * After an expense is appended, check if a budget threshold was just crossed.
 * Returns the original reply, possibly with a warning/roast paragraph appended.
 *
 * Lookup priority:
 *   1. If meta.budgets[category] exists — use per-category budget, filter expenses to that category.
 *   2. Else if meta.budget exists — use global budget, sum ALL month expenses.
 *   3. Else — no budget set, return currentReply unchanged.
 *
 * @param {string} userId
 * @param {number} expenseAmount — the amount that was JUST appended
 * @param {string} category — expense category (e.g. 'makan', 'transport')
 * @param {string} currentReply — the existing reply to potentially extend
 * @returns {Promise<string>}
 */
async function checkBudgetAlert(userId, expenseAmount, category, currentReply) {
  const meta = await storage.readMeta(userId);
  const expenses = await storage.readExpenses(userId);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  let applicableBudget;
  let relevantTotal;

  if (meta.budgets && meta.budgets[category] != null) {
    // Per-category budget path
    applicableBudget = meta.budgets[category];
    relevantTotal = expenses
      .filter(e => {
        const d = new Date(e.timestamp);
        return d.getUTCFullYear() === year && d.getUTCMonth() === month && e.category === category;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  } else if (meta.budget) {
    // Global budget fallback
    applicableBudget = meta.budget;
    relevantTotal = expenses
      .filter(e => {
        const d = new Date(e.timestamp);
        return d.getUTCFullYear() === year && d.getUTCMonth() === month;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  } else {
    return currentReply;
  }

  const prevTotal = relevantTotal - expenseAmount;
  const threshold = detectThreshold(prevTotal, relevantTotal, applicableBudget);

  if (threshold === '100%') {
    return currentReply + '\n\n' +
      `Budget ${_formatAmount(applicableBudget)} kamu bulan ini udah jebol 💸 Selamat, kamu resmi boros. Mungkin saatnya makan nasi sama kecap aja?`;
  }
  if (threshold === '80%') {
    return currentReply + '\n\n' +
      `Heads up: udah ${Math.round((relevantTotal / applicableBudget) * 100)}% dari budget ${_formatAmount(applicableBudget)} kamu bulan ini. Hati-hati ya!`;
  }

  return currentReply;
}

module.exports = { detectThreshold, formatBudgetProgress, checkBudgetAlert, _formatAmount };
