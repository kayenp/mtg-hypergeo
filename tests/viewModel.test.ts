import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byTurn } from '../src/core/byTurn.ts';
import { defaultInputs } from '../src/core/defaults.ts';
import { mulliganChain } from '../src/core/mulligan.ts';
import { encodeShare } from '../src/core/share.ts';
import type { SimResult } from '../src/core/simulate.ts';
import type { Inputs } from '../src/core/types.ts';
import { validate } from '../src/core/validate.ts';
import { buildView, defaultForm, formFromInputs, parseForm, simulationView, type FormState } from '../src/core/viewModel.ts';

const oneGroup = (): FormState => ({
  ...defaultForm(),
  groups: [{ name: 'Combo', copies: '4', least: '1', most: '' }],
});

test('4 copies in 60, at least 1: the first row says this draw works 39.95% of the time [R6]', () => {
  const view = buildView(oneGroup());
  assert.ok(view.results, 'no results');
  assert.equal(view.results.opening[0]!.works, '39.95%');
  assert.equal(view.results.opening[0]!.mulligans, '0');
  assert.equal(view.results.opening[0]!.handSize, '7');
});

test('the default form is the default deck', () => {
  assert.deepEqual(parseForm(defaultForm()), defaultInputs());
  const form = defaultForm();
  assert.deepEqual(form.groups.map((g) => g.name), ['Lands', 'Key card']);
  assert.equal(form.groups[1]!.most, '');
});

test('opening rows: keep here, kept so far, and the fail chance match the chain [R7]', () => {
  const view = buildView(defaultForm());
  const chain = mulliganChain(defaultInputs());
  assert.ok(view.results);
  assert.equal(view.results.opening.length, chain.steps.length);
  let total = 0;
  chain.steps.forEach((s, m) => {
    total += s.pKeep;
    const row = view.results!.opening[m]!;
    assert.equal(row.keepHere, `${(s.pKeep * 100).toFixed(2)}%`);
    assert.equal(row.keptSoFar, `${(total * 100).toFixed(2)}%`);
  });
  assert.equal(view.results.fail, `${(chain.pFail * 100).toFixed(2)}%`);
});

test('by-turn rows and chart data match the engine', () => {
  const view = buildView({ ...defaultForm(), onPlay: false });
  const rows = byTurn({ ...defaultInputs(), onPlay: false });
  assert.ok(view.results);
  assert.equal(view.results.turns.length, rows.length);
  assert.deepEqual(view.results.turns[0], {
    turn: '1',
    draws: '1',
    withMulligan: `${(rows[0]!.withMulligan * 100).toFixed(2)}%`,
    noMulligan: `${(rows[0]!.noMulligan * 100).toFixed(2)}%`,
  });
  assert.deepEqual(view.results.chart, rows.map((r) => ({ turn: r.turn, withMulligan: r.withMulligan, noMulligan: r.noMulligan })));
});

test('bad text gives an error on its field and no results [R4]', () => {
  const view = buildView({ ...defaultForm(), deckSize: 'abc' });
  assert.equal(view.results, null);
  assert.ok((view.errors.deckSize ?? []).length > 0);
});

test('an empty most means no limit, and bad most text is an error on that field', () => {
  assert.equal((parseForm(oneGroup()) as Inputs).groups?.[0]?.most, null);
  const bad = buildView({ ...defaultForm(), groups: [{ name: 'A', copies: '4', least: '1', most: 'x' }] });
  assert.equal(bad.results, null);
  assert.ok((bad.errors['groups.0.most'] ?? []).length > 0);
});

test('spaces around numbers are fine; decimals are errors', () => {
  assert.ok(buildView({ ...defaultForm(), deckSize: ' 60 ' }).results);
  assert.ok(buildView({ ...defaultForm(), deckSize: '60.5' }).errors.deckSize);
});

test('a warning sits on its field and the results still show [R5]', () => {
  const view = buildView({ ...defaultForm(), groups: [{ name: 'Rare', copies: '2', least: '3', most: '' }] });
  assert.ok(view.results);
  assert.ok((view.warnings['groups.0.least'] ?? []).length > 0);
  assert.equal(view.results.opening[0]!.works, '0.00%');
});

test('the clamp shows a note with both sizes [R8]', () => {
  const view = buildView({
    ...defaultForm(),
    minHand: '2',
    groups: [
      { name: 'A', copies: '20', least: '3', most: '' },
      { name: 'B', copies: '20', least: '2', most: '' },
    ],
  });
  assert.ok(view.results);
  const text = view.results.notes.map((n) => n.text).join(' ');
  assert.match(text, /stop at 5 cards/);
  assert.match(text, /not 2/);
});

test('least counts above 7 show a warning note', () => {
  const view = buildView({
    ...defaultForm(),
    groups: [
      { name: 'A', copies: '20', least: '4', most: '' },
      { name: 'B', copies: '20', least: '4', most: '' },
    ],
  });
  assert.ok(view.results);
  assert.ok(view.results.notes.some((n) => n.kind === 'warning' && /more than 7/.test(n.text)));
});

test('the by-turn note and the model note are always there [R14]', () => {
  const view = buildView(defaultForm());
  assert.ok(view.results);
  const text = view.results.notes.map((n) => n.text).join(' ');
  assert.match(text, /most counts apply to the opening hand only/);
  assert.match(text, /turn 1 on the play/);
  assert.match(text, /exact for this keep rule only/);
  assert.match(text, /matchup/);
});

test('the goal line names each group as given, HTML and all [R20]', () => {
  const name = '<img src=x onerror=alert(1)>';
  const view = buildView({
    ...defaultForm(),
    groups: [
      { name: 'Lands', copies: '24', least: '2', most: '4' },
      { name, copies: '4', least: '1', most: '' },
      { name: 'Wraths', copies: '3', least: '0', most: '1' },
      { name: 'Ramp', copies: '6', least: '2', most: '2' },
    ],
  });
  assert.ok(view.results);
  assert.equal(
    view.results.goal,
    `You keep a hand with at least 2 and at most 4 Lands; at least 1 ${name}; at most 1 Wraths; exactly 2 Ramp.`,
  );
  assert.equal(buildView({ ...defaultForm(), groups: [] }).results!.goal, 'You have no groups, so you keep any hand.');
});

test('the share link is the encoded inputs', () => {
  const view = buildView(defaultForm());
  assert.ok(view.results, 'no results');
  assert.equal(view.results.share, encodeShare(defaultInputs()));
});

test('formFromInputs then parseForm gives the same inputs', () => {
  const inputs: Inputs = { ...defaultInputs(), groups: [{ name: 'a.b', copies: 3, least: 0, most: null }], onPlay: false, seed: 9 };
  assert.deepEqual(parseForm(formFromInputs(inputs)), inputs);
  const v = validate(parseForm(formFromInputs(inputs)));
  assert.equal(v.ok, true);
});

test('simulationView: one row per number, verdicts, and an overall line', () => {
  const inputs = defaultInputs();
  const chain = mulliganChain(inputs);
  const rows = byTurn(inputs);
  const exactResult: SimResult = {
    trials: 100000,
    keep: chain.steps.map((s) => s.pKeep),
    fail: chain.pFail,
    turns: rows.map((r) => ({ turn: r.turn, draws: r.draws })),
    withMulligan: rows.map((r) => r.withMulligan),
    noMulligan: rows.map((r) => r.noMulligan),
  };
  const good = simulationView(inputs, exactResult);
  assert.equal(good.rows.length, chain.steps.length + 1 + 2 * rows.length);
  assert.ok(good.rows.every((r) => r.verdict === 'agrees'));
  assert.equal(good.allAgree, true);
  assert.match(good.overall, /All \d+ numbers agree/);
  assert.equal(good.rows[0]!.label, 'Keep after 0 mulligans');

  const off = simulationView(inputs, { ...exactResult, fail: exactResult.fail + 0.05 });
  assert.equal(off.allAgree, false);
  assert.equal(off.rows.filter((r) => r.verdict === 'check this').length, 1);
  assert.match(off.overall, /1 of \d+ numbers/);
});
