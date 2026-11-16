import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { defaultInputs } from '../src/core/defaults.ts';
import { decodeShare, encodeShare } from '../src/core/share.ts';
import type { Inputs, Issue } from '../src/core/types.ts';
import { validate } from '../src/core/validate.ts';
import { mulberry32 } from '../src/core/simulate.ts';

const sample: Inputs = {
  deckSize: 99,
  groups: [
    { name: 'Lands', copies: 37, least: 3, most: 5 },
    { name: 'A.b.c. d&e=f#g%h', copies: 4, least: 1, most: null },
    { name: 'Épée ⚔ 日本語', copies: 2, least: 0, most: 1 },
    { name: '', copies: 1, least: 0, most: null },
  ],
  minHand: 4,
  freeMulligans: 1,
  onPlay: false,
  maxTurn: 15,
  seed: 4242,
  trials: 50000,
};

const fieldsOf = (issues: Issue[]) => issues.map((i) => i.field);
const prefix = '#v=1&n=60&g=24.2.4.Lands&min=5&free=0&otp=1&turns=10&seed=1&trials=100000';

test('encode then decode gives the same inputs, with no issues [R15]', () => {
  const d = decodeShare(encodeShare(sample));
  assert.deepEqual(d.issues, []);
  assert.deepEqual(d.raw, sample);
});

test('the encoded link matches the version 1 format', () => {
  const link = encodeShare({ ...defaultInputs(), groups: [{ name: 'Combo A', copies: 4, least: 1, most: null }] });
  assert.equal(link, '#v=1&n=60&g=4.1..Combo%20A&min=5&free=0&otp=1&turns=10&seed=1&trials=100000');
});

test('the decoder takes the fragment with or without the leading #', () => {
  assert.deepEqual(decodeShare(prefix.slice(1)), decodeShare(prefix));
  assert.deepEqual(decodeShare(prefix).issues, []);
});

test('an empty fragment or one with no v gives the defaults and no issue', () => {
  for (const h of ['', '#', '#n=40', 'hello']) {
    const d = decodeShare(h);
    assert.deepEqual(d.raw, defaultInputs(), h);
    assert.deepEqual(d.issues, [], h);
  }
});

test('a newer version gives the defaults and a newer-version issue', () => {
  const d = decodeShare('#v=2&n=40');
  assert.deepEqual(d.raw, defaultInputs());
  assert.equal(d.issues.length, 1);
  assert.match(d.issues[0]!.message, /newer version/);
});

test('a version that does not parse gives the defaults and an issue', () => {
  const d = decodeShare('#v=x&n=40');
  assert.deepEqual(d.raw, defaultInputs());
  assert.equal(d.issues.length, 1);
});

test('each bad scalar field falls back to its default and names the field [R15]', () => {
  const cases: [string, string, keyof Inputs][] = [
    ['n', 'abc', 'deckSize'],
    ['n', '-5', 'deckSize'],
    ['n', '1e3', 'deckSize'],
    ['min', '', 'minHand'],
    ['free', '2.5', 'freeMulligans'],
    ['otp', 'yes', 'onPlay'],
    ['turns', '0x10', 'maxTurn'],
    ['seed', '%zz', 'seed'],
    ['trials', '99999999999999999999', 'trials'],
  ];
  for (const [key, value, field] of cases) {
    const hash = prefix.replace(new RegExp(`([#&])${key}=[^&]*`), `$1${key}=${value}`);
    const d = decodeShare(hash);
    assert.deepEqual(fieldsOf(d.issues), [field], `${key}=${value}`);
    assert.deepEqual(d.raw[field], defaultInputs()[field], `${key}=${value}`);
  }
});

test('a missing scalar field falls back to its default and names the field', () => {
  const d = decodeShare('#v=1&n=40&g=24.2.4.Lands&otp=0&turns=10&seed=1&trials=100000');
  assert.deepEqual(fieldsOf(d.issues).sort(), ['freeMulligans', 'minHand']);
  assert.equal(d.raw.minHand, defaultInputs().minHand);
  assert.equal(d.raw.deckSize, 40);
  assert.equal(d.raw.onPlay, false);
});

test('a bad group is left out and named', () => {
  for (const g of ['x.2.4.Lands', '24.2', '24.2.y.Lands', '24.2.4.%E0%A4%A']) {
    const d = decodeShare(`#v=1&n=60&g=4.1..Good&g=${g}&min=5&free=0&otp=1&turns=10&seed=1&trials=100000`);
    assert.deepEqual(fieldsOf(d.issues), ['groups.1'], g);
    assert.deepEqual(d.raw.groups, [{ name: 'Good', copies: 4, least: 1, most: null }], g);
  }
});

test('more than 6 groups keeps the first 6 and adds an issue', () => {
  const gs = Array.from({ length: 8 }, (_, i) => `g=1.0..G${i}`).join('&');
  const d = decodeShare(`#v=1&n=60&${gs}&min=5&free=0&otp=1&turns=10&seed=1&trials=100000`);
  assert.equal(d.raw.groups.length, 6);
  assert.deepEqual(fieldsOf(d.issues), ['groups']);
});

test('a name over 40 characters is cut to 40 with an issue', () => {
  const d = decodeShare(`#v=1&n=60&g=4.1..${'x'.repeat(50)}&min=5&free=0&otp=1&turns=10&seed=1&trials=100000`);
  assert.equal(d.raw.groups[0]!.name, 'x'.repeat(40));
  assert.deepEqual(fieldsOf(d.issues), ['groups.0.name']);
});

test('a fragment over 2,000 characters gives the defaults and an issue', () => {
  const d = decodeShare(`${prefix}&pad=${'a'.repeat(2000)}`);
  assert.deepEqual(d.raw, defaultInputs());
  assert.equal(d.issues.length, 1);
});

test('a name with HTML in it survives as plain text data [R20]', () => {
  const name = '<img src=x onerror=alert(1)>';
  const d = decodeShare(encodeShare({ ...defaultInputs(), groups: [{ name, copies: 4, least: 1, most: null }] }));
  assert.equal(d.raw.groups[0]!.name, name);
  assert.deepEqual(d.issues, []);
});

test('a name with a lone surrogate encodes without throwing', () => {
  const link = encodeShare({ ...defaultInputs(), groups: [{ name: 'a\uD800b', copies: 4, least: 1, most: null }] });
  assert.equal(decodeShare(link).raw.groups[0]!.name, 'a�b');
});

test('decodeShare never throws, and its output never makes validate throw [R19]', () => {
  const rand = mulberry32(2026);
  const alphabet = ['v', '=', '1', '2', '&', 'g', '.', '%', 'E', '0', 'n', 'min', 'otp', 'trials', '#', 'é', '\uD800', '-', '9', ' '];
  // A third of the strings start inside a group value, so the group parser sees broken names too.
  for (let i = 0; i < 3000; i++) {
    let s = ['#v=1&', '', '#v=1&g=1.0..'][i % 3]!;
    const len = Math.floor(rand() * 60);
    for (let k = 0; k < len; k++) s += alphabet[Math.floor(rand() * alphabet.length)];
    const d = decodeShare(s);
    assert.ok(Array.isArray(d.issues));
    validate(d.raw);
  }
});

test('the example link in docs/interface.md decodes with no issues [R15]', () => {
  const doc = readFileSync(new URL('../docs/interface.md', import.meta.url), 'utf8');
  const example = /## Example\s+```\s*\n(#v=[^\n]+)\n```/.exec(doc);
  assert.ok(example, 'no example link under "## Example"');
  const d = decodeShare(example[1]!);
  assert.deepEqual(d.issues, []);
  assert.equal(encodeShare(d.raw), example[1]);
});
