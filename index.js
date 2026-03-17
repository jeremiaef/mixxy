'use strict';
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const storage = require('./storage');
const { processMessage } = require('./claude');

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

// Only start bot when run directly (not when required by tests)
if (require.main === module) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on('message', async (msg) => {
    if (dedupCheck(msg.chat.id, msg.message_id)) return;
    if (!msg.text) return; // ignore non-text messages (stickers, photos, etc.)

    const chatId = msg.chat.id;
    const userId = String(chatId);
    const text = msg.text.trim();

    try {
      // /hapus — direct storage, no Claude call
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

      // All other messages — route through Claude
      const result = await processMessage(userId, text);

      if (result.isExpense) {
        await storage.appendExpense(userId, result.expense);
      }

      await bot.sendMessage(chatId, result.reply);
    } catch (err) {
      console.error('Message handling failed:', err.message);
      await bot.sendMessage(chatId, 'Waduh, ada error. Coba lagi ya.').catch(() => {});
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[polling_error]', err.code, err.message);
  });

  console.log('Bot started.');
}

module.exports = { _dedupCheck: dedupCheck, _processedMessages: processedMessages, _formatAmount: formatAmount };
