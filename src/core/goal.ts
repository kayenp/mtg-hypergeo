import type { Group } from './types.ts';

/**
 * True when the player can choose `keepSize` cards from the draw that hold between `least` and `most`
 * of each group. `draw[i]` is the count of group i in the draw; `other` counts the rest.
 *
 * The kept count of group i can be any value from least to min(draw, most). So a choice exists when the
 * least counts fit in the kept size and the largest choice plus all other cards fills it.
 * This is exact only when least <= most for each group, which validation enforces.
 */
export function canKeep(draw: readonly number[], other: number, groups: readonly Group[], keepSize: number): boolean {
  let leastSum = 0;
  let room = other;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    const have = draw[i]!;
    if (have < g.least) return false;
    leastSum += g.least;
    room += g.most === null ? have : Math.min(have, g.most);
  }
  return leastSum <= keepSize && room >= keepSize;
}
