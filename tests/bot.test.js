'use strict';
const { describe, it } = require('node:test');
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
