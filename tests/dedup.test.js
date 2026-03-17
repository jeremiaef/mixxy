'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Set TELEGRAM_TOKEN before requiring index.js (needed for token validation)
process.env.TELEGRAM_TOKEN = 'test-token-for-unit-tests';
process.env.NODE_ENV = 'test';

const { _dedupCheck, _processedMessages } = require('../index.js');

describe('dedup guard', () => {
  beforeEach(() => {
    // Clear the processed messages Set before each test
    _processedMessages.clear();
  });

  it('first message returns false (not seen)', () => {
    const result = _dedupCheck(123, 1);
    assert.equal(result, false);
  });

  it('same message returns true (duplicate)', () => {
    _dedupCheck(123, 1);
    const result = _dedupCheck(123, 1);
    assert.equal(result, true);
  });

  it('different messageId returns false', () => {
    _dedupCheck(123, 1);
    const result = _dedupCheck(123, 2);
    assert.equal(result, false);
  });

  it('different chatId returns false', () => {
    _dedupCheck(123, 1);
    const result = _dedupCheck(456, 1);
    assert.equal(result, false);
  });

  it('key format is chatId:messageId', () => {
    _dedupCheck(123, 1);
    assert.equal(_processedMessages.has('123:1'), true);
  });
});
