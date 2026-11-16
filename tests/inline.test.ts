import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlinePage } from '../scripts/inline.ts';

const page = '<!doctype html><head><!--STYLE--></head><body><p>x</p><!--SCRIPT--></body>';

test('the CSS and the script go in place of their markers', () => {
  const out = inlinePage(page, 'p{color:red}', 'console.log(1)');
  assert.equal(out, '<!doctype html><head><style>p{color:red}</style></head><body><p>x</p><script>console.log(1)</script></body>');
});

test('$& and other replacement patterns in the bundle stay as they are', () => {
  const js = 'const a = "$&"; const b = "$1$$"; const c = "$`$\'";';
  const out = inlinePage(page, '', js);
  assert.ok(out.includes(`<script>${js}</script>`), out);
});

test('a </script> inside the bundle cannot close the script element', () => {
  const out = inlinePage(page, '', 'const s = "</script><b>"; const t = "</SCRIPT >";');
  assert.equal((out.match(/<\/script/gi) ?? []).length, 1, out);
  assert.ok(out.includes('"<\\/script><b>"'));
  assert.ok(out.includes('"<\\/SCRIPT >"'));
});

test('a </style> inside the CSS cannot close the style element', () => {
  const out = inlinePage(page, 'a::after{content:"</style>"}', '');
  assert.equal((out.match(/<\/style/gi) ?? []).length, 1, out);
});

test('a page without the markers is an error', () => {
  assert.throws(() => inlinePage('<html></html>', '', ''), /marker/);
});
