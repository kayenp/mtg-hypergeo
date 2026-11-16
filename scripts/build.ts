// Builds dist/index.html: one file with the script and the styles inside it, so it works from disk.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inlinePage } from './inline.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const at = (p: string): string => `${root}${p}`;

const bundle = await build({
  entryPoints: [at('src/ui/main.ts')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: ['es2022'],
  legalComments: 'none',
});
const js = bundle.outputFiles[0]!.text;
const [html, css] = await Promise.all([readFile(at('src/ui/index.html'), 'utf8'), readFile(at('src/ui/style.css'), 'utf8')]);
const page = inlinePage(html, css, js);
await mkdir(at('dist'), { recursive: true });
await writeFile(at('dist/index.html'), page);
console.log(`dist/index.html: ${(page.length / 1024).toFixed(1)} KiB`);
