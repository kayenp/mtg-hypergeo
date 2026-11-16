import { formatPercent } from './format.ts';

export interface ChartRow {
  turn: number;
  withMulligan: number;
  noMulligan: number;
}

export interface ChartSize {
  width: number;
  height: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  turn: number;
  value: number;
}

export type SeriesKey = 'with' | 'no';

export interface ChartSeries {
  key: SeriesKey;
  label: string;
  points: ChartPoint[];
  /** SVG path data for the line. */
  path: string;
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  series: ChartSeries[];
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  /** Direct labels at the line ends. Empty when the two ends are too close to label apart. */
  endLabels: { key: SeriesKey; x: number; y: number; text: string }[];
  /** A text alternative for the SVG. */
  description: string;
}

export const SERIES_LABELS: Record<SeriesKey, string> = { with: 'With mulligans', no: 'No mulligan' };

// Room for the y labels on the left and the x labels below.
const PAD = { left: 44, top: 12, bottom: 28 };
// Direct end labels need about 112 px on the right. Below this width the legend alone names the lines.
const WIDE = 480;
const LABEL_ROOM = 112;
const MIN_LABEL_GAP = 16;
const MIN_TICK_SPACE = 32;

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** The plot box and the turn axis. Both panels use it, so their turns line up. */
function frame(turns: readonly number[], size: ChartSize) {
  const wide = size.width >= WIDE;
  const plot = {
    left: PAD.left,
    top: PAD.top,
    right: Math.round(size.width - (wide ? LABEL_ROOM : 16)),
    bottom: Math.round(size.height - PAD.bottom),
  };
  const n = turns.length;
  const xAt = (i: number): number =>
    n === 1 ? round2((plot.left + plot.right) / 2) : round2(plot.left + ((plot.right - plot.left) * i) / (n - 1));
  const room = Math.max(1, Math.floor((plot.right - plot.left) / MIN_TICK_SPACE));
  const step = Math.ceil(n / room);
  const xTicks = turns.flatMap((t, i) => (i % step === 0 ? [{ x: xAt(i), label: String(t) }] : []));
  return { wide, plot, xAt, xTicks };
}

export function chartGeometry(rows: readonly ChartRow[], size: ChartSize): ChartGeometry {
  const { wide, plot, xAt, xTicks } = frame(rows.map((r) => r.turn), size);
  const yAt = (p: number): number => round2(plot.bottom - (plot.bottom - plot.top) * p);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({ y: yAt(p), label: `${p * 100}%` }));
  if (rows.length === 0) {
    return { width: size.width, height: size.height, plot, series: [], yTicks, xTicks: [], endLabels: [], description: 'No turns to show.' };
  }

  const series: ChartSeries[] = (['with', 'no'] as const).map((key) => {
    const points = rows.map((r, i) => {
      const value = key === 'with' ? r.withMulligan : r.noMulligan;
      return { x: xAt(i), y: yAt(value), turn: r.turn, value };
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
    return { key, label: SERIES_LABELS[key], points, path };
  });

  const ends = series.map((s) => s.points[s.points.length - 1]!);
  const endLabels =
    wide && Math.abs(ends[0]!.y - ends[1]!.y) >= MIN_LABEL_GAP
      ? series.map((s, i) => ({ key: s.key, x: ends[i]!.x + 10, y: ends[i]!.y, text: s.label }))
      : [];

  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const describe = (label: string, a: number, b: number): string =>
    rows.length === 1
      ? `${label}: ${formatPercent(a)} at turn ${first.turn}.`
      : `${label}: ${formatPercent(a)} at turn ${first.turn}, ${formatPercent(b)} at turn ${last.turn}.`;
  const description = [
    'Line chart of the chance by turn, from 0% to 100%.',
    describe(SERIES_LABELS.with, first.withMulligan, last.withMulligan),
    describe(SERIES_LABELS.no, first.noMulligan, last.noMulligan),
    'The table below has every value.',
  ].join(' ');

  return { width: size.width, height: size.height, plot, series, yTicks, xTicks, endLabels, description };
}

/** The index of the turn closest to a pointer x, so a tooltip can snap to it. */
export function nearestIndex(geometry: ChartGeometry, x: number): number {
  const points = geometry.series[0]?.points ?? [];
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i]!.x - x) < Math.abs(points[best]!.x - x)) best = i;
  }
  return best;
}

export interface AverageSeries {
  /** The group index; it also picks the colour, dash and marker. */
  style: number;
  name: string;
  points: ChartPoint[];
  path: string;
}

export interface AverageGeometry {
  width: number;
  height: number;
  plot: ChartGeometry['plot'];
  /** The top of the y scale, in cards. */
  max: number;
  series: AverageSeries[];
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  endLabels: { index: number; x: number; y: number; text: string }[];
  description: string;
}

const MAX_DIRECT_LABELS = 4;
const LABEL_CHARS = 14;

/** The smallest step from 0.5, 1, 2, 5, 10, 20, ... that covers `max` in at most 5 steps. */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 0.25 };
  for (let p = 0.1; ; p *= 10) {
    for (const m of [5, 10, 20]) {
      const step = round2(p * m);
      if (step * 5 >= max) return { top: round2(Math.ceil(max / step) * step), step };
    }
  }
}

function cut(name: string): string {
  const chars = Array.from(name);
  return chars.length <= LABEL_CHARS ? name : `${chars.slice(0, LABEL_CHARS - 1).join('')}…`;
}

/** The average-copies panel: one line per group, on the same turn axis as the odds chart. */
export function averageGeometry(
  rows: readonly { turn: number; copies: readonly number[] }[],
  names: readonly string[],
  size: ChartSize,
): AverageGeometry {
  const { wide, plot, xAt, xTicks } = frame(rows.map((r) => r.turn), size);
  const { top: max, step } = niceScale(Math.max(0, ...rows.flatMap((r) => r.copies)));
  const yAt = (v: number): number => round2(plot.bottom - ((plot.bottom - plot.top) * v) / max);
  const yTicks: { y: number; label: string }[] = [];
  for (let v = 0; v <= max + 1e-9; v = round2(v + step)) yTicks.push({ y: yAt(v), label: String(v) });

  const series = rows.length === 0 ? [] : names.map((name, style) => {
    const points = rows.map((r, i) => ({ x: xAt(i), y: yAt(r.copies[style] ?? 0), turn: r.turn, value: r.copies[style] ?? 0 }));
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
    return { style, name, points, path };
  });

  // Direct labels only for 2 to 4 groups on a wide chart, and only when no two line ends touch.
  const ends = series.map((s) => s.points[s.points.length - 1]!);
  const ys = ends.map((e) => e.y).sort((a, b) => a - b);
  const apart = ys.every((y, i) => i === 0 || y - ys[i - 1]! >= MIN_LABEL_GAP);
  const endLabels =
    wide && series.length >= 2 && series.length <= MAX_DIRECT_LABELS && apart
      ? series.map((s, i) => ({ index: s.style, x: ends[i]!.x + 10, y: ends[i]!.y, text: cut(s.name) }))
      : [];

  const first = rows[0];
  const last = rows[rows.length - 1];
  const parts = series.map((s) => {
    const a = s.points[0]!.value.toFixed(2);
    const b = s.points[s.points.length - 1]!.value.toFixed(2);
    return rows.length === 1 ? `${s.name}: ${a} at turn ${first!.turn}.` : `${s.name}: ${a} at turn ${first!.turn}, ${b} at turn ${last!.turn}.`;
  });
  const description = [`Line chart of the average copies seen by turn, with no mulligan, from 0 to ${max} cards.`, ...parts, 'The table below has every value.'].join(' ');

  return { width: size.width, height: size.height, plot, max, series, yTicks, xTicks, endLabels, description };
}
