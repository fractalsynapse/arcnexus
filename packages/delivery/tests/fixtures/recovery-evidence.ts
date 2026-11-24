import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HostTask } from '../../../execution/src/index.js';
import type { CheckResult } from '../../../execution/src/check.js';

/** Inspect complete process outputs and input bindings before the controlled reviewer answers. */
export function assertExecutedChecks(task: HostTask, checks: readonly CheckResult[]) {
  const baseline = readFileSync(join(task.worktree!, 'baseline'), 'utf8');
  const checked = readFileSync(join(task.worktree!, 'checked.txt'), 'utf8');
  for (const check of checks) {
    const phase = check.id === 'fixture-check' ? 'original' : 'current';
    assert.equal(check.command, process.execPath);
    assert.deepEqual(check.args, ['recovery-check.mjs', phase]);
    assert.equal(check.cwd, task.worktree);
    assert.equal(check.prerequisite, undefined);
    const status = phase === 'current' && baseline !== 'durable evidence\n' ? 1 : 0;
    assert.equal(check.status, status);
    const output = JSON.stringify({ phase, cwd: check.cwd, checked, baseline }) + '\n';
    const diagnostic = status ? 'Recovered required command rejected baseline:\n' + baseline : '';
    assert.equal(readFileSync(check.log, 'utf8'), output + diagnostic);
    const observed = task.observations<{
      check?: CheckResult; checkInput?: string; reusedFrom?: string;
    }>().findLast((event) => event.check?.log === check.log);
    assert.match(observed?.checkInput ?? '', /^[a-f0-9]{64}$/);
    assert.deepEqual(observed?.check, check);
  }
}
