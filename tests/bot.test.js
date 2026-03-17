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

describe('static command messages', () => {
  it('START_MESSAGE is a non-empty string', () => {
    process.env.TELEGRAM_TOKEN = 'test-token';
    const { _START_MESSAGE } = require('../index.js');
    assert.ok(typeof _START_MESSAGE === 'string' && _START_MESSAGE.length > 0, 'START_MESSAGE should be non-empty');
  });

  it('START_MESSAGE contains a Bahasa Indonesia expense example', () => {
    const { _START_MESSAGE } = require('../index.js');
    const hasExample = _START_MESSAGE.includes('rb') || _START_MESSAGE.includes('ribu') || _START_MESSAGE.includes('jt');
    assert.ok(hasExample, `START_MESSAGE should contain expense example with amount: ${_START_MESSAGE}`);
  });

  it('HELP_MESSAGE contains all 5 commands', () => {
    const { _HELP_MESSAGE } = require('../index.js');
    assert.ok(typeof _HELP_MESSAGE === 'string', 'HELP_MESSAGE should be a string');
    assert.ok(_HELP_MESSAGE.includes('/rekap'), `missing /rekap: ${_HELP_MESSAGE}`);
    assert.ok(_HELP_MESSAGE.includes('/budget'), `missing /budget: ${_HELP_MESSAGE}`);
    assert.ok(_HELP_MESSAGE.includes('/hapus'), `missing /hapus: ${_HELP_MESSAGE}`);
    assert.ok(_HELP_MESSAGE.includes('/start'), `missing /start: ${_HELP_MESSAGE}`);
    assert.ok(_HELP_MESSAGE.includes('/help'), `missing /help: ${_HELP_MESSAGE}`);
  });

  it('requiring index.js does not throw (cron inside require.main guard)', () => {
    process.env.TELEGRAM_TOKEN = 'test-token';
    assert.doesNotThrow(() => require('../index.js'));
  });
});
