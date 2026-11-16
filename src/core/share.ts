import { defaultInputs } from './defaults.ts';
import type { Group, Inputs, Issue } from './types.ts';

export interface Decoded {
  /** Values for `validate`, with defaults in place of bad or missing fields. */
  raw: Inputs;
  issues: Issue[];
}

export const SHARE_VERSION = 1;
export const MAX_FRAGMENT = 2000;
export const MAX_LINK_GROUPS = 6;
export const MAX_NAME = 40;

type Scalar = 'deckSize' | 'minHand' | 'freeMulligans' | 'maxTurn' | 'seed' | 'trials';

/** Link key, input field, and the words a message uses for the field. */
const SCALARS: [string, Scalar, string][] = [
  ['n', 'deckSize', 'deck size'],
  ['min', 'minHand', 'smallest hand'],
  ['free', 'freeMulligans', 'free mulligans'],
  ['turns', 'maxTurn', 'turns to show'],
  ['seed', 'seed', 'seed'],
  ['trials', 'trials', 'trials'],
];

// Nine digits at most, so each value stays a safe integer. validate checks the ranges.
const DIGITS = /^\d{1,9}$/;

/** encodeURIComponent throws on a lone surrogate, so replace each one first. */
function wellFormed(s: string): string {
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');
}

/** The address fragment, with its leading #, for these inputs. */
export function encodeShare(inputs: Inputs): string {
  const parts = [`v=${SHARE_VERSION}`, `n=${inputs.deckSize}`];
  for (const g of inputs.groups) {
    parts.push(`g=${g.copies}.${g.least}.${g.most ?? ''}.${encodeURIComponent(wellFormed(g.name))}`);
  }
  parts.push(
    `min=${inputs.minHand}`,
    `free=${inputs.freeMulligans}`,
    `otp=${inputs.onPlay ? 1 : 0}`,
    `turns=${inputs.maxTurn}`,
    `seed=${inputs.seed}`,
    `trials=${inputs.trials}`,
  );
  return `#${parts.join('&')}`;
}

/** Splits on the first three dots only, because a name may hold dots. */
function parseGroup(value: string): Group | null {
  const a = value.indexOf('.');
  const b = a < 0 ? -1 : value.indexOf('.', a + 1);
  const c = b < 0 ? -1 : value.indexOf('.', b + 1);
  if (c < 0) return null;
  const copies = value.slice(0, a);
  const least = value.slice(a + 1, b);
  const most = value.slice(b + 1, c);
  if (!DIGITS.test(copies) || !DIGITS.test(least) || (most !== '' && !DIGITS.test(most))) return null;
  let name: string;
  try {
    name = decodeURIComponent(value.slice(c + 1));
  } catch {
    return null;
  }
  return { name, copies: Number(copies), least: Number(least), most: most === '' ? null : Number(most) };
}

/**
 * Reads a fragment such as "#v=1&n=60&g=24.2.4.Lands&min=5&...". It never throws.
 * A bad or missing field falls back to its default, with an issue that names the field.
 */
export function decodeShare(hash: string): Decoded {
  const raw = defaultInputs();
  const issues: Issue[] = [];
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (text.length > MAX_FRAGMENT) {
    return { raw, issues: [{ field: 'link', message: 'The link is too long. The page shows the default deck.' }] };
  }

  const values = new Map<string, string>();
  const groupValues: string[] = [];
  for (const part of text.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 'g') groupValues.push(value);
    else if (!values.has(key)) values.set(key, value);
  }

  const v = values.get('v');
  if (v === undefined) return { raw, issues };
  if (v !== String(SHARE_VERSION)) {
    const message =
      DIGITS.test(v) && Number(v) > SHARE_VERSION
        ? 'This link was made by a newer version of the page. The page shows the default deck.'
        : 'The link version is not valid. The page shows the default deck.';
    return { raw, issues: [{ field: 'link', message }] };
  }

  for (const [key, field, words] of SCALARS) {
    const value = values.get(key);
    if (value !== undefined && DIGITS.test(value)) raw[field] = Number(value);
    else issues.push({ field, message: `The link has no good value for ${words}. The page uses ${raw[field]}.` });
  }
  const otp = values.get('otp');
  if (otp === '1' || otp === '0') raw.onPlay = otp === '1';
  else issues.push({ field: 'onPlay', message: 'The link does not say on the play or on the draw. The page uses on the play.' });

  if (groupValues.length > MAX_LINK_GROUPS) {
    issues.push({ field: 'groups', message: `The link has more than ${MAX_LINK_GROUPS} groups. The page keeps the first ${MAX_LINK_GROUPS}.` });
  }
  raw.groups = [];
  groupValues.slice(0, MAX_LINK_GROUPS).forEach((value, i) => {
    const group = parseGroup(value);
    if (group === null) {
      issues.push({ field: `groups.${i}`, message: `Group ${i + 1} in the link is not valid, so the page leaves it out.` });
      return;
    }
    const chars = Array.from(group.name);
    if (chars.length > MAX_NAME) {
      group.name = chars.slice(0, MAX_NAME).join('');
      issues.push({ field: `groups.${raw.groups.length}.name`, message: `The name was cut to ${MAX_NAME} characters.` });
    }
    raw.groups.push(group);
  });
  return { raw, issues };
}
