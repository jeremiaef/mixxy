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
  if (prev < 0.8 && curr > 0.8) return '80%';
  return null;
}

/**
 * Returns a Bahasa Indonesia string summarizing budget usage.
 * e.g. "Budget bulan ini: 500rb. Udah kepake 350rb (70%)."
 */
function formatBudgetProgress(budget, monthTotal) {
  const pct = Math.round((monthTotal / budget) * 100);
  return `Budget bulan ini: ${_formatAmount(budget)}. Udah kepake ${_formatAmount(monthTotal)} (${pct}%).`;
}

/**
 * After an expense is appended, check if a budget threshold was just crossed.
 * Returns the original reply, possibly with a warning/roast paragraph appended.
 *
 * @param {string} userId
 * @param {number} expenseAmount — the amount that was JUST appended
 * @param {string} currentReply — the existing reply to potentially extend
 * @returns {Promise<string>}
 */
async function checkBudgetAlert(userId, expenseAmount, currentReply) {
  const meta = await storage.readMeta(userId);
  if (!meta.budget) return currentReply;

  const expenses = await storage.readExpenses(userId);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const monthTotal = expenses
    .filter(e => {
      const d = new Date(e.timestamp);
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const prevTotal = monthTotal - expenseAmount;
  const threshold = detectThreshold(prevTotal, monthTotal, meta.budget);

  if (threshold === '100%') {
    return currentReply + '\n\n' +
      `Budget ${_formatAmount(meta.budget)} kamu bulan ini udah jebol 💸 Selamat, kamu resmi boros. Mungkin saatnya makan nasi sama kecap aja?`;
  }
  if (threshold === '80%') {
    return currentReply + '\n\n' +
      `Heads up: udah ${Math.round((monthTotal / meta.budget) * 100)}% dari budget ${_formatAmount(meta.budget)} kamu bulan ini. Hati-hati ya!`;
  }

  return currentReply;
}

module.exports = { detectThreshold, formatBudgetProgress, checkBudgetAlert, _formatAmount };
