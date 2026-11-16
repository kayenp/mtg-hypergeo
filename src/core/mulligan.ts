import { binom, forEachCountVector, ratio } from './combin.ts';
import { canKeep } from './goal.ts';
import type { Fraction, Group, Inputs } from './types.ts';

export const HAND = 7;

export interface ChainStep {
  mulligans: number;
  /** Cards kept after this many mulligans. */
  handSize: number;
  /** Chance that this fresh draw can meet the goal. */
  q: number;
  /** Chance that the player keeps here and not earlier. */
  pKeep: number;
  /** Chance that every earlier draw failed, so this draw happens. */
  pReach: number;
}

export interface Chain {
  steps: ChainStep[];
  /** Chance that every allowed draw failed; the player keeps the last one anyway. */
  pFail: number;
  /** Set when the least counts raise the smallest hand size above the one asked for. */
  clamp: { requested: number; effective: number } | null;
  /** True when the least counts add up to more than 7, so no hand can meet the goal. */
  impossible: boolean;
}

export interface ExactChain {
  sizes: number[];
  q: Fraction[];
  pKeep: Fraction[];
  pReach: Fraction[];
  pFail: Fraction;
  clamp: Chain['clamp'];
  impossible: boolean;
}

/**
 * Kept size after m mulligans is 7 - max(0, m - free). Mulligans go on while that size stays at or above
 * the smallest size. The least counts raise the smallest size, because a smaller hand can never hold them.
 */
export function chainSizes(minHand: number, freeMulligans: number, leastSum: number): number[] {
  const floor = Math.max(minHand, Math.min(leastSum, HAND));
  const sizes: number[] = [];
  for (let m = 0; ; m++) {
    const size = HAND - Math.max(0, m - freeMulligans);
    if (size < floor) return sizes;
    sizes.push(size);
  }
}

/** The chain as exact fractions. Each fresh shuffle makes each draw independent of the ones before. */
export function exactChain(inputs: Inputs): ExactChain {
  const leastSum = inputs.groups.reduce((s, g) => s + g.least, 0);
  const sizes = chainSizes(inputs.minHand, inputs.freeMulligans, leastSum);
  const floor = sizes[sizes.length - 1]!;
  const den = binom(inputs.deckSize, HAND);
  // All steps share one denominator, so each q needs only its numerator.
  const qNum = new Map<number, bigint>();
  const q = sizes.map((size) => {
    let num = qNum.get(size);
    if (num === undefined) {
      num = keepChance(inputs.deckSize, inputs.groups, size).num;
      qNum.set(size, num);
    }
    return { num, den };
  });
  const pKeep: Fraction[] = [];
  const pReach: Fraction[] = [];
  let reach: Fraction = { num: 1n, den: 1n };
  for (const qm of q) {
    pReach.push(reach);
    pKeep.push({ num: reach.num * qm.num, den: reach.den * den });
    reach = { num: reach.num * (den - qm.num), den: reach.den * den };
  }
  return {
    sizes,
    q,
    pKeep,
    pReach,
    pFail: reach,
    clamp: floor === inputs.minHand ? null : { requested: inputs.minHand, effective: floor },
    impossible: leastSum > HAND,
  };
}

export function mulliganChain(inputs: Inputs): Chain {
  const exact = exactChain(inputs);
  const steps = exact.sizes.map((handSize, m) => ({
    mulligans: m,
    handSize,
    q: ratio(exact.q[m]!.num, exact.q[m]!.den),
    pKeep: ratio(exact.pKeep[m]!.num, exact.pKeep[m]!.den),
    pReach: ratio(exact.pReach[m]!.num, exact.pReach[m]!.den),
  }));
  return {
    steps,
    pFail: ratio(exact.pFail.num, exact.pFail.den),
    clamp: exact.clamp,
    impossible: exact.impossible,
  };
}

/** Exact chance that a fresh 7-card draw can meet the goal when the player keeps `keepSize` cards. */
export function keepChance(deckSize: number, groups: readonly Group[], keepSize: number): Fraction {
  const otherCopies = deckSize - groups.reduce((s, g) => s + g.copies, 0);
  let num = 0n;
  forEachCountVector(
    groups.map((g) => g.copies),
    HAND,
    (draw) => {
      const other = HAND - draw.reduce((s, x) => s + x, 0);
      if (other > otherCopies || !canKeep(draw, other, groups, keepSize)) return;
      let ways = binom(otherCopies, other);
      for (let i = 0; i < groups.length; i++) ways *= binom(groups[i]!.copies, draw[i]!);
      num += ways;
    },
  );
  return { num, den: binom(deckSize, HAND) };
}
