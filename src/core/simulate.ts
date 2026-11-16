// A real shuffle and a real draw. This file shares no maths with the exact engine on purpose:
// it is the second opinion, so it restates the rules in its own words.
import type { Inputs } from './types.ts';

export interface SimResult {
  trials: number;
  /** Share of trials kept after each mulligan count. */
  keep: number[];
  fail: number;
  turns: { turn: number; draws: number }[];
  withMulligan: number[];
  noMulligan: number[];
}

export interface Simulation {
  run(trials: number): void;
  readonly done: boolean;
  readonly completed: number;
  result(): SimResult;
}

/** A small seeded generator of floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OTHER = -1;

/** Bit masks over the 7 hand positions, grouped by how many bits are set. */
const MASKS: number[][] = Array.from({ length: 8 }, () => []);
for (let mask = 0; mask < 128; mask++) {
  let bits = 0;
  for (let b = 0; b < 7; b++) if (mask & (1 << b)) bits++;
  MASKS[bits]!.push(mask);
}

export function createSimulation(inputs: Inputs): Simulation {
  const groups = inputs.groups;
  const deck: number[] = [];
  groups.forEach((g, i) => {
    for (let c = 0; c < g.copies; c++) deck.push(i);
  });
  while (deck.length < inputs.deckSize) deck.push(OTHER);

  // Kept size after m mulligans: 7, minus 1 for each mulligan past the free ones.
  // Stop at the smallest size, raised to the sum of the least counts (at most 7).
  let leastSum = 0;
  for (const g of groups) leastSum += g.least;
  const smallest = Math.max(inputs.minHand, Math.min(leastSum, 7));
  const sizes: number[] = [];
  for (let m = 0; 7 - Math.max(0, m - inputs.freeMulligans) >= smallest; m++) {
    sizes.push(7 - Math.max(0, m - inputs.freeMulligans));
  }

  const turns: { turn: number; draws: number }[] = [];
  for (let turn = 1; turn <= inputs.maxTurn; turn++) {
    const draws = inputs.onPlay ? turn - 1 : turn;
    if (draws > inputs.deckSize - 7) break;
    turns.push({ turn, draws });
  }
  const depth = 7 + (turns.length > 0 ? turns[turns.length - 1]!.draws : 0);

  const rand = mulberry32(inputs.seed);
  const cards = deck.slice();
  const counts = new Array<number>(groups.length).fill(0);
  const keepHits = new Array<number>(sizes.length).fill(0);
  const withHits = new Array<number>(turns.length).fill(0);
  const noHits = new Array<number>(turns.length).fill(0);
  let failHits = 0;
  let completed = 0;

  /** Shuffles only the top `depth` cards into place; the rest are never looked at. */
  const shuffleTop = (): void => {
    const n = cards.length;
    for (let i = 0; i < depth && i < n - 1; i++) {
      const j = i + Math.floor(rand() * (n - i));
      const t = cards[i]!;
      cards[i] = cards[j]!;
      cards[j] = t;
    }
  };

  const holdsLeast = (): boolean => {
    for (let i = 0; i < groups.length; i++) if (counts[i]! < groups[i]!.least) return false;
    return true;
  };

  /** Some choice of `size` of the top 7 cards holds between least and most of each group. */
  const canKeep = (size: number): boolean => {
    for (const mask of MASKS[size]!) {
      counts.fill(0);
      for (let b = 0; b < 7; b++) {
        if (mask & (1 << b) && cards[b] !== OTHER) counts[cards[b]!]!++;
      }
      let ok = true;
      for (let i = 0; i < groups.length && ok; i++) {
        const g = groups[i]!;
        if (counts[i]! < g.least || (g.most !== null && counts[i]! > g.most)) ok = false;
      }
      if (ok) return true;
    }
    return false;
  };

  /** Counts kept cards plus the draws for each turn, and adds a hit where they hold each least count. */
  const playOut = (kept: readonly number[], hits: number[]): void => {
    counts.fill(0);
    for (const c of kept) if (c !== OTHER) counts[c]!++;
    let drawn = 0;
    for (let r = 0; r < turns.length; r++) {
      for (; drawn < turns[r]!.draws; drawn++) {
        const c = cards[7 + drawn]!;
        if (c !== OTHER) counts[c]!++;
      }
      if (holdsLeast()) hits[r]!++;
    }
  };

  /** The kept cards for a hand that met the goal: the first choice that fits. */
  const keptFor = (size: number): number[] => {
    for (const mask of MASKS[size]!) {
      const kept: number[] = [];
      for (let b = 0; b < 7; b++) if (mask & (1 << b)) kept.push(cards[b]!);
      const c = new Array<number>(groups.length).fill(0);
      for (const x of kept) if (x !== OTHER) c[x]!++;
      if (groups.every((g, i) => c[i]! >= g.least && (g.most === null || c[i]! <= g.most))) return kept;
    }
    throw new Error('keptFor called on a hand that cannot keep');
  };

  /** A forced keep holds the cards that count toward the least counts, then fills with the rest. */
  const forcedKeep = (size: number): number[] => {
    const want = groups.map((g) => g.least);
    const kept: number[] = [];
    const rest: number[] = [];
    for (let b = 0; b < 7; b++) {
      const c = cards[b]!;
      if (c !== OTHER && want[c]! > 0) {
        want[c]!--;
        kept.push(c);
      } else rest.push(c);
    }
    while (kept.length < size) kept.push(rest.shift()!);
    return kept.slice(0, size);
  };

  const oneTrial = (): void => {
    for (let m = 0; m < sizes.length; m++) {
      shuffleTop();
      if (m === 0) playOut(cards.slice(0, 7), noHits);
      const size = sizes[m]!;
      if (canKeep(size)) {
        keepHits[m]!++;
        playOut(keptFor(size), withHits);
        return;
      }
      if (m === sizes.length - 1) {
        failHits++;
        playOut(forcedKeep(size), withHits);
      }
    }
  };

  return {
    run(n: number): void {
      const stop = Math.min(inputs.trials, completed + n);
      for (; completed < stop; completed++) oneTrial();
    },
    get done() {
      return completed >= inputs.trials;
    },
    get completed() {
      return completed;
    },
    result(): SimResult {
      const n = completed;
      const share = (x: number): number => (n === 0 ? 0 : x / n);
      return {
        trials: n,
        keep: keepHits.map(share),
        fail: share(failHits),
        turns: turns.map((t) => ({ ...t })),
        withMulligan: withHits.map(share),
        noMulligan: noHits.map(share),
      };
    },
  };
}

/**
 * The standard error comes from the exact p, sqrt(p(1 - p) / n). An estimate agrees when it is inside
 * 4 standard errors. An exact 0 or 1 has no spread, so the estimate must match it exactly.
 */
export function compare(exact: number, estimate: number, n: number): { se: number; within: boolean } {
  const se = Math.sqrt((exact * (1 - exact)) / n);
  if (exact === 0 || exact === 1) return { se, within: estimate === exact };
  return { se, within: Math.abs(estimate - exact) <= 4 * se };
}
