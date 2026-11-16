import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratio } from '../src/core/combin.ts';
import { canKeep } from '../src/core/goal.ts';
import { keepChance } from '../src/core/mulligan.ts';
import type { Group } from '../src/core/types.ts';
import { SMALL_DECKS, close, toGroups } from './decks.ts';
import { oracleQ } from './oracle.ts';

const lands: Group = { name: 'Lands', copies: 24, least: 2, most: 4 };
const combo: Group = { name: 'Combo', copies: 4, least: 1, most: 1 };

test('the engine equals the brute-force count for every keep size on small decks [R10]', () => {
  for (const { label, deck } of SMALL_DECKS) {
    for (let k = 0; k <= 7; k++) {
      const f = keepChance(deck.size, toGroups(deck), k);
      const want = oracleQ(deck, k).toNumber();
      assert.ok(close(ratio(f.num, f.den), want), `${label}, keep ${k}: engine ${ratio(f.num, f.den)}, oracle ${want}`);
    }
  }
});

test('a draw with too many of a group can still keep when it can bottom the extras', () => {
  // 6 lands and 1 spell: keep 5 means bottom 2 lands, which leaves 4 lands and 1 spell.
  assert.equal(canKeep([6], 1, [lands], 5), true);
  // Keep 7 holds all 6 lands, above the most of 4.
  assert.equal(canKeep([6], 1, [lands], 7), false);
});

test('a most limit fails the keep when no choice of cards fits it', () => {
  // 2 lands and 3 combo pieces in 7 with 2 other: at 7 the hand holds 3 combo pieces, most is 1.
  assert.equal(canKeep([2, 3], 2, [lands, combo], 7), false);
  // At 5 the player keeps 2 lands, 1 combo piece and 2 other.
  assert.equal(canKeep([2, 3], 2, [lands, combo], 5), true);
});

test('the least counts must fit in the kept size', () => {
  const big: Group = { name: 'Big', copies: 10, least: 6, most: null };
  assert.equal(canKeep([7], 0, [big], 6), true);
  assert.equal(canKeep([7], 0, [big], 5), false);
});

test('a group below its least count fails', () => {
  assert.equal(canKeep([1], 6, [lands], 7), false);
});

test('the oracle itself gives 1 - C(8,7)/C(12,7) for 4 copies in 12, least 1', () => {
  assert.ok(close(oracleQ({ size: 12, groups: [{ copies: 4, least: 1, most: null }] }, 7).toNumber(), 1 - 8 / 792));
});
