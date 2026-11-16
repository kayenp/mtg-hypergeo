import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byTurn } from '../src/core/byTurn.ts';
import { mulliganChain } from '../src/core/mulligan.ts';
import { compare, createSimulation, mulberry32 } from '../src/core/simulate.ts';
import type { Group, Inputs } from '../src/core/types.ts';

const g = (name: string, copies: number, least: number, most: number | null = null): Group => ({ name, copies, least, most });

function inputs(over: Partial<Inputs>): Inputs {
  return {
    deckSize: 60,
    groups: [g('Lands', 24, 2, 4), g('Key card', 4, 1)],
    minHand: 5,
    freeMulligans: 0,
    onPlay: true,
    maxTurn: 10,
    seed: 1,
    trials: 100000,
    ...over,
  };
}

function simulate(c: Inputs, trials: number, part = trials) {
  const sim = createSimulation({ ...c, trials });
  // A cap on the loop, so a run that never sets `done` fails instead of hanging.
  for (let i = 0; !sim.done && i <= trials; i++) sim.run(part);
  assert.equal(sim.done, true, 'the simulation never finished');
  return sim.result();
}

/** Every exact number and its estimate, with a label for the message. */
function pairs(c: Inputs, trials: number): { label: string; exact: number; estimate: number }[] {
  const est = simulate(c, trials);
  const chain = mulliganChain(c);
  const rows = byTurn(c);
  assert.equal(est.trials, trials);
  assert.equal(est.keep.length, chain.steps.length, 'keep length');
  assert.equal(est.withMulligan.length, rows.length, 'turn rows');
  const out = chain.steps.map((s, m) => ({ label: `keep at ${m}`, exact: s.pKeep, estimate: est.keep[m]! }));
  out.push({ label: 'fail', exact: chain.pFail, estimate: est.fail });
  rows.forEach((r, i) => {
    assert.deepEqual(est.turns[i], { turn: r.turn, draws: r.draws });
    out.push({ label: `with, turn ${r.turn}`, exact: r.withMulligan, estimate: est.withMulligan[i]! });
    out.push({ label: `no, turn ${r.turn}`, exact: r.noMulligan, estimate: est.noMulligan[i]! });
  });
  return out;
}

test('a seeded run agrees with the engine inside 4 standard errors on every number [R11]', () => {
  const cases: { label: string; c: Inputs }[] = [
    { label: 'default deck', c: inputs({}) },
    {
      label: 'most limits, clamp, free mulligan, on the draw',
      c: inputs({
        groups: [g('Lands', 24, 3, 3), g('Combo', 8, 2, 2)],
        minHand: 2,
        freeMulligans: 1,
        onPlay: false,
        seed: 7,
      }),
    },
    {
      label: '40 cards, three groups, mixed limits',
      c: inputs({ deckSize: 40, groups: [g('A', 17, 2, 4), g('B', 6, 1, 2), g('C', 3, 0, 1)], minHand: 4, seed: 99 }),
    },
  ];
  for (const { label, c } of cases) {
    for (const p of pairs(c, 40000)) {
      const r = compare(p.exact, p.estimate, 40000);
      assert.ok(r.within, `${label}, ${p.label}: exact ${p.exact}, simulated ${p.estimate}, se ${r.se}`);
    }
  }
});

test('the same seed gives the same result for any split into parts [R11]', () => {
  const c = inputs({ freeMulligans: 1, onPlay: false });
  const whole = simulate(c, 5000);
  assert.deepEqual(simulate(c, 5000, 777), whole);
  assert.deepEqual(simulate(c, 5000, 1), whole);
});

test('a different seed gives a different result', () => {
  assert.notDeepEqual(simulate(inputs({ seed: 1 }), 2000), simulate(inputs({ seed: 2 }), 2000));
});

test('run stops at the trial count, and done turns true', () => {
  const sim = createSimulation(inputs({ trials: 1000 }));
  sim.run(600);
  assert.equal(sim.done, false);
  assert.equal(sim.completed, 600);
  sim.run(600);
  assert.equal(sim.done, true);
  assert.equal(sim.completed, 1000);
});

test('mulberry32 gives floats in [0, 1) and repeats for a seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(Array.from({ length: 1000 }, () => b()), xs);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.ok(new Set(xs).size > 990);
});

test('compare: the standard error comes from the exact p', () => {
  const r = compare(0.5, 0.5, 10000);
  assert.ok(Math.abs(r.se - 0.005) < 1e-15);
  assert.equal(r.within, true);
  assert.equal(compare(0.5, 0.5 + 0.0199, 10000).within, true);
  assert.equal(compare(0.5, 0.5 + 0.0201, 10000).within, false);
});

test('compare: an exact 0 or 1 needs an exact match [R11]', () => {
  assert.equal(compare(0, 0, 100).within, true);
  assert.equal(compare(1, 1, 100).within, true);
  assert.equal(compare(0, 0.00001, 100).within, false);
  assert.equal(compare(1, 0.99999, 100).within, false);
});

test('a wrong exact value is flagged', () => {
  const c = inputs({});
  const est = simulate(c, 20000);
  const right = mulliganChain(c).steps[0]!.pKeep;
  assert.equal(compare(right, est.keep[0]!, 20000).within, true);
  assert.equal(compare(right + 0.02, est.keep[0]!, 20000).within, false);
});

test('100,000 trials of the default deck take under 2 s [R18]', () => {
  simulate(inputs({ seed: 3 }), 5000);
  const times: number[] = [];
  for (const seed of [11, 12, 13]) {
    const t0 = performance.now();
    simulate(inputs({ seed }), 100000, 5000);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  console.log(`simulation times for 100,000 trials (ms): ${times.map((t) => t.toFixed(0)).join(', ')}`);
  assert.ok(times[1]! < 2000, `median ${times[1]!.toFixed(0)} ms`);
});
