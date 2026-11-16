/**
 * A chance as a percent with two decimals, such as "39.95%".
 * A value that is not exactly 0 or 1 never shows as "0.00%" or "100.00%", because those read as certain.
 */
export function formatPercent(p: number): string {
  const text = (p * 100).toFixed(2);
  if (p > 0 && text === '0.00') return '<0.01%';
  if (p < 1 && text === '100.00') return '>99.99%';
  return `${text}%`;
}
