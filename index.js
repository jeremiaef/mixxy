'use strict';
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

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

// Only start bot when run directly (not when required by tests)
if (require.main === module) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on('message', async (msg) => {
    if (dedupCheck(msg.chat.id, msg.message_id)) return;

    try {
      await bot.sendMessage(msg.chat.id, 'Bot aktif! Fitur expense logging segera hadir.');
    } catch (err) {
      console.error('sendMessage failed:', err.message);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[polling_error]', err.code, err.message);
  });

  console.log('Bot started.');
}

module.exports = { _dedupCheck: dedupCheck, _processedMessages: processedMessages };
