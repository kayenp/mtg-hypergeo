import { binom, ratio } from './combin.ts';
import { HAND, exactChain } from './mulligan.ts';
import type { Inputs } from './types.ts';

export interface TurnRow {
  turn: number;
  /** Cards drawn after the opening hand, by this turn. */
  draws: number;
  withMulligan: number;
  noMulligan: number;
}

/** Draw counts for turns 1..maxTurn. They stop before the draws reach the cards put on the bottom. */
function drawCounts(inputs: Inputs): number[] {
  const out: number[] = [];
  for (let turn = 1; turn <= inputs.maxTurn; turn++) {
    const draws = inputs.onPlay ? turn - 1 : turn;
    if (draws > inputs.deckSize - HAND) break;
    out.push(draws);
  }
  return out;
}

/** Multiplies two coefficient lists and drops each term above `maxDegree`. */
function mulTrunc(a: readonly bigint[], b: readonly bigint[], maxDegree: number): bigint[] {
  const out = new Array<bigint>(Math.min(maxDegree, a.length + b.length - 2) + 1).fill(0n);
  for (let i = 0; i < a.length && i <= maxDegree; i++) {
    if (a[i] === 0n) continue;
    for (let j = 0; j < b.length && i + j <= maxDegree; j++) out[i + j]! += a[i]! * b[j]!;
  }
  return out;
}

/**
 * Coefficient c of the result counts the c-card subsets of the deck that hold at least `least` of each group.
 * Each group gives sum over x >= least of C(copies, x) z^x; the other cards give sum over y of C(other, y) z^y.
 */
function leastCounts(inputs: Inputs, maxCards: number): bigint[] {
  const otherCopies = inputs.deckSize - inputs.groups.reduce((s, g) => s + g.copies, 0);
  let poly = Array.from({ length: Math.min(otherCopies, maxCards) + 1 }, (_, y) => binom(otherCopies, y));
  for (const g of inputs.groups) {
    const factor = Array.from({ length: Math.min(g.copies, maxCards) + 1 }, (_, x) =>
      x >= g.least ? binom(g.copies, x) : 0n,
    );
    poly = mulTrunc(poly, factor, maxCards);
  }
  return poly;
}

/**
 * The no-mulligan line is P(a random 7 + d cards hold at least `least` of each group). Most limits do not apply.
 *
 * The mulligan line is 1 - pReachLast * (1 - noMulligan). Two facts give this:
 * a kept hand that meets the goal holds each least count, so it is a yes on each turn;
 * and at the last allowed draw the hand is a fresh 7, and the clamp lets the kept cards hold every useful card
 * of it. So the last step is a yes exactly when those 7 cards plus the d draws hold each least count.
 * That is the no-mulligan event, and it is independent of the earlier draws.
 * This replaces a loop over each failing 7-card draw; the brute-force oracle confirms the two agree.
 */
export function byTurn(inputs: Inputs): TurnRow[] {
  const draws = drawCounts(inputs);
  if (draws.length === 0) return [];
  const counts = leastCounts(inputs, HAND + draws[draws.length - 1]!);
  const chain = exactChain(inputs);
  const reach = chain.pReach[chain.pReach.length - 1]!;
  return draws.map((d, i) => {
    const num = counts[HAND + d] ?? 0n;
    const den = binom(inputs.deckSize, HAND + d);
    return {
      turn: i + 1,
      draws: d,
      noMulligan: ratio(num, den),
      withMulligan: ratio(reach.den * den - reach.num * (den - num), reach.den * den),
    };
  });
}

export interface AverageRow {
  turn: number;
  draws: number;
  /** Average copies seen of each group, in the order of the groups. */
  copies: number[];
}

/**
 * Average copies of each group seen by each turn with no mulligan: (7 + draws) * copies / deckSize.
 * Each card is equally likely to be among the seen cards, so the average is linear in the seen count.
 * There is no line with mulligans, because a count needs a rule for which cards the player keeps.
 */
export function averageCopies(inputs: Inputs): AverageRow[] {
  return drawCounts(inputs).map((draws, i) => ({
    turn: i + 1,
    draws,
    copies: inputs.groups.map((g) => ((HAND + draws) * g.copies) / inputs.deckSize),
  }));
}
