import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { executeDirect } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

test('observed nonzero exit is structured evidence while cancellation remains fatal', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-command-failure-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await assert.rejects(
    executeDirect(
      { command: process.execPath, args: ['-e', 'process.exit(7)'] },
      root,
      join(root, 'failed.log'),
      new AbortController().signal,
    ),
    (error: any) => error.observedExitFailure === true && error.commandResult.exitCode === 7,
  );
  await assert.rejects(
    executeDirect(
      { command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
      root,
      join(root, 'cancelled.log'),
      AbortSignal.timeout(100),
    ),
    (error: any) => error.observedExitFailure !== true,
  );
});

registerSuite({ component: 'operations', level: 'integration', tags: ['deterministic'] });
