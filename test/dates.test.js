const test = require('node:test');
const assert = require('node:assert');
const { today, monthStart, formatDate } = require('../src/utils/dates');

test('today is a YYYY-MM-DD date in the farm time zone', () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
  const manila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  assert.strictEqual(today(), manila);
});

test('monthStart is the first of the current month', () => {
  assert.strictEqual(monthStart(), today().slice(0, 8) + '01');
});

test('formatDate shows a readable date without shifting the day', () => {
  assert.strictEqual(formatDate('2026-01-01'), 'Jan 1, 2026');
  assert.strictEqual(formatDate('2026-12-31'), 'Dec 31, 2026');
  assert.strictEqual(formatDate(''), '');
});
