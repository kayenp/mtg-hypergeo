import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/core/validate.ts';
import type { Issue } from '../src/core/types.ts';

function base(): Record<string, unknown> {
  return {
    deckSize: 60,
    groups: [
      { name: 'Lands', copies: 24, least: 2, most: 4 },
      { name: 'Combo', copies: 4, least: 1, most: null },
    ],
    minHand: 5,
    freeMulligans: 0,
    onPlay: true,
    maxTurn: 10,
    seed: 1,
    trials: 100000,
  };
}

function errorsOf(raw: unknown): Issue[] {
  const r = validate(raw);
  assert.equal(r.ok, false, 'expected errors');
  return r.ok ? [] : r.errors;
}

function hasIssue(list: Issue[], field: string): boolean {
  return list.some((i) => i.field === field && i.message.length > 0);
}

test('good inputs pass with no warnings and come back unchanged', () => {
  const r = validate(base());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.inputs, base());
    assert.deepEqual(r.warnings, []);
  }
});

test('deck size below 7 is an error on deckSize [R1]', () => {
  assert.ok(hasIssue(errorsOf({ ...base(), deckSize: 6, groups: [] }), 'deckSize'));
});

test('copies that add up to more than the deck is an error on groups [R2]', () => {
  const raw = { ...base(), deckSize: 27 };
  assert.ok(hasIssue(errorsOf(raw), 'groups'));
});

test('most below least is an error on that group most [R2]', () => {
  const raw = base();
  raw.groups = [{ name: 'Lands', copies: 24, least: 3, most: 2 }];
  assert.ok(hasIssue(errorsOf(raw), 'groups.0.most'));
});

test('non-integers and negatives are errors on their fields [R3]', () => {
  assert.ok(hasIssue(errorsOf({ ...base(), deckSize: 60.5 }), 'deckSize'));
  assert.ok(hasIssue(errorsOf({ ...base(), freeMulligans: -1 }), 'freeMulligans'));
  assert.ok(hasIssue(errorsOf({ ...base(), seed: 1.5 }), 'seed'));
  assert.ok(hasIssue(errorsOf({ ...base(), trials: 0 }), 'trials'));
  assert.ok(hasIssue(errorsOf({ ...base(), deckSize: '60' }), 'deckSize'));
  const raw = base();
  raw.groups = [{ name: 'X', copies: -1, least: 0.5, most: -2 }];
  const errs = errorsOf(raw);
  assert.ok(hasIssue(errs, 'groups.0.copies'));
  assert.ok(hasIssue(errs, 'groups.0.least'));
  assert.ok(hasIssue(errs, 'groups.0.most'));
});

test('more than 6 groups is an error on groups [R2]', () => {
  const raw = base();
  raw.groups = Array.from({ length: 7 }, (_, i) => ({ name: `G${i}`, copies: 1, least: 0, most: null }));
  assert.ok(hasIssue(errorsOf(raw), 'groups'));
});

test('minHand outside 0..7 is an error on minHand [R3]', () => {
  assert.ok(hasIssue(errorsOf({ ...base(), minHand: 8 }), 'minHand'));
  assert.ok(hasIssue(errorsOf({ ...base(), minHand: -1 }), 'minHand'));
});

test('maxTurn outside 1..20 is an error on maxTurn [R3]', () => {
  assert.ok(hasIssue(errorsOf({ ...base(), maxTurn: 0 }), 'maxTurn'));
  assert.ok(hasIssue(errorsOf({ ...base(), maxTurn: 21 }), 'maxTurn'));
});

test('free mulligans above 7 is an error on freeMulligans [R3]', () => {
  assert.ok(hasIssue(errorsOf({ ...base(), freeMulligans: 8 }), 'freeMulligans'));
});

test('onPlay must be true or false, and a group name must be text', () => {
  assert.ok(hasIssue(errorsOf({ ...base(), onPlay: 1 }), 'onPlay'));
  const raw = base();
  raw.groups = [{ name: 3, copies: 1, least: 0, most: null }];
  assert.ok(hasIssue(errorsOf(raw), 'groups.0.name'));
});

test('input that is not an object is an error', () => {
  assert.equal(validate(null).ok, false);
  assert.equal(validate(42).ok, false);
  assert.ok(hasIssue(errorsOf({ ...base(), groups: 'x' }), 'groups'));
});

test('least above copies is a warning on that group least, and the inputs still pass [R5]', () => {
  const raw = base();
  raw.groups = [{ name: 'Rare', copies: 2, least: 3, most: null }];
  const r = validate(raw);
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(hasIssue(r.warnings, 'groups.0.least'));
});

test('least counts above minHand is a clamp warning on minHand [R5]', () => {
  const raw = { ...base(), minHand: 2 };
  const r = validate(raw);
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(hasIssue(r.warnings, 'minHand'));
});

test('least counts above 7 is a warning on groups [R5]', () => {
  const raw = base();
  raw.groups = [
    { name: 'A', copies: 20, least: 4, most: null },
    { name: 'B', copies: 20, least: 4, most: null },
  ];
  const r = validate(raw);
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(hasIssue(r.warnings, 'groups'));
});

test('zero groups and a group with 0 copies are fine', () => {
  assert.equal(validate({ ...base(), groups: [] }).ok, true);
  const raw = base();
  raw.groups = [{ name: 'None', copies: 0, least: 0, most: null }];
  const r = validate(raw);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.warnings, []);
});

test('deck size above 1,000 is an error on deckSize [R1]', () => {
  assert.ok(hasIssue(errorsOf({ ...base(), deckSize: 1001 }), 'deckSize'));
  assert.equal(validate({ ...base(), deckSize: 1000 }).ok, true);
});
