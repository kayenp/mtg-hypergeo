import type { Inputs } from './types.ts';

/** The deck the page shows on first load, and the fallback for each bad field in a link. */
export function defaultInputs(): Inputs {
  return {
    deckSize: 60,
    groups: [
      { name: 'Lands', copies: 24, least: 2, most: 4 },
      { name: 'Key card', copies: 4, least: 1, most: null },
    ],
    minHand: 5,
    freeMulligans: 0,
    onPlay: true,
    maxTurn: 10,
    seed: 1,
    trials: 100000,
  };
}
