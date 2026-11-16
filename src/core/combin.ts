const cache = new Map<string, bigint>();

/** Exact binomial coefficient C(n, k). It is 0n when k < 0 or k > n. */
export function binom(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  const kk = Math.min(k, n - k);
  const key = `${n},${kk}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let result = 1n;
  // Each partial product is C(n - kk + i, i), so each division is exact.
  for (let i = 1; i <= kk; i++) {
    result = (result * BigInt(n - kk + i)) / BigInt(i);
  }
  cache.set(key, result);
  return result;
}

const SCALE = 10n ** 18n;

/** num / den as a float. The division happens in BigInt, so a huge num or den never becomes Infinity. */
export function ratio(num: bigint, den: bigint): number {
  return Number((num * SCALE) / den) / 1e18;
}

/**
 * Calls `visit` once for each vector v with 0 <= v[i] <= caps[i] and sum(v) <= maxSum.
 * The vector passed to `visit` is reused, so copy it to keep it.
 */
export function forEachCountVector(
  caps: readonly number[],
  maxSum: number,
  visit: (counts: readonly number[]) => void,
): void {
  const v = new Array<number>(caps.length).fill(0);
  const step = (i: number, left: number): void => {
    if (i === caps.length) {
      visit(v);
      return;
    }
    const top = Math.min(caps[i]!, left);
    for (let x = 0; x <= top; x++) {
      v[i] = x;
      step(i + 1, left - x);
    }
    v[i] = 0;
  };
  step(0, maxSum);
}
