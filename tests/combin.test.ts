import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binom, forEachCountVector, ratio } from '../src/core/combin.ts';

test('binom is 0 when k is below 0 or above n', () => {
  assert.equal(binom(5, -1), 0n);
  assert.equal(binom(5, 6), 0n);
  assert.equal(binom(0, 1), 0n);
});

test('binom edge values', () => {
  assert.equal(binom(0, 0), 1n);
  assert.equal(binom(5, 0), 1n);
  assert.equal(binom(5, 5), 1n);
  assert.equal(binom(10, 3), 120n);
  assert.equal(binom(60, 7), 386206920n);
});

test('binom(250, 125) equals an independent Pascal triangle', () => {
  // Additive rows share nothing with the multiplicative formula in the engine.
  let row: bigint[] = [1n];
  for (let n = 1; n <= 250; n++) {
    const next: bigint[] = [1n];
    for (let k = 1; k < n; k++) next.push(row[k - 1]! + row[k]!);
    next.push(1n);
    row = next;
  }
  assert.equal(binom(250, 125), row[125]);
  assert.equal(binom(250, 3), row[3]);
  // About 9.12e73, far past the 2^53 limit of exact floats.
  assert.ok(binom(250, 125) > 10n ** 73n);
});

test('ratio divides exactly before it makes a float', () => {
  assert.equal(ratio(0n, 7n), 0);
  assert.equal(ratio(5n, 5n), 1);
  assert.ok(Math.abs(ratio(1n, 3n) - 1 / 3) < 1e-15);
  const huge = binom(250, 125);
  assert.equal(ratio(huge, huge * 2n), 0.5);
  assert.ok(Math.abs(ratio(huge, huge * 3n) - 1 / 3) < 1e-15);
});

test('forEachCountVector visits every vector within caps and sum', () => {
  const seen: string[] = [];
  forEachCountVector([2, 1], 2, (v) => seen.push(v.join(',')));
  assert.deepEqual(seen.sort(), ['0,0', '0,1', '1,0', '1,1', '2,0']);
});

test('forEachCountVector with no caps visits the empty vector once', () => {
  const seen: string[] = [];
  forEachCountVector([], 7, (v) => seen.push(`[${v.join(',')}]`));
  assert.deepEqual(seen, ['[]']);
});
