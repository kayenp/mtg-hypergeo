// Brute-force oracle. It shares no code with src/core: it works on single cards, lists every subset,
// and counts with its own exact fractions. Use it only on small decks (about 12 cards).

export interface OGroup {
  copies: number;
  least: number;
  most: number | null;
}

export interface ODeck {
  size: number;
  groups: OGroup[];
}

/** Exact fraction with its own arithmetic. */
export class Q {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint, d: bigint) {
    const g = gcd(n < 0n ? -n : n, d);
    this.n = g === 0n ? 0n : n / g;
    this.d = g === 0n ? 1n : d / g;
  }
  static of(n: number, d = 1): Q {
    return new Q(BigInt(n), BigInt(d));
  }
  add(o: Q): Q {
    return new Q(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Q): Q {
    return new Q(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Q): Q {
    return new Q(this.n * o.n, this.d * o.d);
  }
  toNumber(): number {
    const whole = this.n / this.d;
    const rest = this.n - whole * this.d;
    return Number(whole) + Number((rest * 1_000_000_000_000_000_000n) / this.d) / 1e18;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** One label per card: the group index, or -1 for an "other" card. */
export function buildDeck(deck: ODeck): number[] {
  const cards: number[] = [];
  deck.groups.forEach((g, i) => {
    for (let c = 0; c < g.copies; c++) cards.push(i);
  });
  while (cards.length < deck.size) cards.push(-1);
  return cards;
}

/** Every k-element subset of `items`, as arrays. */
export function subsets<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number): void => {
    if (pick.length === k) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i <= items.length - (k - pick.length); i++) {
      pick.push(items[i]!);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}

function count(labels: readonly number[], group: number): number {
  let c = 0;
  for (const l of labels) if (l === group) c++;
  return c;
}

/** The kept cards hold between least and most of each group. */
function keptCardsMeetGoal(kept: readonly number[], groups: readonly OGroup[]): boolean {
  return groups.every((g, i) => {
    const c = count(kept, i);
    return c >= g.least && (g.most === null || c <= g.most);
  });
}

/** The cards hold at least `least` of each group. Most limits do not apply. */
function holdsLeast(cards: readonly number[], groups: readonly OGroup[]): boolean {
  return groups.every((g, i) => count(cards, i) >= g.least);
}

/** Some choice of `keepSize` cards from the 7-card hand meets the goal. */
export function handCanKeep(hand: readonly number[], groups: readonly OGroup[], keepSize: number): boolean {
  return subsets(hand, keepSize).some((kept) => keptCardsMeetGoal(kept, groups));
}

/** Card positions 0..size-1, so subsets of positions keep each card distinct. */
function positions(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Chance that a 7-card hand can meet the goal at `keepSize`. */
export function oracleQ(deck: ODeck, keepSize: number): Q {
  const cards = buildDeck(deck);
  const hands = subsets(positions(cards.length), 7);
  let hits = 0;
  for (const h of hands) if (handCanKeep(h.map((p) => cards[p]!), deck.groups, keepSize)) hits++;
  return Q.of(hits, hands.length);
}

export interface OChain {
  q: Q[];
  pKeep: Q[];
  pReach: Q[];
  pFail: Q;
}

/** The mulligan chain over the given kept sizes, one size per allowed draw. */
export function oracleChain(deck: ODeck, sizes: readonly number[]): OChain {
  const q = sizes.map((k) => oracleQ(deck, k));
  const pKeep: Q[] = [];
  const pReach: Q[] = [];
  let reach = Q.of(1);
  for (const qm of q) {
    pReach.push(reach);
    pKeep.push(reach.mul(qm));
    reach = reach.mul(Q.of(1).sub(qm));
  }
  return { q, pKeep, pReach, pFail: reach };
}

export interface OTurn {
  draws: number;
  withMulligan: Q;
  noMulligan: Q;
}

/**
 * Both by-turn lines for each draw count 0..maxDraws.
 * With mulligans, a forced keep picks the kept cards that give the best chance for that draw count.
 */
export function oracleByTurn(deck: ODeck, sizes: readonly number[], maxDraws: number): OTurn[] {
  const cards = buildDeck(deck);
  const all = positions(cards.length);
  const hands = subsets(all, 7);
  const chain = oracleChain(deck, sizes);
  const lastSize = sizes[sizes.length - 1]!;
  const reachLast = chain.pReach[chain.pReach.length - 1]!;
  let keptEarlier = Q.of(0);
  for (let m = 0; m < sizes.length - 1; m++) keptEarlier = keptEarlier.add(chain.pKeep[m]!);

  const out: OTurn[] = [];
  for (let d = 0; d <= maxDraws; d++) {
    let noHits = Q.of(0);
    let lastStepYes = Q.of(0);
    for (const h of hands) {
      const unseen = all.filter((p) => !h.includes(p));
      const drawSets = subsets(unseen, d);
      const handLabels = h.map((p) => cards[p]!);
      let plain = 0;
      for (const ds of drawSets) {
        if (holdsLeast([...handLabels, ...ds.map((p) => cards[p]!)], deck.groups)) plain++;
      }
      noHits = noHits.add(Q.of(plain, drawSets.length));

      if (handCanKeep(handLabels, deck.groups, lastSize)) {
        lastStepYes = lastStepYes.add(Q.of(1));
        continue;
      }
      let best = 0;
      for (const kept of subsets(handLabels, lastSize)) {
        let ok = 0;
        for (const ds of drawSets) if (holdsLeast([...kept, ...ds.map((p) => cards[p]!)], deck.groups)) ok++;
        best = Math.max(best, ok);
      }
      lastStepYes = lastStepYes.add(Q.of(best, drawSets.length));
    }
    const perHand = Q.of(1, hands.length);
    out.push({
      draws: d,
      noMulligan: noHits.mul(perHand),
      withMulligan: keptEarlier.add(reachLast.mul(lastStepYes.mul(perHand))),
    });
  }
  return out;
}
