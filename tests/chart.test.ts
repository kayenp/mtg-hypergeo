import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartGeometry, nearestIndex } from '../src/core/chart.ts';

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
