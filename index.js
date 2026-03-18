'use strict';
require('dotenv').config();

const path = require('path');
const fs = require('fs').promises;
const TelegramBot = require('node-telegram-bot-api');
const storage = require('./storage');
const { processMessage } = require('./claude');
const { buildMonthlySummary, buildWeeklySummary } = require('./summary');
const { checkBudgetAlert, formatBudgetProgress } = require('./budget');
const { classifyPrediction, _formatPrediction } = require('./predict');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_TOKEN not set in .env');
}

// Dedup guard: prevent processing same message twice within a session
const processedMessages = new Set();

function dedupCheck(chatId, messageId) {
  const key = `${chatId}:${messageId}`;
  if (processedMessages.has(key)) return true;
  processedMessages.add(key);
  return false;
}

function formatAmount(amount) {
  if (amount >= 1000000) {
    const jt = amount / 1000000;
    return Number.isInteger(jt) ? jt + 'jt' : jt.toFixed(1) + 'jt';
  }
  return (amount / 1000) + 'rb';
}

// Static command messages
const START_MESSAGE = 'Halo! Gue Mixxy, asisten pencatat pengeluaran kamu via Telegram\n\nCaranya gampang banget — tinggal ketik pengeluaran kamu kayak chat biasa:\n\n• "makan siang 35rb"\n• "grab ke kantor 22ribu"\n• "bayar tagihan listrik 150rb"\n• "kopi 25rb"\n\nGue bakal langsung catat, kategoriin, dan kasih tau totalnya.\n\nKetik /help buat lihat semua perintah yang tersedia.';

const HELP_MESSAGE = 'Perintah yang tersedia:\n\n/rekap — lihat rekap pengeluaran bulan ini\n/budget <jumlah> — set budget bulanan (contoh: /budget 500000 atau /budget makan 200000)\n/budget — lihat progress budget bulan ini\n/prediksi — lihat prediksi pengeluaran bulan depan\n/hapus — hapus pengeluaran terakhir\n/start — tampilkan pesan selamat datang\n/help — tampilkan perintah ini\n\nAtau tinggal ketik pengeluaran kamu langsung, contoh: "makan 35rb"';

const VALID_CATEGORIES = ['makan', 'transport', 'hiburan', 'tagihan', 'kost', 'pulsa', 'ojol', 'jajan', 'lainnya'];

// Discover all known users from data/ directory
async function discoverUsers() {
  const files = await fs.readdir(DATA_DIR).catch(() => []);
  return files
    .filter(f => f.endsWith('.json') && !f.endsWith('_meta.json'))
    .map(f => f.replace('.json', ''));
}

// Only start bot when run directly (not when required by tests)
if (require.main === module) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on('message', async (msg) => {
    if (dedupCheck(msg.chat.id, msg.message_id)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const userId = String(chatId);
    const text = msg.text.trim();

    try {
      // --- Static command guards (no Claude call) ---

      if (text === '/start' || text.startsWith('/start@')) {
        await bot.sendMessage(chatId, START_MESSAGE);
        return;
      }

      if (text === '/help' || text.startsWith('/help@')) {
        await bot.sendMessage(chatId, HELP_MESSAGE);
        return;
      }

      if (text === '/rekap' || text.startsWith('/rekap@')) {
        const summary = await buildMonthlySummary(userId);
        await bot.sendMessage(chatId, summary);
        return;
      }

      if (text === '/prediksi' || text.startsWith('/prediksi@')) {
        const result = await classifyPrediction(userId);
        await bot.sendMessage(chatId, _formatPrediction(result));
        return;
      }

      if (text === '/hapus' || text.startsWith('/hapus@')) {
        const removed = await storage.popExpense(userId);
        if (removed) {
          const formatted = formatAmount(removed.amount);
          await bot.sendMessage(chatId, `Dihapus: ${removed.description} ${formatted} (${removed.category})`);
        } else {
          await bot.sendMessage(chatId, 'Belum ada pengeluaran yang dicatat.');
        }
        return;
      }

      if (text === '/budget' || text.startsWith('/budget@') || text.startsWith('/budget ')) {
        const parts = text.split(/\s+/);
        const arg1 = parts[1] ? parts[1].trim().toLowerCase() : null;
        const arg2 = parts[2] ? parts[2].trim() : null;

        if (arg1 && VALID_CATEGORIES.includes(arg1) && arg2) {
          // /budget makan 200000 — set per-category budget
          const amount = parseInt(arg2, 10);
          if (isNaN(amount) || amount <= 0) {
            await bot.sendMessage(chatId, `Format salah. Contoh: /budget ${arg1} 200000`);
            return;
          }
          const meta = await storage.readMeta(userId);
          await storage.writeMeta(userId, { ...meta, budgets: { ...meta.budgets, [arg1]: amount } });
          await bot.sendMessage(chatId, `Budget ${arg1} bulanan kamu disetel ke ${formatAmount(amount)}. Semangat nabungnya!`);
        } else if (arg1 && VALID_CATEGORIES.includes(arg1)) {
          // /budget makan — view per-category progress
          const meta = await storage.readMeta(userId);
          if (!meta.budgets || meta.budgets[arg1] == null) {
            await bot.sendMessage(chatId, `Belum ada budget untuk ${arg1}. Coba: /budget ${arg1} 200000`);
            return;
          }
          const expenses = await storage.readExpenses(userId);
          const now = new Date();
          const year = now.getUTCFullYear();
          const month = now.getUTCMonth();
          const categoryTotal = expenses
            .filter(e => {
              const d = new Date(e.timestamp);
              return d.getUTCFullYear() === year && d.getUTCMonth() === month && e.category === arg1;
            })
            .reduce((sum, e) => sum + e.amount, 0);
          await bot.sendMessage(chatId, formatBudgetProgress(meta.budgets[arg1], categoryTotal, arg1));
        } else if (arg1) {
          // /budget 500000 — set global budget
          const amount = parseInt(arg1, 10);
          if (isNaN(amount) || amount <= 0) {
            await bot.sendMessage(chatId, 'Format salah. Contoh: /budget 500000');
            return;
          }
          const meta = await storage.readMeta(userId);
          await storage.writeMeta(userId, { ...meta, budget: amount });
          await bot.sendMessage(chatId, `Budget bulanan kamu disetel ke ${formatAmount(amount)}. Semangat nabungnya!`);
        } else {
          // /budget — view all budgets
          const meta = await storage.readMeta(userId);
          const hasGlobal = !!meta.budget;
          const hasCategories = meta.budgets && Object.keys(meta.budgets).length > 0;

          if (!hasGlobal && !hasCategories) {
            await bot.sendMessage(chatId, 'Belum ada budget yang disetel. Coba: /budget 500000');
            return;
          }

          const expenses = await storage.readExpenses(userId);
          const now = new Date();
          const year = now.getUTCFullYear();
          const month = now.getUTCMonth();
          const thisMonthExpenses = expenses.filter(e => {
            const d = new Date(e.timestamp);
            return d.getUTCFullYear() === year && d.getUTCMonth() === month;
          });

          const lines = [];

          if (hasGlobal) {
            const monthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
            lines.push(formatBudgetProgress(meta.budget, monthTotal));
          }

          if (hasCategories) {
            for (const [cat, limit] of Object.entries(meta.budgets)) {
              const catTotal = thisMonthExpenses
                .filter(e => e.category === cat)
                .reduce((sum, e) => sum + e.amount, 0);
              lines.push(formatBudgetProgress(limit, catTotal, cat));
            }
          }

          await bot.sendMessage(chatId, lines.join('\n'));
        }
        return;
      }

      // --- Route through Claude (NLP) ---
      const result = await processMessage(userId, text);

      if (result.intent === 'rekap_bulan') {
        const summary = await buildMonthlySummary(userId);
        await bot.sendMessage(chatId, summary);
        return;
      }

      if (result.intent === 'rekap_minggu') {
        const summary = await buildWeeklySummary(userId);
        await bot.sendMessage(chatId, summary || 'Minggu ini belum ada pengeluaran yang dicatat.');
        return;
      }

      if (result.isExpense) {
        await storage.appendExpense(userId, result.expense);
        const finalReply = await checkBudgetAlert(userId, result.expense.amount, result.expense.category, result.reply);
        await bot.sendMessage(chatId, finalReply);
        return;
      }

      // redirect or unrecognized
      await bot.sendMessage(chatId, result.reply);

    } catch (err) {
      console.error('Message handling failed:', err.message);
      await bot.sendMessage(chatId, 'Waduh, ada error. Coba lagi ya.').catch(() => {});
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[polling_error]', err.code, err.message);
  });

  // Weekly digest: every Sunday 03:00 UTC (10:00 WIB)
  const cron = require('node-cron');
  cron.schedule('0 3 * * 0', async () => {
    console.log('[cron] Starting weekly digest...');
    const userIds = await discoverUsers();
    for (const uid of userIds) {
      try {
        const digest = await buildWeeklySummary(uid);
        if (digest) {
          await bot.sendMessage(uid, digest);
        }
      } catch (err) {
        // User blocked bot, chat not found, or API error — log and continue
        console.error(`[cron] Weekly digest failed for ${uid}:`, err.message);
      }
    }
    console.log(`[cron] Weekly digest complete. Sent to ${userIds.length} users.`);
  });

  console.log('Bot started.');
}

module.exports = {
  _dedupCheck: dedupCheck,
  _processedMessages: processedMessages,
  _formatAmount: formatAmount,
  _START_MESSAGE: START_MESSAGE,
  _HELP_MESSAGE: HELP_MESSAGE,
};
