const test = require('node:test');
const assert = require('node:assert');
const { checkPassword, passwordError } = require('../src/utils/password');

test('strong password meets every rule', () => {
  assert.strictEqual(checkPassword('farm2026$').strong, true);
  assert.strictEqual(passwordError('Quail#123'), null);
});

test('each missing rule is reported', () => {
  assert.match(passwordError('a1$'), /8 characters/);
  assert.match(passwordError('password$$'), /number/);
  assert.match(passwordError('password12'), /special/);
});

test('spaces do not count as special characters', () => {
  assert.strictEqual(checkPassword('pass word 12').strong, false);
});

test('missing or non-string input is weak, not an exception', () => {
  assert.strictEqual(checkPassword(undefined).strong, false);
  assert.ok(passwordError(null));
});
