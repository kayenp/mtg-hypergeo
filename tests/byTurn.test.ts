import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byTurn } from '../src/core/byTurn.ts';
import { mulliganChain } from '../src/core/mulligan.ts';
import type { Group, Inputs } from '../src/core/types.ts';
import { SMALL_DECKS, close, toGroups } from './decks.ts';
import { oracleByTurn } from './oracle.ts';

const g = (name: string, copies: number, least: number, most: number | null = null): Group => ({
  name,
  copies,
  least,
  most,
});

function inputs(deckSize: number, groups: Group[], minHand: number, freeMulligans = 0, onPlay = true, maxTurn = 20): Inputs {
  return { deckSize, groups, minHand, freeMulligans, onPlay, maxTurn, seed: 1, trials: 1000 };
}

const lands = g('Lands', 24, 2, 4);

/** byTurn rows, with a check that there are some, so an empty result cannot pass a loop test. */
function rowsOf(c: Inputs) {
  const rows = byTurn(c);
  assert.ok(rows.length > 0, 'no rows');
  return rows;
}

test('with no mulligans allowed, the mulligan line equals the plain line', () => {
  const cases = [
    inputs(60, [lands], 7),
    inputs(60, [lands, g('Combo', 4, 1, 1)], 7, 0, false),
    inputs(40, [g('A', 17, 3, 3), g('B', 6, 1, 2), g('C', 3, 0, 1)], 7),
    inputs(12, [g('A', 5, 2, 3), g('B', 3, 1, 1)], 7),
  ];
  for (const c of cases) {
    for (const r of rowsOf(c)) assert.ok(close(r.withMulligan, r.noMulligan), `turn ${r.turn}: ${r.withMulligan} vs ${r.noMulligan}`);
  }
});

test('both lines equal the brute force on small decks, on the play and on the draw [R10]', () => {
  for (const { label, deck } of SMALL_DECKS) {
    const leastSum = deck.groups.reduce((s, x) => s + x.least, 0);
    const plans = [
      { minHand: 5, free: 0, sizes: [7, 6, 5] },
      { minHand: 4, free: 1, sizes: leastSum === 5 ? [7, 7, 6, 5] : [7, 7, 6, 5, 4] },
    ];
    for (const plan of plans) {
      const want = oracleByTurn(deck, plan.sizes, deck.size - 7);
      for (const onPlay of [true, false]) {
        const rows = byTurn(inputs(deck.size, toGroups(deck), plan.minHand, plan.free, onPlay));
        assert.equal(rows.length, onPlay ? deck.size - 6 : deck.size - 7, `${label}: row count`);
        for (const r of rows) {
          const w = want[r.draws]!;
          const where = `${label}, min ${plan.minHand}, free ${plan.free}, ${onPlay ? 'play' : 'draw'}, turn ${r.turn}`;
          assert.ok(close(r.noMulligan, w.noMulligan.toNumber()), `${where}, no mulligan: ${r.noMulligan} vs ${w.noMulligan.toNumber()}`);
          assert.ok(close(r.withMulligan, w.withMulligan.toNumber()), `${where}, with mulligan: ${r.withMulligan} vs ${w.withMulligan.toNumber()}`);
        }
      }
    }
  }
});

test('draws are turn - 1 on the play and turn on the draw [R9]', () => {
  const play = byTurn(inputs(60, [lands], 5, 0, true, 10));
  assert.deepEqual(play.map((r) => [r.turn, r.draws]), Array.from({ length: 10 }, (_, i) => [i + 1, i]));
  const draw = byTurn(inputs(60, [lands], 5, 0, false, 10));
  assert.deepEqual(draw.map((r) => [r.turn, r.draws]), Array.from({ length: 10 }, (_, i) => [i + 1, i + 1]));
});

test('turns stop where the draws would pass the unseen cards [R9]', () => {
  // A 9-card deck leaves 2 unseen cards after the opening 7.
  assert.deepEqual(byTurn(inputs(9, [g('A', 3, 1)], 5, 0, true)).map((r) => r.draws), [0, 1, 2]);
  assert.deepEqual(byTurn(inputs(9, [g('A', 3, 1)], 5, 0, false)).map((r) => r.draws), [1, 2]);
  assert.deepEqual(byTurn(inputs(7, [g('A', 3, 1)], 5, 0, false)), []);
});

test('reference: 24 lands in 60, least 2, no mulligan, at 0 draws is near 0.857', () => {
  const rows = rowsOf(inputs(60, [lands], 5, 0, true, 3));
  assert.equal(rows[0]!.noMulligan.toFixed(3), '0.857');
});

test('least above copies gives 0 on both lines', () => {
  for (const r of rowsOf(inputs(60, [g('Rare', 2, 3)], 5))) {
    assert.equal(r.noMulligan, 0);
    assert.equal(r.withMulligan, 0);
  }
});

test('zero groups give 1 on both lines', () => {
  for (const r of rowsOf(inputs(60, [], 5))) {
    assert.equal(r.noMulligan, 1);
    assert.equal(r.withMulligan, 1);
  }
});

test('the mulligan line is never below the plain line, even when most limits force mulligans', () => {
  const cases = [
    inputs(60, [g('Lands', 24, 2, 2)], 4),
    inputs(60, [g('Lands', 24, 3, 3), g('Combo', 4, 1, 1)], 4, 1),
    inputs(40, [g('A', 17, 2, 2), g('B', 10, 0, 0)], 3),
    inputs(99, [g('Lands', 37, 3, 3), g('Ramp', 10, 1, 1)], 5, 1, false),
  ];
  for (const c of cases) {
    for (const r of rowsOf(c)) assert.ok(r.withMulligan >= r.noMulligan - 1e-12, `turn ${r.turn}`);
  }
  // The oracle takes the clamped sizes: "least sum 5" stops at 5 cards.
  for (const { label, deck } of SMALL_DECKS) {
    const leastSum = deck.groups.reduce((s, x) => s + x.least, 0);
    const sizes = leastSum === 5 ? [7, 6, 5] : [7, 6, 5, 4];
    for (const r of oracleByTurn(deck, sizes, deck.size - 7)) {
      assert.ok(r.withMulligan.toNumber() >= r.noMulligan.toNumber() - 1e-12, `${label}, oracle, ${r.draws} draws`);
    }
  }
});

test('250 cards, 6 groups, 20 turns: the chain and both lines take under 150 ms [R17]', () => {
  const groups = [g('A', 40, 2, 4), g('B', 30, 1, 3), g('C', 20, 1, 2), g('D', 15, 0, 1), g('E', 10, 1, null), g('F', 8, 0, 2)];
  const run = (deckSize: number): void => {
    const c = inputs(deckSize, groups, 0, 2, false, 20);
    mulliganChain(c);
    byTurn(c);
  };
  run(240);
  // Each timed run uses a new deck size, so the cached binomials of the deck size do not carry over.
  const times: number[] = [];
  for (const n of [250, 249, 248, 247, 246]) {
    const t0 = performance.now();
    run(n);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[2]!;
  console.log(`budget case times (ms): ${times.map((t) => t.toFixed(1)).join(', ')}`);
  assert.ok(median < 150, `median ${median.toFixed(1)} ms`);
});
