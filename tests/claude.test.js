'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Inject a mock ANTHROPIC_API_KEY so the module-level Anthropic() constructor
// doesn't throw when claude.js is required
process.env.ANTHROPIC_API_KEY = 'test-key-not-used-in-tests';

const { processMessage } = require('../claude.js');

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMockClient(response) {
  return {
    messages: {
      create: async () => response,
    },
  };
}

function makeThrowingClient(errorMsg) {
  return {
    messages: {
      create: async () => { throw new Error(errorMsg); },
    },
  };
}

// ---------------------------------------------------------------------------
// Mock API responses
// ---------------------------------------------------------------------------

const EXPENSE_RESPONSE = {
  content: [{
    type: 'tool_use',
    id: 'toolu_test',
    name: 'log_expense',
    input: {
      amount: 35000,
      category: 'makan',
      description: 'nasi goreng',
      reply: 'Oke, nasi goreng 35rb (makan) dicatat!',
    },
  }],
  stop_reason: 'tool_use',
};

const OFFTOPIC_RESPONSE = {
  content: [{
    type: 'text',
    text: 'Gue cuma bisa bantu catat pengeluaran. Coba: makan siang 35rb',
  }],
  stop_reason: 'end_turn',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processMessage', () => {
  it('returns isExpense true for expense input', async () => {
    const mockClient = makeMockClient(EXPENSE_RESPONSE);
    const result = await processMessage('user1', 'nasi goreng 35rb', mockClient);
    assert.equal(result.isExpense, true);
  });

  it('returns expense fields correctly', async () => {
    const mockClient = makeMockClient(EXPENSE_RESPONSE);
    const result = await processMessage('user1', 'nasi goreng 35rb', mockClient);
    assert.equal(result.expense.amount, 35000);
    assert.equal(result.expense.category, 'makan');
    assert.equal(result.expense.description, 'nasi goreng');
  });

  it('returns reply string for expense', async () => {
    const mockClient = makeMockClient(EXPENSE_RESPONSE);
    const result = await processMessage('user1', 'nasi goreng 35rb', mockClient);
    assert.equal(typeof result.reply, 'string');
    assert.ok(result.reply.length > 0, 'reply should be non-empty');
    assert.ok(!result.reply.includes('\n'), 'reply should not contain newlines');
  });

  it('returns isExpense false for off-topic', async () => {
    const mockClient = makeMockClient(OFFTOPIC_RESPONSE);
    const result = await processMessage('user1', 'bagaimana cuaca hari ini?', mockClient);
    assert.equal(result.isExpense, false);
  });

  it('returns redirect reply for off-topic', async () => {
    const mockClient = makeMockClient(OFFTOPIC_RESPONSE);
    const result = await processMessage('user1', 'bagaimana cuaca hari ini?', mockClient);
    assert.equal(typeof result.reply, 'string');
    assert.ok(result.reply.length > 0, 'reply should be non-empty');
  });

  it('passes correct model and tools to API', async () => {
    let capturedArgs;
    const capturingClient = {
      messages: {
        create: async (args) => {
          capturedArgs = args;
          return EXPENSE_RESPONSE;
        },
      },
    };
    await processMessage('user1', 'nasi goreng 35rb', capturingClient);
    assert.equal(capturedArgs.model, 'claude-haiku-4-5', 'wrong model');
    assert.ok(Array.isArray(capturedArgs.tools), 'tools should be an array');
    assert.equal(capturedArgs.tools.length, 1, 'should have exactly 1 tool');
    assert.equal(capturedArgs.tools[0].name, 'log_expense', 'tool name should be log_expense');
    assert.ok(typeof capturedArgs.system === 'string' && capturedArgs.system.length > 0, 'system prompt should be non-empty string');
  });

  it('throws when API client throws', async () => {
    const throwingClient = makeThrowingClient('API down');
    await assert.rejects(
      () => processMessage('user1', 'nasi goreng 35rb', throwingClient),
      { message: 'API down' }
    );
  });
});
