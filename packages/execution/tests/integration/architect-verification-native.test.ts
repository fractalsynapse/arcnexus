import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { CheckResult } from '../../src/check.js';
import type { HostTask } from '../../src/index.js';
import { ArchitectVerificationFixture } from '../fixtures/architect-verification.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['native', 'regression'],
} as const;

const signal = new AbortController().signal;
const native = { skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1' };

// These cases require the trusted Host: ordinary owner checks deny nested user namespaces.
// A skipped case supplies no native evidence; select it explicitly for the implementation checkpoint.

// Real Git, candidate compiler output, Cordis CLI composition and Bubblewrap establish
// command evidence. The controlled Agent establishes response handling, never live inference.
for (const kind of ['proposal', 'no-change'] as const) {
  test(`Architect ${kind} uses the MCP binding and rejects changed inputs`, native, async (t) => {
    const fixture = new ArchitectVerificationFixture(t, true);
    const task = await fixture.open();
    fixture.diagnose(task);
    const direct = await fixture.direct(task);
    assert.equal(direct.status, 0, readFileSync(direct.log, 'utf8'));
    const report = parseReport(readFileSync(direct.log, 'utf8'));
    assert.deepEqual(report.findings, []);
    assert(report.paths.includes('baseline'));
    fixture.respond(t, kind);
    task.ask = async () => 'skip';
    await fixture.architecture.propose(fixture.agent, task, 'unchanged', signal);
    assertParity(task, direct);
    await rejectChangedInputs(fixture, task, direct);
    assert.equal(readFileSync(join(task.worktree!, 'baseline'), 'utf8'), 'durable evidence\n');
  });

  test(`Architect ${kind} cannot complete with an unavailable executable`, native, async (t) => {
    const fixture = new ArchitectVerificationFixture(t, true, '/missing/approved-audit-executable');
    const task = await fixture.open();
    fixture.respond(t, kind);
    await assert.rejects(
      fixture.architecture.propose(fixture.agent, task, undefined, signal),
      /declared-audit|approved-audit-executable|exited/,
    );
    const failed = observations(task).findLast(
      (check) => typeof check.status === 'number' && check.status !== 0,
    );
    assert(failed, 'an unavailable executable must retain its real failure');
    assert.equal(failed.command, '/missing/approved-audit-executable');
    assert.match(readFileSync(failed.log, 'utf8'), /approved-audit-executable/);
    assert(!task.observations<any>().some((event) => event.architectureAdoption));
    assert.equal(task.capture.source.revision, task.config.capture.source.revision);
  });
}

test('candidate report parsing retains JSON values alongside complete process diagnostics', () => {
  const report = {
    source: { revision: 'captured' },
    paths: ['baseline', 'literal } café'],
    findings: [],
  };
  const json = JSON.stringify(report, null, 2);
  const warning = '(node:123) ExperimentalWarning: SQLite is an experimental feature\n';
  for (const log of [warning + json, json + '\n' + warning])
    assert.deepEqual(parseReport(log), report);
  assert.throws(() => parseReport(warning), /Missing ownership JSON report/);
  assert.throws(() => parseReport('{\ninvalid\n}\n' + warning), SyntaxError);
});

/** Read the CLI's pretty-printed JSON object without rewriting the combined stdout/stderr log. */
function parseReport(log: string) {
  const report = log.match(/^\{[\s\S]*?^\}/m)?.[0];
  assert(report, 'Missing ownership JSON report in complete command log:\n' + log);
  return JSON.parse(report);
}

/** Require automatic completion to resolve the same command, parameters and directory as MCP. */
function assertParity(task: HostTask, direct: CheckResult) {
  const completed = observations(task);
  assert(completed.length > 1, 'automatic completion must validate the same binding');
  assert.deepEqual(completed.at(-1)!.args, direct.args);
  assert.equal(completed.at(-1)!.command, direct.command);
  assert.equal(completed.at(-1)!.cwd, direct.cwd);
}

/** Dirty inventory must invalidate the previous successful observation without erasing its log. */
async function rejectChangedInputs(
  fixture: ArchitectVerificationFixture,
  task: HostTask,
  direct: CheckResult,
) {
  writeFileSync(join(task.worktree!, 'unowned café.txt'), 'Changed audited Git inventory\n');
  await assert.rejects(
    fixture.architecture.propose(fixture.agent, task, 'changed', signal),
    /declared-audit|exited 1|ownership|uncovered/i,
  );
  const failed = observations(task).findLast((check) => check.status === 1);
  assert(failed, 'fresh ownership failure must replace applicability of the earlier pass');
  assert.notEqual(failed.log, direct.log);
  assert.match(readFileSync(failed.log, 'utf8'), /unowned café.txt/);
  assert(existsSync(direct.log), 'historical passing evidence remains readable');
  console.log(
    JSON.stringify({
      direct,
      failed,
      runtime: process.versions,
      candidate: task.capture.source.revision,
    }),
  );
}

/** Read actual host observations, including reused checks and original failed logs. */
function observations(task: HostTask) {
  return task.observations<{ check?: CheckResult }>().flatMap((event) => event.check ?? []);
}
