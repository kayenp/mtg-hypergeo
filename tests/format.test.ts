import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPercent } from '../src/core/format.ts';

test('percent with two decimals [R12]', () => {
  assert.equal(formatPercent(0.39950952), '39.95%');
  assert.equal(formatPercent(0.5), '50.00%');
  assert.equal(formatPercent(0), '0.00%');
  assert.equal(formatPercent(1), '100.00%');
});

test('a value near but not at 0 or 1 does not round to look exact [R12]', () => {
  assert.equal(formatPercent(0.000001), '<0.01%');
  assert.equal(formatPercent(0.999999), '>99.99%');
});
