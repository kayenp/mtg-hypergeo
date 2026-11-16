import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nodeVersionProblem } from '../scripts/check-node.mjs';

const script = fileURLToPath(new URL('../scripts/check-node.mjs', import.meta.url));

test('Node 22 is refused with a message that names both versions', () => {
  const problem = nodeVersionProblem('22.22.1');
  assert.ok(problem !== null);
  assert.match(problem, /24/);
  assert.match(problem, /22\.22\.1/);
});

test('Node 24 and newer are accepted', () => {
  assert.equal(nodeVersionProblem('24.21.0'), null);
  assert.equal(nodeVersionProblem('25.0.0'), null);
});

test('a version string that does not parse is refused', () => {
  assert.notEqual(nodeVersionProblem('garbage'), null);
});

test('the script exits 0 on the Node that runs the tests', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
