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

export function chartGeometry(rows: readonly ChartRow[], size: ChartSize): ChartGeometry {
  const wide = size.width >= WIDE;
  const plot = {
    left: PAD.left,
    top: PAD.top,
    right: Math.round(size.width - (wide ? LABEL_ROOM : 16)),
    bottom: Math.round(size.height - PAD.bottom),
  };
  const xAt = (i: number): number =>
    rows.length === 1 ? round2((plot.left + plot.right) / 2) : round2(plot.left + ((plot.right - plot.left) * i) / (rows.length - 1));
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

  const room = Math.max(1, Math.floor((plot.right - plot.left) / MIN_TICK_SPACE));
  const step = Math.ceil(rows.length / room);
  const xTicks = rows.flatMap((r, i) => (i % step === 0 ? [{ x: xAt(i), label: String(r.turn) }] : []));

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
