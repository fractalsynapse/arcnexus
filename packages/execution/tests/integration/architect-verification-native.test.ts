import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { CheckResult } from '../../src/check.js';
import { ArchitectVerificationFixture, audit } from '../fixtures/architect-verification.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['native', 'regression'] } as const;
const native = { skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1' };
const signal = new AbortController().signal;

// Real Git, candidate compiler output, Cordis CLI composition and Bubblewrap establish
// command evidence. The controlled Agent establishes response handling, never live inference.
for (const kind of ['proposal', 'no-change'] as const) {
  test('Architect ' + kind + ' uses the direct MCP binding and rejects changed audit inputs', native, async (t) => {
    const fixture = new ArchitectVerificationFixture(t, true);
    const task = await fixture.open();
    fixture.diagnose(task);
    const direct = await fixture.direct(task);
    assert.equal(direct.status, 0, readFileSync(direct.log, 'utf8'));
    const report = JSON.parse(readFileSync(direct.log, 'utf8'));
    assert.deepEqual(report.findings, []);
    assert(report.paths.includes('baseline'));
    fixture.respond(t, kind);
    task.ask = async () => 'skip';
    await fixture.architecture.propose(fixture.agent, task, 'unchanged', signal);
    const completed = observations(task);
    assert(completed.length > 1, 'automatic completion must validate the same binding');
    assert.deepEqual(completed.at(-1)!.args, direct.args);
    assert.equal(completed.at(-1)!.command, direct.command);
    assert.equal(completed.at(-1)!.cwd, direct.cwd);
    writeFileSync(join(task.worktree!, 'unowned café.txt'), 'Changed audited Git inventory\n');
    await assert.rejects(
      fixture.architecture.propose(fixture.agent, task, 'changed', signal),
      /declared-audit|exited 1|ownership|uncovered/i,
    );
    const failed = observations(task).findLast((check) => check.status === 1);
    assert(failed, 'fresh ownership failure must replace applicability of the earlier pass');
    assert.notEqual(failed.log, direct.log);
    assert.match(readFileSync(failed.log, 'utf8'), /unowned café.txt/);
    assert.equal(readFileSync(join(task.worktree!, 'baseline'), 'utf8'), 'durable evidence\n');
    assert(existsSync(direct.log), 'historical passing evidence remains readable');
    t.diagnostic(JSON.stringify({ direct, failed, runtime: process.versions,
      candidate: task.capture.source.revision }));
  });

  test('Architect ' + kind + ' cannot complete with an unavailable confined executable', native, async (t) => {
    const fixture = new ArchitectVerificationFixture(t, true);
    const task = await fixture.open();
    task.capture.operations[audit]!.command = '/missing/approved-audit-executable';
    fixture.respond(t, kind);
    await assert.rejects(
      fixture.architecture.propose(fixture.agent, task, undefined, signal),
      /declared-audit|approved-audit-executable|exited/,
    );
    const failed = observations(task).findLast((check) => typeof check.status === 'number' && check.status !== 0);
    assert(failed, 'an unavailable executable must retain its real failure');
    assert.equal(failed.command, '/missing/approved-audit-executable');
    assert.match(readFileSync(failed.log, 'utf8'), /approved-audit-executable/);
    assert(!task.observations<any>().some((event) => event.architectureAdoption));
    assert.equal(task.capture.source.revision, task.config.capture.source.revision);
  });
}

/** Read actual host observations, including reused checks and original failed logs. */
function observations(task: Awaited<ReturnType<ArchitectVerificationFixture['open']>>) {
  return task.observations<{ check?: CheckResult }>().flatMap((event) => event.check ?? []);
}
