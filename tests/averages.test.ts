import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageCopies, byTurn } from '../src/core/byTurn.ts';
import type { Group, Inputs } from '../src/core/types.ts';
import { SMALL_DECKS, close, toGroups } from './decks.ts';
import { oracleAverageCopies } from './oracle.ts';

const g = (name: string, copies: number, least = 0, most: number | null = null): Group => ({ name, copies, least, most });

function inputs(over: Partial<Inputs>): Inputs {
  return { deckSize: 60, groups: [g('Lands', 24, 2, 4)], minHand: 5, freeMulligans: 0, onPlay: true, maxTurn: 10, seed: 1, trials: 1000, ...over };
}

function rowsOf(c: Inputs) {
  const rows = averageCopies(c);
  assert.ok(rows.length > 0, 'no rows');
  return rows;
}

test('24 lands in 60 on the play: 2.80 at turn 1 and 4.00 at turn 4 [R21]', () => {
  const rows = rowsOf(inputs({}));
  assert.equal(rows[0]!.copies[0]!.toFixed(2), '2.80');
  assert.equal(rows[3]!.copies[0]!.toFixed(2), '4.00');
});

test('24 lands in 60 on the draw: 3.20 at turn 1 [R21]', () => {
  assert.equal(rowsOf(inputs({ onPlay: false }))[0]!.copies[0]!.toFixed(2), '3.20');
});

test('a group with 0 copies averages 0 on every turn [R21]', () => {
  for (const r of rowsOf(inputs({ groups: [g('Lands', 24), g('None', 0)] }))) assert.equal(r.copies[1], 0);
});

test('the turns and draws match the odds rows, cap included [R21]', () => {
  for (const c of [inputs({}), inputs({ onPlay: false }), inputs({ deckSize: 9, groups: [g('A', 3, 1)] })]) {
    assert.deepEqual(
      rowsOf(c).map((r) => [r.turn, r.draws]),
      byTurn(c).map((r) => [r.turn, r.draws]),
    );
  }
});

test('the average equals the brute-force average over every card subset [R21]', () => {
  for (const { label, deck } of SMALL_DECKS) {
    const rows = averageCopies({ ...inputs({}), deckSize: deck.size, groups: toGroups(deck), maxTurn: 20 });
    assert.equal(rows.length, deck.size - 6, label);
    for (const r of rows) {
      const want = oracleAverageCopies(deck, r.draws);
      assert.equal(r.copies.length, deck.groups.length, label);
      r.copies.forEach((v, i) => assert.ok(close(v, want[i]!.toNumber()), `${label}, ${r.draws} draws, group ${i}: ${v} vs ${want[i]!.toNumber()}`));
    }
  }
});
