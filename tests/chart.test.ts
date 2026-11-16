import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageGeometry, chartGeometry, nearestIndex } from '../src/core/chart.ts';

const size = { width: 600, height: 300 };

test('two points: the first sits at the left edge, the last at the right edge, scaled on y [R13]', () => {
  const g = chartGeometry(
    [
      { turn: 1, withMulligan: 0.5, noMulligan: 0.25 },
      { turn: 2, withMulligan: 1, noMulligan: 0 },
    ],
    size,
  );
  const { left, right, top, bottom } = g.plot;
  assert.ok(left > 0 && right < size.width && top > 0 && bottom < size.height, 'plot inside the box');
  const withLine = g.series.find((s) => s.key === 'with')!;
  const noLine = g.series.find((s) => s.key === 'no')!;
  assert.deepEqual(withLine.points.map((p) => p.x), [left, right]);
  assert.equal(withLine.points[0]!.y, bottom - (bottom - top) * 0.5);
  assert.equal(withLine.points[1]!.y, top);
  assert.equal(noLine.points[0]!.y, bottom - (bottom - top) * 0.25);
  assert.equal(noLine.points[1]!.y, bottom);
  assert.equal(withLine.path, `M${left} ${withLine.points[0]!.y}L${right} ${top}`);
  assert.deepEqual(g.xTicks.map((t) => t.label), ['1', '2']);
});

test('0% and 100% map to the bottom and the top of the plot', () => {
  const g = chartGeometry([{ turn: 1, withMulligan: 1, noMulligan: 0 }, { turn: 2, withMulligan: 1, noMulligan: 0 }], size);
  assert.equal(g.series.length, 2);
  assert.ok(g.series.find((s) => s.key === 'with')!.points.every((p) => p.y === g.plot.top));
  assert.ok(g.series.find((s) => s.key === 'no')!.points.every((p) => p.y === g.plot.bottom));
});

test('the y axis runs from 0% to 100% in steps of 25%', () => {
  const g = chartGeometry([{ turn: 1, withMulligan: 0.3, noMulligan: 0.2 }], size);
  assert.deepEqual(g.yTicks.map((t) => t.label), ['0%', '25%', '50%', '75%', '100%']);
  assert.equal(g.yTicks[0]!.y, g.plot.bottom);
  assert.equal(g.yTicks[4]!.y, g.plot.top);
});

test('a single turn sits in the middle of the plot, with one x tick', () => {
  const g = chartGeometry([{ turn: 1, withMulligan: 0.9, noMulligan: 0.8 }], size);
  const mid = (g.plot.left + g.plot.right) / 2;
  for (const s of g.series) {
    assert.equal(s.points.length, 1);
    assert.equal(s.points[0]!.x, mid);
  }
  assert.deepEqual(g.xTicks, [{ x: mid, label: '1' }]);
});

test('no rows give no series and no x ticks', () => {
  const g = chartGeometry([], size);
  assert.deepEqual(g.series, []);
  assert.deepEqual(g.xTicks, []);
});

test('many turns thin the x ticks so the labels do not crowd', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ turn: i + 1, withMulligan: 0.5, noMulligan: 0.4 }));
  const narrow = chartGeometry(rows, { width: 340, height: 240 });
  assert.ok(narrow.xTicks.length <= 10 && narrow.xTicks.length >= 4, `${narrow.xTicks.length} ticks`);
  assert.equal(narrow.xTicks[0]!.label, '1');
});

test('end labels name both lines when the ends are apart, and drop when they touch', () => {
  const apart = chartGeometry([{ turn: 1, withMulligan: 0.9, noMulligan: 0.3 }, { turn: 2, withMulligan: 0.95, noMulligan: 0.4 }], size);
  assert.deepEqual(apart.endLabels.map((l) => l.key).sort(), ['no', 'with']);
  const close = chartGeometry([{ turn: 1, withMulligan: 0.9, noMulligan: 0.89 }, { turn: 2, withMulligan: 0.95, noMulligan: 0.949 }], size);
  assert.deepEqual(close.endLabels, []);
});

test('the text alternative names both lines and the first and last values [R13]', () => {
  const g = chartGeometry([{ turn: 1, withMulligan: 0.5, noMulligan: 0.25 }, { turn: 3, withMulligan: 0.75, noMulligan: 0.6 }], size);
  assert.match(g.description, /With mulligans/);
  assert.match(g.description, /No mulligan/);
  assert.match(g.description, /50\.00%/);
  assert.match(g.description, /60\.00%/);
  assert.match(g.description, /turn 3/);
});

test('nearestIndex snaps a pointer x to the closest turn', () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ turn: i + 1, withMulligan: 0.5, noMulligan: 0.4 }));
  const g = chartGeometry(rows, size);
  assert.equal(g.series.length, 2);
  const xs = g.series[0]!.points.map((p) => p.x);
  assert.equal(nearestIndex(g, xs[0]! - 50), 0);
  assert.equal(nearestIndex(g, xs[2]! + 1), 2);
  assert.equal(nearestIndex(g, (xs[3]! + xs[4]!) / 2 + 1), 4);
  assert.equal(nearestIndex(g, 10000), 4);
});

const avgRows = (n: number, perTurn: (t: number) => number[]) =>
  Array.from({ length: n }, (_, i) => ({ turn: i + 1, copies: perTurn(i + 1) }));

test('average panel, one group: points scale from 0 to a round maximum in cards [R13]', () => {
  const rows = avgRows(10, (t) => [((6 + t) * 24) / 60]);
  const g = averageGeometry(rows, ['Lands'], size);
  assert.equal(g.series.length, 1);
  assert.equal(g.max, 8);
  assert.deepEqual(g.yTicks.map((t) => t.label), ['0', '2', '4', '6', '8']);
  const first = g.series[0]!.points[0]!;
  assert.equal(first.y, Math.round((g.plot.bottom - (g.plot.bottom - g.plot.top) * (2.8 / 8)) * 100) / 100);
  assert.equal(g.series[0]!.name, 'Lands');
  assert.match(g.description, /Lands: 2\.80 at turn 1, 6\.40 at turn 10/);
});

test('average panel shares the turn axis with the odds chart [R13]', () => {
  const odds = Array.from({ length: 10 }, (_, i) => ({ turn: i + 1, withMulligan: 0.5, noMulligan: 0.4 }));
  const a = chartGeometry(odds, size);
  const b = averageGeometry(avgRows(10, () => [1, 2]), ['A', 'B'], size);
  assert.equal(b.series.length, 2);
  assert.deepEqual(b.xTicks, a.xTicks);
  assert.deepEqual(b.plot.left, a.plot.left);
  assert.deepEqual(b.plot.right, a.plot.right);
  assert.deepEqual(b.series[0]!.points.map((p) => p.x), a.series[0]!.points.map((p) => p.x));
});

test('average panel, six groups: six styles, no direct labels, the legend carries the names [R13]', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  const g = averageGeometry(avgRows(5, (t) => names.map((_, i) => t * (i + 1) * 0.1)), names, size);
  assert.equal(g.series.length, 6);
  assert.deepEqual(g.series.map((s) => s.style), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(g.endLabels, []);
  for (const n of names) assert.match(g.description, new RegExp(`${n}: `));
});

test('average panel, a group with 0 copies sits on the baseline [R13]', () => {
  const g = averageGeometry(avgRows(4, () => [1.5, 0]), ['A', 'None'], size);
  assert.equal(g.series.length, 2);
  assert.ok(g.series[1]!.points.every((p) => p.y === g.plot.bottom));
});

test('average panel, all zero still has a scale [R13]', () => {
  const g = averageGeometry(avgRows(3, () => [0]), ['None'], size);
  assert.ok(g.max > 0);
  assert.equal(g.yTicks[0]!.label, '0');
});

test('average panel, a single turn sits in the middle [R13]', () => {
  const g = averageGeometry(avgRows(1, () => [2.8]), ['Lands'], size);
  assert.equal(g.series.length, 1);
  assert.equal(g.series[0]!.points[0]!.x, (g.plot.left + g.plot.right) / 2);
  assert.equal(g.xTicks.length, 1);
});

test('average panel, two to four groups get direct end labels when apart, cut to fit [R13]', () => {
  const long = 'A very long group name that goes on';
  const g = averageGeometry(avgRows(5, (t) => [t, t * 0.2]), [long, 'B'], size);
  assert.deepEqual(g.endLabels.map((l) => l.index), [0, 1]);
  assert.ok(g.endLabels[0]!.text.length <= 14, g.endLabels[0]!.text);
  assert.ok(g.endLabels[0]!.text.endsWith('…'));
  const narrow = averageGeometry(avgRows(5, (t) => [t, t * 0.2]), ['A', 'B'], { width: 360, height: 220 });
  assert.deepEqual(narrow.endLabels, []);
});
