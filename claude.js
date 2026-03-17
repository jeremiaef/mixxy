'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, EXPENSE_TOOL, REKAP_TOOL } = require('./prompts');

// Module-level client — created once, reused for all calls
const defaultClient = new Anthropic();

async function processMessage(userId, text, clientOverride) {
  const client = clientOverride || defaultClient;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    tools: [EXPENSE_TOOL, REKAP_TOOL],
    messages: [{ role: 'user', content: text }],
  });

  // Check for report_intent tool call (rekap)
  const rekapBlock = response.content.find(
    b => b.type === 'tool_use' && b.name === 'report_intent'
  );
  if (rekapBlock) {
    return {
      intent: rekapBlock.input.type,  // 'rekap_bulan' or 'rekap_minggu'
      isExpense: false,
    };
  }

  // Check for log_expense tool call
  const expenseBlock = response.content.find(
    b => b.type === 'tool_use' && b.name === 'log_expense'
  );
  if (expenseBlock) {
    return {
      intent: 'expense',
      isExpense: true,
      expense: {
        amount: expenseBlock.input.amount,
        category: expenseBlock.input.category,
        description: expenseBlock.input.description,
      },
      reply: expenseBlock.input.reply,
    };
  }

  // Fallback: text response (off-topic redirect)
  const textBlock = response.content.find(b => b.type === 'text');
  return {
    intent: 'redirect',
    isExpense: false,
    reply: textBlock ? textBlock.text : 'Hm, gue kurang ngerti. Coba: "makan siang 35rb"',
  };
}

module.exports = { processMessage };
