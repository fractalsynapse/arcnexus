import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { installProvider } from '../fixtures/refinement-install.js';

export const suite = { owner: 'workflow', level: 'integration', tags: ['regression'] } as const;

const answer = 'Complete launch characterization answer.\nIts final conclusion survives.';

/** Retain actual launch diagnostics before checking runtime and complete provider output. */
function launch(t: TestContext, executable: string, path: string) {
  const result = spawnSync(executable, [], {
    env: { PATH: path, LANG: 'C.UTF-8' },
    encoding: 'utf8',
    input: JSON.stringify({
      attempt: 1,
      clarifications: [{ question: 'Complete answer 1', answer }],
    }),
  });
  t.diagnostic(JSON.stringify({
    executable, selectedRuntime: process.execPath, selectedVersion: process.version,
    env: { PATH: path, LANG: 'C.UTF-8' }, ...result,
  }));
  return { path, result };
}

/** Reject interpreter lookup and require complete finding, answer and provider-reported usage. */
function assertLaunch({ path, result }: ReturnType<typeof launch>) {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n').map((line) => JSON.parse(line)), [
    { type: 'fixture.runtime', executable: process.execPath, version: process.version, path },
    { type: 'item.completed', item: { type: 'agent_message',
      text: JSON.stringify({ finding: 'Provider finding attempt 1', answer }) } },
    { type: 'turn.completed', usage: { input_tokens: 19, output_tokens: 7 } },
  ]);
}

test('installed recovery provider selects the test runtime independently of PATH', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'refinement-provider-runtime-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.git'));
  const emptyPath = join(root, 'empty-bin');
  mkdirSync(emptyPath);
  const executable = installProvider(root);
  const confined = launch(t, executable, '/usr/bin:/bin');
  const withoutLookup = launch(t, executable, emptyPath);
  assertLaunch(confined);
  assertLaunch(withoutLookup);
});
