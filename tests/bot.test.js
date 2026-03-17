'use strict';
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');

describe('bot module', () => {
  it('parses without syntax errors', () => {
    // node -c checks syntax without executing
    execSync('node -c index.js', { cwd: process.cwd() });
  });

  it('exports dedup check function', () => {
    process.env.TELEGRAM_TOKEN = 'test-token';
    process.env.NODE_ENV = 'test';
    const bot = require('../index.js');
    assert.equal(typeof bot._dedupCheck, 'function');
  });
});

describe('formatAmount', () => {
  before(() => {
    process.env.TELEGRAM_TOKEN = 'test-token';
  });

  it('formats thousands as rb', () => {
    const { _formatAmount } = require('../index.js');
    assert.equal(_formatAmount(35000), '35rb');
  });
  it('formats millions as jt', () => {
    const { _formatAmount } = require('../index.js');
    assert.equal(_formatAmount(1500000), '1.5jt');
  });
  it('formats exact millions without decimal', () => {
    const { _formatAmount } = require('../index.js');
    assert.equal(_formatAmount(2000000), '2jt');
  });
});
