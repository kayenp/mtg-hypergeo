/** One set of cards in the deck that the goal counts. Groups do not overlap. */
export interface Group {
  name: string;
  copies: number;
  least: number;
  /** null means no upper limit. */
  most: number | null;
}

export interface Inputs {
  deckSize: number;
  groups: Group[];
  /** The smallest hand size the player will mulligan down to. */
  minHand: number;
  freeMulligans: number;
  onPlay: boolean;
  maxTurn: number;
  seed: number;
  trials: number;
}

/** A problem tied to one input field, so the page can show it next to that field. */
export interface Issue {
  /** A path such as "deckSize" or "groups.2.most". */
  field: string;
  message: string;
}

/** An exact probability. `den` is always above 0. */
export interface Fraction {
  num: bigint;
  den: bigint;
}
