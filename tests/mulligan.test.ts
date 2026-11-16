import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratio } from '../src/core/combin.ts';
import { exactChain, keepChance, mulliganChain } from '../src/core/mulligan.ts';
import type { Group, Inputs } from '../src/core/types.ts';
import { SMALL_DECKS, close, toGroups } from './decks.ts';
import { oracleChain } from './oracle.ts';

const one = (copies: number, least: number, most: number | null = null): Group => ({ name: 'A', copies, least, most });

function inputs(deckSize: number, groups: Group[], minHand: number, freeMulligans = 0): Inputs {
  return { deckSize, groups, minHand, freeMulligans, onPlay: true, maxTurn: 10, seed: 1, trials: 1000 };
}

test('keep chances plus the fail chance add up to 1 [R7]', () => {
  const cases: Inputs[] = [
    inputs(60, [{ name: 'Lands', copies: 24, least: 2, most: 4 }], 5),
    inputs(60, [{ name: 'Lands', copies: 24, least: 2, most: 4 }, one(4, 1, 1)], 4, 1),
    inputs(99, [{ name: 'Lands', copies: 37, least: 3, most: 5 }], 5, 1),
    inputs(40, [one(17, 2, 4), one(6, 1, 2), one(3, 0, 1)], 0, 2),
  ];
  for (const c of cases) {
    const chain = mulliganChain(c);
    assert.ok(chain.steps.length > 0, 'no steps');
    const total = chain.steps.reduce((s, x) => s + x.pKeep, 0) + chain.pFail;
    assert.ok(close(total, 1), `sum ${total}`);
    for (const s of chain.steps) assert.ok(close(s.pKeep, s.pReach * s.q), `step ${s.mulligans}`);
  }
});

test('exact keep fractions plus the exact fail fraction equal 1 with no rounding', () => {
  const chain = exactChain(inputs(99, [one(37, 3, 5), one(8, 1, 2)], 4, 1));
  let num = chain.pFail.num;
  let den = chain.pFail.den;
  for (const f of chain.pKeep) {
    num = num * f.den + f.num * den;
    den = den * f.den;
  }
  assert.equal(num, den);
});

test('4 copies in 60, at least 1 in 7 cards, equals 1 - C(56,7)/C(60,7) [R6]', () => {
  let missAll = 1;
  for (let i = 0; i < 7; i++) missAll *= (56 - i) / (60 - i);
  const f = keepChance(60, [one(4, 1)], 7);
  const p = ratio(f.num, f.den);
  assert.ok(Math.abs(p - (1 - missAll)) < 1e-12, `got ${p}`);
  assert.equal(p.toFixed(4), '0.3995');
});

test('the chain equals the brute-force chain on small decks, with and without a free mulligan [R10]', () => {
  // Kept sizes written out by hand. "least sum 5" is the only deck whose least counts pass minHand 4.
  for (const { label, deck } of SMALL_DECKS) {
    const leastSum = deck.groups.reduce((s, g) => s + g.least, 0);
    const plans: { minHand: number; free: number; sizes: number[] }[] = [
      { minHand: 5, free: 0, sizes: [7, 6, 5] },
      { minHand: 4, free: 1, sizes: leastSum === 5 ? [7, 7, 6, 5] : [7, 7, 6, 5, 4] },
      { minHand: 7, free: 0, sizes: [7] },
    ];
    for (const plan of plans) {
      const chain = mulliganChain(inputs(deck.size, toGroups(deck), plan.minHand, plan.free));
      const want = oracleChain(deck, plan.sizes);
      const where = `${label}, min ${plan.minHand}, free ${plan.free}`;
      assert.deepEqual(chain.steps.map((s) => s.handSize), plan.sizes, where);
      assert.deepEqual(chain.steps.map((s) => s.mulligans), plan.sizes.map((_, m) => m), where);
      chain.steps.forEach((s, m) => {
        assert.ok(close(s.q, want.q[m]!.toNumber()), `${where}, q at ${m}`);
        assert.ok(close(s.pKeep, want.pKeep[m]!.toNumber()), `${where}, pKeep at ${m}`);
        assert.ok(close(s.pReach, want.pReach[m]!.toNumber()), `${where}, pReach at ${m}`);
      });
      assert.ok(close(chain.pFail, want.pFail.toNumber()), `${where}, pFail`);
    }
  }
});

test('least counts above minHand clamp the smallest size and say so [R8]', () => {
  const groups = [one(20, 3), { ...one(20, 2), name: 'B' }];
  const chain = mulliganChain(inputs(60, groups, 3));
  assert.deepEqual(chain.clamp, { requested: 3, effective: 5 });
  assert.deepEqual(chain.steps.map((s) => s.handSize), [7, 6, 5]);
  assert.equal(chain.impossible, false);
});

test('no clamp when minHand already covers the least counts', () => {
  const chain = mulliganChain(inputs(60, [one(24, 2, 4)], 5));
  assert.equal(chain.clamp, null);
  assert.deepEqual(chain.steps.map((s) => s.handSize), [7, 6, 5]);
});

test('least counts above 7 give q 0 at each step, fail 1, and the impossible flag', () => {
  const groups = [one(20, 4), { ...one(20, 4), name: 'B' }];
  const chain = mulliganChain(inputs(60, groups, 5, 1));
  assert.equal(chain.impossible, true);
  assert.deepEqual(chain.clamp, { requested: 5, effective: 7 });
  assert.deepEqual(chain.steps.map((s) => s.handSize), [7, 7]);
  for (const s of chain.steps) assert.equal(s.q, 0);
  assert.equal(chain.pFail, 1);
});

test('least above copies gives q 0 at each step', () => {
  const chain = mulliganChain(inputs(60, [one(2, 3)], 5));
  for (const s of chain.steps) assert.equal(s.q, 0);
  assert.equal(chain.pFail, 1);
});

test('free mulligans keep 7 cards, then each mulligan takes one card', () => {
  const chain = mulliganChain(inputs(60, [one(24, 2, 4)], 5, 2));
  assert.deepEqual(chain.steps.map((s) => s.handSize), [7, 7, 7, 6, 5]);
});

test('zero groups keep at 7 every time', () => {
  const chain = mulliganChain(inputs(60, [], 5));
  assert.equal(chain.steps[0]!.q, 1);
  assert.equal(chain.steps[0]!.pKeep, 1);
  assert.equal(chain.pFail, 0);
});

test('reference: 24 lands in 60, least 2 most 4, gives q at 7 near 0.775', () => {
  const chain = mulliganChain(inputs(60, [{ name: 'Lands', copies: 24, least: 2, most: 4 }], 5));
  assert.equal(chain.steps[0]!.q.toFixed(3), '0.775');
});
