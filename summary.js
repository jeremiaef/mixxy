'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const storage = require('./storage');

const defaultClient = new Anthropic();

// --- Filters ---

function _filterCurrentMonth(expenses) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
}

function _filterPastWeek(expenses) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return expenses.filter(e => new Date(e.timestamp).getTime() >= cutoff);
}

// --- Aggregation ---

function _buildBreakdown(expenses) {
  const map = {};
  for (const e of expenses) {
    if (!map[e.category]) map[e.category] = { total: 0, count: 0 };
    map[e.category].total += e.amount;
    map[e.category].count += 1;
  }
  return map;
}

function _formatIDR(amount) {
  return amount.toLocaleString('id-ID');
}

function _formatBreakdown(breakdown) {
  return Object.entries(breakdown)
    .map(([cat, { total, count }]) => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      return `${label}: ${count}x • ${_formatIDR(total)}`;
    })
    .join('\n');
}

// --- Claude insight ---

async function generateInsight(expenses, period, clientOverride) {
  const client = clientOverride || defaultClient;
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryList = Object.entries(_buildBreakdown(expenses))
    .map(([cat, { total, count }]) => `${cat}: ${count}x ${_formatIDR(total)}`)
    .join(', ');
  const prompt = `Kamu adalah Mixxy, asisten keuangan kasual. Berikan insight singkat (1-2 kalimat, Bahasa Indonesia kasual) untuk pengeluaran ${period} berikut: total ${_formatIDR(totalAmount)}, kategori: ${categoryList}. Beri saran praktis atau observasi menarik.`;
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : 'Semangat terus ngaturnya ya!';
}

// --- Summary builders ---

async function buildMonthlySummary(userId, clientOverride) {
  const expenses = await storage.readExpenses(userId);
  const monthly = _filterCurrentMonth(expenses);
  if (monthly.length === 0) {
    return "Bulan ini belum ada pengeluaran yang dicatat. Coba: 'makan siang 35rb'";
  }
  const breakdown = _buildBreakdown(monthly);
  const total = monthly.reduce((sum, e) => sum + e.amount, 0);
  const lines = _formatBreakdown(breakdown);
  const insight = await generateInsight(monthly, 'bulanan', clientOverride);
  return `Rekap bulan ini:\n${lines}\n\nTotal: ${_formatIDR(total)}\n\n${insight}`;
}

async function buildWeeklySummary(userId, clientOverride) {
  const expenses = await storage.readExpenses(userId);
  const weekly = _filterPastWeek(expenses);
  if (weekly.length === 0) {
    return null;
  }
  const breakdown = _buildBreakdown(weekly);
  const total = weekly.reduce((sum, e) => sum + e.amount, 0);
  const lines = _formatBreakdown(breakdown);
  const insight = await generateInsight(weekly, 'mingguan', clientOverride);
  return `Rekap minggu ini:\n${lines}\n\nTotal: ${_formatIDR(total)}\n\n${insight}`;
}

module.exports = {
  buildMonthlySummary,
  buildWeeklySummary,
  generateInsight,
  _filterCurrentMonth,
  _filterPastWeek,
  _buildBreakdown,
};
