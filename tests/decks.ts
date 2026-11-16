import type { Group } from '../src/core/types.ts';
import type { ODeck } from './oracle.ts';

/** Small decks for the oracle tests. Each has a short reason for its shape. */
export const SMALL_DECKS: { label: string; deck: ODeck }[] = [
  { label: 'one group, no most', deck: { size: 11, groups: [{ copies: 3, least: 1, most: null }] } },
  { label: 'one group, least 2 most 4', deck: { size: 12, groups: [{ copies: 6, least: 2, most: 4 }] } },
  {
    label: 'two groups, both with a most',
    deck: { size: 12, groups: [{ copies: 5, least: 2, most: 3 }, { copies: 3, least: 1, most: 1 }] },
  },
  {
    label: 'three groups, mixed limits',
    deck: {
      size: 12,
      groups: [
        { copies: 4, least: 1, most: null },
        { copies: 4, least: 1, most: 2 },
        { copies: 2, least: 0, most: 1 },
      ],
    },
  },
  { label: 'least 0 with a most only', deck: { size: 12, groups: [{ copies: 7, least: 0, most: 2 }] } },
  { label: 'no other cards', deck: { size: 10, groups: [{ copies: 6, least: 2, most: 3 }, { copies: 4, least: 1, most: 2 }] } },
  { label: 'least sum 5', deck: { size: 12, groups: [{ copies: 5, least: 3, most: null }, { copies: 4, least: 2, most: 3 }] } },
  { label: 'zero groups', deck: { size: 10, groups: [] } },
  { label: 'least above copies', deck: { size: 12, groups: [{ copies: 2, least: 3, most: null }] } },
];

export function toGroups(deck: ODeck): Group[] {
  return deck.groups.map((g, i) => ({ name: `G${i}`, copies: g.copies, least: g.least, most: g.most }));
}

export const close = (a: number, b: number, eps = 1e-12): boolean => Math.abs(a - b) <= eps;
