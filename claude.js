'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, EXPENSE_TOOL } = require('./prompts');

// Module-level client — created once, reused for all calls
const defaultClient = new Anthropic();

async function processMessage(userId, text, clientOverride) {
  const client = clientOverride || defaultClient;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    tools: [EXPENSE_TOOL],
    messages: [{ role: 'user', content: text }],
  });

  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (toolBlock) {
    return {
      isExpense: true,
      expense: {
        amount: toolBlock.input.amount,
        category: toolBlock.input.category,
        description: toolBlock.input.description,
      },
      reply: toolBlock.input.reply,
    };
  }

  const textBlock = response.content.find(b => b.type === 'text');
  return {
    isExpense: false,
    reply: textBlock ? textBlock.text : 'Hm, gue kurang ngerti. Coba: "makan siang 35rb"',
  };
}

module.exports = { processMessage };
