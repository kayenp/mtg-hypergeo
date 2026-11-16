// The page shell. All numbers and text come from the core; this file only reads the form and draws.
// User text and link text reach the page only through textContent and attribute setters, never innerHTML.
import { averageGeometry, chartGeometry, SERIES_LABELS, type ChartRow } from '../core/chart.ts';
import { formatPercent } from '../core/format.ts';
import { decodeShare } from '../core/share.ts';
import { createSimulation, type Simulation } from '../core/simulate.ts';
import type { Inputs } from '../core/types.ts';
import { MAX_GROUPS } from '../core/validate.ts';
import { buildView, formFromInputs, simulationView, type AverageChart, type Explainer, type FormState, type GroupForm, type View } from '../core/viewModel.ts';

const SVG = 'http://www.w3.org/2000/svg';
const SIM_PART = 2000;
const SCALARS = ['deckSize', 'minHand', 'freeMulligans', 'maxTurn', 'seed', 'trials'] as const;
const GROUP_FIELDS: { key: keyof GroupForm; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'copies', label: 'Copies' },
  { key: 'least', label: 'At least' },
  { key: 'most', label: 'At most' },
];

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const groupsBox = byId<HTMLDivElement>('groups');
let groupCount = 0;
let lastView: View | null = null;
let sim: { run: Simulation; inputs: Inputs; timer: number } | null = null;

// ---- form <-> state ----

function fieldInput(field: string): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(`[data-field="${field}"]`) ?? (document.getElementById(field) as HTMLInputElement | null);
}

function readForm(): FormState {
  const groups: GroupForm[] = [];
  for (let i = 0; i < groupCount; i++) {
    const g = { name: '', copies: '', least: '', most: '' };
    for (const f of GROUP_FIELDS) g[f.key] = fieldInput(`groups.${i}.${f.key}`)?.value ?? '';
    groups.push(g);
  }
  return {
    deckSize: byId<HTMLInputElement>('deckSize').value,
    groups,
    minHand: byId<HTMLInputElement>('minHand').value,
    freeMulligans: byId<HTMLInputElement>('freeMulligans').value,
    onPlay: byId<HTMLInputElement>('onPlay').checked,
    maxTurn: byId<HTMLInputElement>('maxTurn').value,
    seed: byId<HTMLInputElement>('seed').value,
    trials: byId<HTMLInputElement>('trials').value,
  };
}

function groupRow(i: number, g: GroupForm): HTMLFieldSetElement {
  const box = el('fieldset', undefined, 'group');
  box.append(el('legend', `Group ${i + 1}`));
  for (const f of GROUP_FIELDS) {
    const field = `groups.${i}.${f.key}`;
    const wrap = el('div', undefined, f.key === 'name' ? 'field name' : 'field');
    const id = `g${i}-${f.key}`;
    const label = el('label', f.label);
    label.htmlFor = id;
    const input = el('input');
    input.id = id;
    input.dataset.field = field;
    input.autocomplete = 'off';
    if (f.key === 'name') input.maxLength = 40;
    else input.inputMode = 'numeric';
    input.value = g[f.key];
    const msg = el('p', undefined, 'msg');
    msg.id = `msg-${field}`;
    input.setAttribute('aria-describedby', msg.id);
    wrap.append(label, input, msg);
    box.append(wrap);
  }
  const msg = el('p', undefined, 'msg');
  msg.id = `msg-groups.${i}`;
  box.append(msg);
  const remove = el('button', `Remove group ${i + 1}`, 'remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    const form = readForm();
    form.groups.splice(i, 1);
    fillForm(form);
    update();
  });
  box.append(remove);
  return box;
}

function fillGroups(groups: GroupForm[]): void {
  groupsBox.replaceChildren(...groups.map((g, i) => groupRow(i, g)));
  groupCount = groups.length;
  byId<HTMLButtonElement>('add-group').disabled = groupCount >= MAX_GROUPS;
}

function fillForm(form: FormState): void {
  for (const k of SCALARS) byId<HTMLInputElement>(k).value = form[k];
  byId<HTMLInputElement>('onPlay').checked = form.onPlay;
  byId<HTMLInputElement>('onDraw').checked = !form.onPlay;
  fillGroups(form.groups);
}

// ---- rendering ----

function showMessages(view: View): void {
  for (const m of document.querySelectorAll<HTMLElement>('.msg')) {
    m.textContent = '';
    m.classList.remove('error', 'warning');
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('[aria-invalid]')) input.removeAttribute('aria-invalid');
  const put = (all: Record<string, string[]>, kind: 'error' | 'warning'): void => {
    for (const [field, messages] of Object.entries(all)) {
      const box = document.getElementById(`msg-${field}`) ?? byId('msg-groups');
      box.textContent = [box.textContent, ...messages].filter(Boolean).join(' ');
      box.classList.add(kind);
      if (kind === 'error') fieldInput(field)?.setAttribute('aria-invalid', 'true');
    }
  };
  put(view.errors, 'error');
  put(view.warnings, 'warning');
}

function fillTable(id: string, rows: string[][], classes?: (string | undefined)[][]): void {
  const body = byId<HTMLTableElement>(id).tBodies[0]!;
  body.replaceChildren(
    ...rows.map((cells, r) => {
      const tr = el('tr');
      cells.forEach((c, i) => {
        const cell = el(i === 0 ? 'th' : 'td', c, classes?.[r]?.[i]);
        if (i === 0) cell.setAttribute('scope', 'row');
        tr.append(cell);
      });
      return tr;
    }),
  );
}

function render(view: View): void {
  lastView = view;
  showMessages(view);
  const r = view.results;
  byId('invalid').hidden = r !== null;
  byId('result-body').hidden = r === null;
  byId('turns-card').hidden = r === null;
  if (!r) return;

  byId('goal').textContent = r.goal;
  const top = byId('notes-top');
  const modelNote = r.notes[r.notes.length - 1]!;
  top.replaceChildren(...r.notes.slice(0, -1).map((n) => el('p', n.text, `note ${n.kind}`)));
  byId('note-model').textContent = modelNote.text;

  fillTable('opening', r.opening.map((o) => [o.mulligans, o.handSize, o.works, o.keepHere, o.keptSoFar]));
  byId('fail').textContent = r.fail;
  const head = byId<HTMLTableElement>('turns').tHead!.rows[0]!;
  head.replaceChildren(
    ...['Turn', 'Cards drawn', 'With mulligans', 'No mulligan', ...r.averageHeaders].map((h, i) => {
      const th = el('th', h, i >= 4 ? 'avg' : undefined);
      th.setAttribute('scope', 'col');
      return th;
    }),
  );
  fillTable('turns', r.turns.map((t) => [t.turn, t.draws, t.withMulligan, t.noMulligan, ...t.copies]));
  renderExplainer(r.explainer);
  drawCharts(r.chart, r.averageChart);

  if (location.hash !== r.share) history.replaceState(null, '', r.share);
}

function renderExplainer(ex: Explainer): void {
  const box = byId('explainer');
  const parts: HTMLElement[] = [el('h3', ex.title)];
  for (const part of ex.parts) {
    parts.push(el('h4', part.heading));
    for (const text of part.paragraphs) parts.push(el('p', text));
    if (part.items.length > 0) {
      const list = el('ul');
      list.append(...part.items.map((t) => el('li', t)));
      parts.push(list);
    }
  }
  box.replaceChildren(...parts);
}

// ---- charts ----

let chartRows: ChartRow[] = [];
let averageData: AverageChart = { names: [], rows: [] };
let drawnWidth = 0;
const AVG_STYLES = 6;

/** One marker shape per style, so the lines differ by shape as well as colour and dash. */
function marker(style: number, x: number, y: number, className: string): SVGElement {
  switch (style % AVG_STYLES) {
    case 0:
      return svg('circle', { cx: x, cy: y, r: 4, class: className });
    case 1:
      return svg('rect', { x: x - 4, y: y - 4, width: 8, height: 8, class: className });
    case 2:
      return svg('path', { d: `M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z`, class: className });
    case 3:
      return svg('path', { d: `M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`, class: className });
    case 4:
      return svg('path', { d: `M${x} ${y + 5}L${x + 5} ${y - 4}L${x - 5} ${y - 4}Z`, class: className });
    default:
      return svg('path', { d: `M${x - 4} ${y - 1.5}H${x - 1.5}V${y - 4}H${x + 1.5}V${y - 1.5}H${x + 4}V${y + 1.5}H${x + 1.5}V${y + 4}H${x - 1.5}V${y + 1.5}H${x - 4}Z`, class: className });
  }
}

/** A small line-and-marker key, as in the chart. */
function key(lineClass: string, style: number, markerClass: string): SVGSVGElement {
  const k = svg('svg', { width: 28, height: 10, viewBox: '0 0 28 10', 'aria-hidden': 'true' });
  k.append(svg('line', { x1: 1, y1: 5, x2: 27, y2: 5, class: lineClass }), marker(style, 14, 5, markerClass));
  return k;
}

interface Axes {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  description: string;
}

function chartFrame(geo: Axes): { root: SVGSVGElement; cross: SVGLineElement } {
  const root = svg('svg', { viewBox: `0 0 ${geo.width} ${geo.height}`, width: geo.width, height: geo.height, role: 'img', tabindex: 0 });
  const title = svg('title', {});
  title.textContent = geo.description;
  root.append(title);
  geo.yTicks.forEach((t, i) => {
    root.append(svg('line', { x1: geo.plot.left, x2: geo.plot.right, y1: t.y, y2: t.y, class: i === 0 ? 'baseline' : 'gridline' }));
    const label = svg('text', { x: geo.plot.left - 8, y: t.y + 4, 'text-anchor': 'end', class: 'tick' });
    label.textContent = t.label;
    root.append(label);
  });
  for (const t of geo.xTicks) {
    const label = svg('text', { x: t.x, y: geo.plot.bottom + 18, 'text-anchor': 'middle', class: 'tick' });
    label.textContent = t.label;
    root.append(label);
  }
  const axisName = svg('text', { x: geo.plot.left - 12, y: geo.plot.bottom + 18, 'text-anchor': 'end', class: 'tick' });
  axisName.textContent = 'Turn';
  root.append(axisName);
  const cross = svg('line', { x1: 0, x2: 0, y1: geo.plot.top, y2: geo.plot.bottom, class: 'crosshair', visibility: 'hidden' });
  root.append(cross);
  return { root, cross };
}

function drawCharts(rows: ChartRow[], averages: AverageChart): void {
  chartRows = rows;
  averageData = averages;
  const box = byId<HTMLDivElement>('chart');
  const width = Math.max(280, Math.round(box.clientWidth || 640));
  drawnWidth = box.clientWidth;
  const size = { width, height: width < 480 ? 220 : 280 };

  const geo = chartGeometry(rows, size);
  const odds = chartFrame(geo);
  for (const s of geo.series) {
    odds.root.append(svg('path', { d: s.path, class: `line ${s.key}` }));
    for (const p of s.points) odds.root.append(marker(s.key === 'with' ? 0 : 1, p.x, p.y, `marker ${s.key}`));
  }
  for (const l of geo.endLabels) {
    const text = svg('text', { x: l.x, y: l.y, class: 'end-label' });
    text.textContent = l.text;
    odds.root.append(text);
  }
  const xs = geo.series[0]?.points.map((p) => p.x) ?? [];

  const avgBox = byId<HTMLDivElement>('avg-chart');
  const ag = averageGeometry(averages.rows, averages.names, { width, height: width < 480 ? 200 : 240 });
  const avg = chartFrame(ag);
  for (const s of ag.series) {
    avg.root.append(svg('path', { d: s.path, class: `line s${s.style % AVG_STYLES}` }));
    for (const p of s.points) avg.root.append(marker(s.style, p.x, p.y, `marker s${s.style % AVG_STYLES}`));
  }
  for (const l of ag.endLabels) {
    const text = svg('text', { x: l.x, y: l.y, class: 'end-label' });
    text.textContent = l.text;
    avg.root.append(text);
  }
  byId('avg-legend').replaceChildren(
    ...averages.names.map((name, i) => {
      const li = el('li');
      li.append(key(`key s${i % AVG_STYLES}`, i, `marker s${i % AVG_STYLES}`), el('span', name));
      return li;
    }),
  );
  byId('avg-panel').hidden = averages.names.length === 0;

  const oddsTip = el('div', undefined, 'tooltip');
  const avgTip = el('div', undefined, 'tooltip');
  oddsTip.hidden = true;
  avgTip.hidden = true;
  attachHover(odds.root, odds.cross, oddsTip, xs, geo.width);
  attachHover(avg.root, avg.cross, avgTip, xs, ag.width);
  box.replaceChildren(odds.root, oddsTip);
  avgBox.replaceChildren(avg.root, avgTip);
}

/** The hover box: both odds and every group's average for one turn. Text only through textContent. */
function tooltipContent(index: number): HTMLElement[] {
  const row = chartRows[index]!;
  const out: HTMLElement[] = [el('p', `Turn ${row.turn}`, 'turn')];
  const line = (k: SVGSVGElement, value: string, who: string): HTMLParagraphElement => {
    const p = el('p');
    p.append(k, el('strong', value), el('span', who, 'who'));
    return p;
  };
  out.push(line(key('key-with', 0, 'mark-with'), formatPercent(row.withMulligan), SERIES_LABELS.with));
  out.push(line(key('key-no', 1, 'mark-no'), formatPercent(row.noMulligan), SERIES_LABELS.no));
  const avg = averageData.rows[index];
  if (avg && averageData.names.length > 0) {
    out.push(el('p', 'Average copies seen (no mulligan)', 'turn'));
    averageData.names.forEach((name, i) => {
      out.push(line(key(`key s${i % AVG_STYLES}`, i, `marker s${i % AVG_STYLES}`), avg.copies[i]!.toFixed(2), name));
    });
  }
  return out;
}

function attachHover(root: SVGSVGElement, cross: SVGLineElement, tip: HTMLDivElement, xs: number[], width: number): void {
  let index = -1;
  const show = (i: number): void => {
    if (xs.length === 0) return;
    index = Math.max(0, Math.min(i, xs.length - 1));
    const x = xs[index]!;
    cross.setAttribute('x1', String(x));
    cross.setAttribute('x2', String(x));
    cross.setAttribute('visibility', 'visible');
    tip.replaceChildren(...tooltipContent(index));
    tip.hidden = false;
    const scale = root.clientWidth / width || 1;
    const boxWidth = root.clientWidth;
    tip.style.left = `${Math.min(Math.max(0, x * scale + 12), Math.max(0, boxWidth - tip.offsetWidth))}px`;
  };
  const hide = (): void => {
    cross.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  const nearest = (px: number): number => {
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i]! - px) < Math.abs(xs[best]! - px)) best = i;
    return best;
  };
  root.addEventListener('pointermove', (e) => {
    const rect = root.getBoundingClientRect();
    show(nearest(((e.clientX - rect.left) * width) / rect.width));
  });
  root.addEventListener('pointerleave', hide);
  root.addEventListener('focus', () => show(index < 0 ? 0 : index));
  root.addEventListener('blur', hide);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'Escape') hide();
    else return;
    e.preventDefault();
  });
}

// ---- simulation ----

function stopSimulation(message = ''): void {
  if (sim) window.clearTimeout(sim.timer);
  sim = null;
  byId<HTMLButtonElement>('run-sim').disabled = false;
  byId('sim-progress').textContent = message;
}

function runSimulation(): void {
  const r = lastView?.results;
  if (!r) return;
  stopSimulation();
  byId('sim-result').hidden = true;
  const inputs = r.inputs;
  const run = createSimulation(inputs);
  byId<HTMLButtonElement>('run-sim').disabled = true;
  const step = (): void => {
    if (!sim || sim.run !== run) return;
    run.run(SIM_PART);
    byId('sim-progress').textContent = `Running: ${Math.floor((100 * run.completed) / inputs.trials)}% (${run.completed.toLocaleString('en-US')} of ${inputs.trials.toLocaleString('en-US')} trials)`;
    if (run.done) {
      showSimulation(inputs, run);
      stopSimulation(`Done: ${inputs.trials.toLocaleString('en-US')} trials.`);
    } else {
      sim.timer = window.setTimeout(step, 0);
    }
  };
  sim = { run, inputs, timer: window.setTimeout(step, 0) };
}

function showSimulation(inputs: Inputs, run: Simulation): void {
  const v = simulationView(inputs, run.result());
  const overall = byId('sim-overall');
  overall.textContent = v.overall;
  overall.className = `overall ${v.allAgree ? 'agrees' : 'check'}`;
  fillTable(
    'sim',
    v.rows.map((s) => [s.label, s.exact, s.simulated, s.se, s.verdict === 'agrees' ? 'Agrees' : 'Check this']),
    v.rows.map((s) => [undefined, undefined, undefined, undefined, s.verdict === 'agrees' ? 'agrees' : 'check']),
  );
  byId('sim-result').hidden = false;
}

// ---- link ----

function showLinkIssues(messages: string[]): void {
  const banner = byId('link-banner');
  byId('link-issues').replaceChildren(...messages.map((m) => el('li', m)));
  banner.hidden = messages.length === 0;
}

function loadFromHash(): void {
  const decoded = decodeShare(location.hash);
  showLinkIssues(decoded.issues.map((i) => i.message));
  fillForm(formFromInputs(decoded.raw));
  update();
}

async function copyLink(): Promise<void> {
  const status = byId('copy-status');
  const url = location.href;
  try {
    if (!navigator.clipboard) throw new Error('no clipboard');
    await navigator.clipboard.writeText(url);
    status.textContent = 'Link copied.';
  } catch {
    const field = byId<HTMLInputElement>('link-text');
    byId('link-label').hidden = false;
    field.hidden = false;
    field.value = url;
    field.focus();
    field.select();
    status.textContent = 'Copy the link from the box above.';
  }
}

// ---- wiring ----

function update(): void {
  if (sim) {
    stopSimulation('The inputs changed, so the simulation stopped.');
  }
  byId('sim-result').hidden = true;
  render(buildView(readForm()));
}

byId('inputs').addEventListener('input', update);
for (const id of ['seed', 'trials']) byId(id).addEventListener('input', update);
byId('add-group').addEventListener('click', () => {
  const form = readForm();
  if (form.groups.length >= MAX_GROUPS) return;
  form.groups.push({ name: `Group ${form.groups.length + 1}`, copies: '4', least: '1', most: '' });
  fillForm(form);
  update();
  fieldInput(`groups.${form.groups.length - 1}.name`)?.focus();
});
byId('run-sim').addEventListener('click', runSimulation);
byId('copy-link').addEventListener('click', () => void copyLink());
window.addEventListener('hashchange', loadFromHash);
// The first draw can run before the layout settles, so redraw whenever the chart box changes width.
new ResizeObserver(() => {
  const width = byId('chart').clientWidth;
  if (width > 0 && width !== drawnWidth && chartRows.length > 0) drawCharts(chartRows, averageData);
}).observe(byId('chart'));

loadFromHash();
