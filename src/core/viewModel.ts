import { byTurn } from './byTurn.ts';
import type { ChartRow } from './chart.ts';
import { defaultInputs } from './defaults.ts';
import { formatPercent } from './format.ts';
import { mulliganChain } from './mulligan.ts';
import { encodeShare } from './share.ts';
import { compare, type SimResult } from './simulate.ts';
import type { Group, Inputs, Issue } from './types.ts';
import { validate } from './validate.ts';

export interface GroupForm {
  name: string;
  copies: string;
  least: string;
  most: string;
}

/** The form as typed. Numbers stay text until parseForm. */
export interface FormState {
  deckSize: string;
  groups: GroupForm[];
  minHand: string;
  freeMulligans: string;
  onPlay: boolean;
  maxTurn: string;
  seed: string;
  trials: string;
}

export interface OpeningRow {
  mulligans: string;
  handSize: string;
  works: string;
  keepHere: string;
  keptSoFar: string;
}

export interface TurnViewRow {
  turn: string;
  draws: string;
  withMulligan: string;
  noMulligan: string;
}

export interface Note {
  kind: 'info' | 'warning';
  text: string;
}

export interface Results {
  goal: string;
  opening: OpeningRow[];
  fail: string;
  turns: TurnViewRow[];
  chart: ChartRow[];
  notes: Note[];
  inputs: Inputs;
  share: string;
}

export interface View {
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  results: Results | null;
}

export interface SimRow {
  label: string;
  exact: string;
  simulated: string;
  se: string;
  verdict: 'agrees' | 'check this';
}

export interface SimView {
  trials: string;
  rows: SimRow[];
  allAgree: boolean;
  overall: string;
}

export const NOTE_BY_TURN =
  'By turn, the page counts your hand plus the cards you draw. It asks for at least the least count of each group. ' +
  'The most counts apply to the opening hand only. So turn 1 on the play is not the same number as the opening hand table.';

export const NOTE_LINES =
  'With mulligans: you mulligan by the rule above, then draw. No mulligan: you keep any 7 cards, then draw.';

export const NOTE_MODEL =
  'These numbers are exact for this keep rule only. A real keep also depends on the matchup, your curve and the exact cards.';

export function formFromInputs(inputs: Inputs): FormState {
  return {
    deckSize: String(inputs.deckSize),
    groups: inputs.groups.map((g) => ({
      name: g.name,
      copies: String(g.copies),
      least: String(g.least),
      most: g.most === null ? '' : String(g.most),
    })),
    minHand: String(inputs.minHand),
    freeMulligans: String(inputs.freeMulligans),
    onPlay: inputs.onPlay,
    maxTurn: String(inputs.maxTurn),
    seed: String(inputs.seed),
    trials: String(inputs.trials),
  };
}

export function defaultForm(): FormState {
  return formFromInputs(defaultInputs());
}

/** Text to a number. Text that is not a plain number gives NaN, which validate reports as an error. */
function num(text: string): number {
  const t = text.trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** The raw inputs for validate. An empty most means no limit. */
export function parseForm(form: FormState): unknown {
  return {
    deckSize: num(form.deckSize),
    groups: form.groups.map((g) => ({
      name: g.name,
      copies: num(g.copies),
      least: num(g.least),
      most: g.most.trim() === '' ? null : num(g.most),
    })),
    minHand: num(form.minHand),
    freeMulligans: num(form.freeMulligans),
    onPlay: form.onPlay,
    maxTurn: num(form.maxTurn),
    seed: num(form.seed),
    trials: num(form.trials),
  };
}

function byField(issues: Issue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of issues) (out[i.field] ??= []).push(i.message);
  return out;
}

function goalPart(g: Group): string {
  if (g.most !== null && g.least === g.most) return `exactly ${g.least} ${g.name}`;
  if (g.most === null) return `at least ${g.least} ${g.name}`;
  if (g.least === 0) return `at most ${g.most} ${g.name}`;
  return `at least ${g.least} and at most ${g.most} ${g.name}`;
}

function goalText(groups: readonly Group[]): string {
  if (groups.length === 0) return 'You have no groups, so you keep any hand.';
  return `You keep a hand with ${groups.map(goalPart).join('; ')}.`;
}

export function buildView(form: FormState): View {
  const checked = validate(parseForm(form));
  if (!checked.ok) return { errors: byField(checked.errors), warnings: {}, results: null };
  const inputs = checked.inputs;
  const chain = mulliganChain(inputs);
  const rows = byTurn(inputs);

  let total = 0;
  const opening = chain.steps.map((s) => {
    total += s.pKeep;
    return {
      mulligans: String(s.mulligans),
      handSize: String(s.handSize),
      works: formatPercent(s.q),
      keepHere: formatPercent(s.pKeep),
      keptSoFar: formatPercent(total),
    };
  });

  const notes: Note[] = [];
  if (chain.impossible) {
    const sum = inputs.groups.reduce((s, g) => s + g.least, 0);
    notes.push({
      kind: 'warning',
      text: `Your least counts add up to ${sum}, which is more than 7 cards. No opening hand can meet the goal.`,
    });
  } else if (chain.clamp) {
    notes.push({
      kind: 'info',
      text: `Your least counts add up to ${chain.clamp.effective}. A smaller hand cannot hold them, so mulligans stop at ${chain.clamp.effective} cards, not ${chain.clamp.requested}.`,
    });
  }
  notes.push({ kind: 'info', text: NOTE_BY_TURN }, { kind: 'info', text: NOTE_LINES }, { kind: 'info', text: NOTE_MODEL });

  return {
    errors: {},
    warnings: byField(checked.warnings),
    results: {
      goal: goalText(inputs.groups),
      opening,
      fail: formatPercent(chain.pFail),
      turns: rows.map((r) => ({
        turn: String(r.turn),
        draws: String(r.draws),
        withMulligan: formatPercent(r.withMulligan),
        noMulligan: formatPercent(r.noMulligan),
      })),
      chart: rows.map((r) => ({ turn: r.turn, withMulligan: r.withMulligan, noMulligan: r.noMulligan })),
      notes,
      inputs,
      share: encodeShare(inputs),
    },
  };
}

/** Each exact number beside its simulated estimate, with a verdict. */
export function simulationView(inputs: Inputs, result: SimResult): SimView {
  const chain = mulliganChain(inputs);
  const rows = byTurn(inputs);
  const n = result.trials;
  const pairs: { label: string; exact: number; estimate: number }[] = chain.steps.map((s, m) => ({
    label: `Keep after ${m} mulligan${m === 1 ? '' : 's'}`,
    exact: s.pKeep,
    estimate: result.keep[m] ?? NaN,
  }));
  pairs.push({ label: 'Keep the last hand anyway', exact: chain.pFail, estimate: result.fail });
  rows.forEach((r, i) => {
    pairs.push({ label: `Turn ${r.turn}, with mulligans`, exact: r.withMulligan, estimate: result.withMulligan[i] ?? NaN });
    pairs.push({ label: `Turn ${r.turn}, no mulligan`, exact: r.noMulligan, estimate: result.noMulligan[i] ?? NaN });
  });
  const out = pairs.map((p) => {
    const c = compare(p.exact, p.estimate, n);
    return {
      label: p.label,
      exact: formatPercent(p.exact),
      simulated: formatPercent(p.estimate),
      se: formatPercent(c.se),
      verdict: c.within ? ('agrees' as const) : ('check this' as const),
    };
  });
  const bad = out.filter((r) => r.verdict !== 'agrees').length;
  return {
    trials: n.toLocaleString('en-US'),
    rows: out,
    allAgree: bad === 0,
    overall:
      bad === 0
        ? `All ${out.length} numbers agree with the exact maths, inside 4 standard errors.`
        : `${bad} of ${out.length} numbers do not agree with the exact maths. Check them.`,
  };
}
