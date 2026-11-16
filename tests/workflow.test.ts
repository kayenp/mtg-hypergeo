import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

test('every action in the Pages workflow is pinned to a full commit hash', () => {
  const uses = workflow.split('\n').filter((line) => /^\s*(-\s+)?uses:/.test(line));
  assert.ok(uses.length >= 5, `found ${uses.length} uses lines`);
  for (const line of uses) assert.match(line, /uses:\s+[\w.-]+\/[\w.-]+@[0-9a-f]{40}\s+#\s+v\d/, line);
});
