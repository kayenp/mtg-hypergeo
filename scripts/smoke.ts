// Opens the built page from disk in headless Chrome and checks what it shows.
// Run it after `npm run build`. It exits non-zero on any failed check.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const page = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const failures: string[] = [];
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

function findChrome(): string {
  const fromEnv = process.env.CHROME_BIN;
  if (fromEnv) {
    if (existsSync(fromEnv)) return fromEnv;
    console.error(`Smoke test: CHROME_BIN is set to "${fromEnv}", but no file is there.`);
    process.exit(1);
  }
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [name], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  console.error('Smoke test: no Chrome found. Install Google Chrome or Chromium, then run it again.');
  process.exit(1);
}

function dumpDom(chrome: string, fragment: string): string {
  const profile = mkdtempSync(join(tmpdir(), 'mtg-hypergeo-smoke-'));
  try {
    const run = spawnSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        `--user-data-dir=${profile}`,
        '--virtual-time-budget=2000',
        '--dump-dom',
        `file://${page}#${fragment}`,
      ],
      { encoding: 'utf8', timeout: 60_000 },
    );
    if (run.status !== 0) throw new Error(`Chrome exited with ${run.status}: ${run.stderr}`);
    // Chrome prints nothing when a script opens a dialog such as alert(), so an empty dump is itself a failure.
    check(run.stdout.includes('id="opening"'), `the page rendered for #${fragment.slice(0, 40)}...`);
    return run.stdout;
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

if (!existsSync(page)) {
  console.error('Smoke test: dist/index.html is missing. Run "npm run build" first.');
  process.exit(1);
}

// [R16] The page must load nothing: no script, style, image or frame from a file or a URL, and no request in code.
const html = readFileSync(page, 'utf8');
check(!/<(script|link|img|iframe|object|embed|source|video|audio)\b[^>]*\b(src|href)\s*=/i.test(html), 'no element loads a file or URL');
check(!/@import/i.test(html), 'no CSS @import');
check(!/url\(/i.test(html), 'no CSS url()');
check(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(html), 'no request in the script');
check(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'no URL other than the SVG namespace');

const chrome = findChrome();
const tail = 'min=5&free=0&otp=1&turns=10&seed=1&trials=100000';

const plain = dumpDom(chrome, `v=1&n=60&g=4.1..Key%20card&${tail}`);
// The by-turn table can hold the same number, so look in the first row of the opening hand table.
check(
  /<table id="opening">[\s\S]*?<tbody><tr><th scope="row">0<\/th><td>7<\/td><td>39\.95%<\/td>/.test(plain),
  'one group of 4 in 60 shows 39.95% in the first opening hand row',
);
check(/<div id="link-banner"[^>]*\shidden/.test(plain), 'no link banner on a good link');

// [R20] A name with HTML must stay text.
// [R14] [R21] The explainer and the average copies show for 24 lands in 60 on the play.
const lands = dumpDom(chrome, `v=1&n=60&g=24.2.4.Lands&${tail}`);
check(/<h3[^>]*>How to read these numbers<\/h3>/.test(lands), 'the heading "How to read these numbers" shows');
check(
  /<table id="turns">[\s\S]*?<tbody><tr><th scope="row">1<\/th><td>0<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>2\.80<\/td>/.test(lands),
  'the first by-turn row shows 2.80 average lands',
);

const evil = '<img src=x onerror=alert(1)>';
const xss = dumpDom(chrome, `v=1&n=60&g=4.1..${encodeURIComponent(evil)}&${tail}`);
check(!/<img\b[^>]*\bsrc="?x/i.test(xss), 'a group name with HTML makes no img element');
check(xss.includes('&lt;img src=x onerror=alert(1)&gt;'), 'the group name shows as text');
check(/<th[^>]*scope="col"[^>]*>&lt;img src=x onerror=alert\(1\)&gt;<\/th>/.test(xss), 'the group name shows as text in the table header');

const bad = dumpDom(chrome, `v=1&n=abc&g=4.1..A&${tail}`);
check(/<div id="link-banner"(?![^>]*\shidden)[^>]*>/.test(bad) && bad.includes('deck size'), 'a bad link shows the banner and names the field');

if (failures.length > 0) {
  console.error(`Smoke test: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('Smoke test: all checks passed.');
