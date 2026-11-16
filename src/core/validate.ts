import type { Group, Inputs, Issue } from './types.ts';

export type Validation = { ok: true; inputs: Inputs; warnings: Issue[] } | { ok: false; errors: Issue[] };

export const MAX_GROUPS = 6;
// The simulation holds the whole deck in memory, so a link must not ask for a huge one.
export const MAX_DECK = 1000;
export const MAX_TURN = 20;
// The plan sets no limit. A cap keeps the chain short; Commander needs only 1.
export const MAX_FREE_MULLIGANS = 7;
export const MAX_TRIALS = 1_000_000;
export const MAX_SEED = 0xffff_ffff;

type Rec = Record<string, unknown>;

const isRec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Checks raw inputs. Numbers must already be numbers; the page parses its text fields first.
 * Errors stop the result. Warnings let the result show, with a note next to the field.
 */
export function validate(raw: unknown): Validation {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  if (!isRec(raw)) return { ok: false, errors: [{ field: '', message: 'The inputs are missing.' }] };

  const whole = (field: string, value: unknown, min: number, max: number): number | null => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors.push({ field, message: 'Enter a whole number.' });
      return null;
    }
    if (value < min || value > max) {
      errors.push({
        field,
        message: max === Infinity ? `Enter ${min} or more.` : `Enter a number from ${min} to ${max}.`,
      });
      return null;
    }
    return value;
  };

  const deckSize = whole('deckSize', raw.deckSize, 7, MAX_DECK);
  const minHand = whole('minHand', raw.minHand, 0, 7);
  const freeMulligans = whole('freeMulligans', raw.freeMulligans, 0, MAX_FREE_MULLIGANS);
  const maxTurn = whole('maxTurn', raw.maxTurn, 1, MAX_TURN);
  const seed = whole('seed', raw.seed, 0, MAX_SEED);
  const trials = whole('trials', raw.trials, 1, MAX_TRIALS);
  if (typeof raw.onPlay !== 'boolean') errors.push({ field: 'onPlay', message: 'Choose on the play or on the draw.' });

  const groups: Group[] = [];
  if (!Array.isArray(raw.groups)) {
    errors.push({ field: 'groups', message: 'The card groups are missing.' });
  } else if (raw.groups.length > MAX_GROUPS) {
    errors.push({ field: 'groups', message: `Use ${MAX_GROUPS} groups or fewer.` });
  } else {
    raw.groups.forEach((g: unknown, i: number) => {
      const at = `groups.${i}`;
      if (!isRec(g)) {
        errors.push({ field: at, message: 'This group is not valid.' });
        return;
      }
      if (typeof g.name !== 'string') errors.push({ field: `${at}.name`, message: 'Enter a name.' });
      const copies = whole(`${at}.copies`, g.copies, 0, Infinity);
      const least = whole(`${at}.least`, g.least, 0, Infinity);
      let most: number | null = null;
      if (g.most !== null) {
        most = whole(`${at}.most`, g.most, 0, Infinity);
        if (most === null) return;
      }
      if (copies === null || least === null || typeof g.name !== 'string') return;
      if (most !== null && most < least) {
        errors.push({ field: `${at}.most`, message: 'The most count must be at least the least count.' });
        return;
      }
      groups.push({ name: g.name, copies, least, most });
    });
  }

  if (errors.length === 0 && deckSize !== null) {
    const copies = groups.reduce((s, g) => s + g.copies, 0);
    if (copies > deckSize) {
      errors.push({ field: 'groups', message: `The groups hold ${copies} cards, but the deck has only ${deckSize}.` });
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  groups.forEach((g, i) => {
    if (g.least > g.copies) {
      warnings.push({
        field: `groups.${i}.least`,
        message: `The deck has only ${g.copies} of this group, so the goal can never be met. The result is 0%.`,
      });
    }
  });
  const leastSum = groups.reduce((s, g) => s + g.least, 0);
  if (leastSum > 7) {
    warnings.push({
      field: 'groups',
      message: `The least counts add up to ${leastSum}, more than a 7-card hand. No opening hand can meet the goal.`,
    });
  } else if (leastSum > minHand!) {
    warnings.push({
      field: 'minHand',
      message: `The least counts add up to ${leastSum}, so mulligans stop at ${leastSum} cards, not ${minHand}.`,
    });
  }

  return {
    ok: true,
    inputs: {
      deckSize: deckSize!,
      groups,
      minHand: minHand!,
      freeMulligans: freeMulligans!,
      onPlay: raw.onPlay as boolean,
      maxTurn: maxTurn!,
      seed: seed!,
      trials: trials!,
    },
    warnings,
  };
}
