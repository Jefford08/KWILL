const test = require('node:test');
const assert = require('node:assert/strict');
const { eggTotals, mortalityRate, saleTotal, profit } = require('../src/utils/calculations');

test('eggTotals computes total and damage rate', () => {
  const result = eggTotals(90, 10);
  assert.equal(result.total, 100);
  assert.equal(result.damageRate, 10);
});

test('eggTotals handles zero total without dividing by zero', () => {
  const result = eggTotals(0, 0);
  assert.equal(result.total, 0);
  assert.equal(result.damageRate, 0);
});

test('mortalityRate computes percentage against population before', () => {
  assert.equal(mortalityRate(5, 200), 2.5);
});

test('mortalityRate returns 0 when population is 0 or negative', () => {
  assert.equal(mortalityRate(5, 0), 0);
  assert.equal(mortalityRate(5, -10), 0);
});

test('saleTotal multiplies quantity by unit price', () => {
  assert.equal(saleTotal(12, 2.5), 30);
});

test('profit subtracts expenses from sales', () => {
  assert.equal(profit(500, 320.5), 179.5);
});

//for test calculations - new note