import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { TestProcess } from '../../testing/support/test-process.js';
import {
  cli,
  stewardEntry,
  minimalWorkflowFixture as workflowFixture,
} from '../../testing/support/workflow-fixture.js';

/** Exercises steward behavior through observable scenarios. */
class StewardTests {
  /** Verifies the scenario uses explicit sdk settings. */
  usesExplicitSdkSettings(t: TestContext, expected: string) {
    const f = workflowFixture(t);
    const path = join(f.repo, 'architecture/execution-profiles/luna.yaml');
    const profile = JSON.parse(readFileSync(path, 'utf8'));
    if (profile.model !== expected) {
      writeFileSync(path, JSON.stringify({ ...profile, model: expected }));
      f.commit();
    }
    const r = f.run();
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    assert.equal(v.settings.model, expected);
    assert.equal(v.settings.reasoning, 'medium');
    assert.equal(v.settings.webSearch, 'disabled');
    assert.equal(v.settings.network, false);
    assert.equal(v.settings.approval, 'never');
    assert.equal(v.settings.nestedDelegation, false);
    const calls = readFileSync(f.calls, 'utf8')
      .trim()
      .split('\n')
      .map((line: string) => JSON.parse(line));
    for (const c of calls) {
      assert.equal(c.args[c.args.indexOf('--model') + 1], expected);
      assert.ok(c.args.includes('--ignore-user-config'));
    }
    assert.deepEqual(v.settings.access.writeDirectories, []);
  }

  /** Rejects caller quota options on the prompt-only public task interface before inference. */
  quotaOptionsFailBeforeInference(t: TestContext) {
    const f = workflowFixture(t);
    for (const value of ['0', '1', '3']) {
      const result = spawnSync(
        process.execPath,
        [cli, 'task', 'run', 'Improve behavior', '--max-attempts', value],
        {
          cwd: f.repo,
          env: f.env,
          encoding: 'utf8',
          timeout: 15_000,
        },
      );
      assert.equal(result.status, 2, result.stderr);
    }
    assert.equal(existsSync(f.calls), false);
  }

  /** Verifies that baseline failure prevents activation. */
  baselineFailurePreventsActivation(t: TestContext) {
    const f = workflowFixture(t);
    writeFileSync(join(f.repo, 'source.txt'), 'broken');
    f.commit();
    const r = f.run();
    assert.equal(r.status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(JSON.parse(r.stdout).stage, 'baseline');
  }

  /** Verifies the scenario stops invalid activation. */
  stopsInvalidActivation(t: TestContext, mode: any) {
    const f = workflowFixture(t, mode),
      r = f.run();
    assert.equal(r.status, 1);
    assert.notEqual(JSON.parse(r.stdout).status, 'completed');
  }

  /** Verifies that target codex configuration is rejected before activation. */
  targetCodexConfigurationIsRejectedBeforeActivation(t: TestContext) {
    const f = workflowFixture(t);
    mkdirSync(join(f.repo, '.codex'));
    writeFileSync(join(f.repo, '.codex/config.toml'), 'model="unwanted"');
    f.commit();
    const r = f.run();
    assert.equal(r.status, 2);
    assert.equal(existsSync(f.calls), false);
  }

  /** Cancels an observed model stage while preserving its raw partial-turn evidence. */
  async retainsInterruptedTurnEvidence(t: TestContext, activity: string) {
    const f = workflowFixture(t, activity + '-timeout');
    const child = this.start(t, f, activity === 'review' ? 'review' : 'change');
    await child.waitForReady(
      () => readFileSync(f.calls, 'utf8').includes(`"stage":"${activity}"`),
      'Agent must reach selected stage',
    );
    child.kill('SIGINT');
    assert.equal(await child.closed, 130);
    const v = JSON.parse(child.stdout);
    assert.equal(v.status, 'cancelled');
    assert.ok(
      existsSync(join(f.state, 'runs', v.id, 'turns', String(v.turns.length), 'events.jsonl')),
    );
    assert.equal(existsSync(join(f.state, 'active.lock')), false);
  }

  /** Starts bound minimal engineering with test-owned process cleanup and no execution deadline. */
  private start(t: TestContext, f: any, kind = 'change'): TestProcess {
    return new TestProcess(
      t,
      [
        stewardEntry,
        'run',
        'sample',
        'Improve behavior',
        '--kind',
        kind,
        '--project',
        f.repo,
        '--codex-path',
        f.executable,
        '--bindings',
        join(f.root, 'minimal-bindings.json'),
      ],
      f.env,
    );
  }

  /** Declares a verified host operation route alongside an optional direct-shell limitation. */
  private hostReady(f: any): boolean {
    return readdirSync(join(f.state, 'runs')).some((id) => {
      const run = join(f.state, 'runs', id);
      return readdirSync(run)
        .filter((path) => path.startsWith('invocation-') && path.endsWith('.log'))
        .some((path) => readFileSync(join(run, path), 'utf8').includes('HOST_READY'));
    });
  }

  /** Executes the inspected assignment with the same captured shared verification definition. */
  inspectedSharedVerification(t: TestContext) {
    const f = workflowFixture(t),
      args = this.explicitAssignment(f);
    const preview = spawnSync(process.execPath, [cli, 'inspect', ...args, '--json'], {
      encoding: 'utf8',
    });
    assert.equal(preview.status, 0, preview.stderr);
    const result = spawnSync(
      process.execPath,
      [stewardEntry, 'run', ...args, '--codex-path', f.executable],
      {
        encoding: 'utf8',
        env: f.env,
        timeout: 30 * 60 * 1000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout),
      inspected = JSON.parse(preview.stdout);
    assert.equal(record.resolvedAssignment.digest, inspected.digest);
    const operation = inspected.context.at(-1).verification.find((op: any) => op.id === 'verify');
    assert.ok(
      record.operationInvocations.some(
        (invocation: any) =>
          invocation.purpose === 'verification' &&
          invocation.definitionDigest === operation.definitionDigest &&
          invocation.result.exitCode === 0,
      ),
    );
  }

  /** Supplies explicit goal criteria while deriving every executable check from captured shared operations. */
  private explicitAssignment(f: any): string[] {
    const file = join(f.root, 'assignment.json');
    writeFileSync(
      file,
      JSON.stringify({
        schemaVersion: 3,
        objective: 'Improve behavior',
        kind: 'change',
        expectedOutcome: 'Source after',
        acceptanceCriteria: ['Observed shared verification passes'],
        hostChecks: [],
      }),
    );
    return [
      'sample',
      '--assignment',
      file,
      '--project',
      f.repo,
      '--bindings',
      join(f.root, 'minimal-bindings.json'),
    ];
  }

  /** Verifies that final host verification cannot mutate maintained source. */
  finalHostVerificationCannotMutateMaintainedSource(t: TestContext) {
    const f = workflowFixture(t);
    writeFileSync(
      join(f.repo, 'verify.cjs'),
      "const fs=require('fs'),cp=require('child_process');if(fs.existsSync('tests/regression.cjs'))require('./tests/regression.cjs');if(fs.readFileSync('source.txt','utf8')==='after'){fs.writeFileSync('outside.txt','secret');cp.execFileSync('git',['add','outside.txt']);fs.unlinkSync('outside.txt');}",
    );
    f.commit();
    const r = f.run();
    assert.equal(r.status, 0);
    const v = JSON.parse(r.stdout);
    assert.equal(v.status, 'prepared');
    assert.equal(v.plan.hostChecks[0].status, 'pending');
    assert.equal(existsSync(join(v.workspace, 'outside.txt')), false);
    assert.ok(!v.stagedChanges.some((c: any) => c.path === 'outside.txt'));
    const logs = v.operationInvocations
      .filter((invocation: any) => invocation.result)
      .map((invocation: any) => readFileSync(invocation.result.log, 'utf8'))
      .join('\n');
    assert.match(logs, /EROFS|EACCES|EPERM/);
  }

  /** Cancels an observed host check and preserves the completed engineering turn. */
  async retainsInterruptedVerificationEvidence(t: TestContext) {
    const f = workflowFixture(t);
    writeFileSync(
      join(f.repo, 'verify.cjs'),
      "const fs=require('fs');if(fs.existsSync('tests/regression.cjs'))require('./tests/regression.cjs');if(fs.readFileSync('source.txt','utf8')==='after'){console.log('HOST_READY');setInterval(()=>{},1000)}",
    );
    f.commit();
    const child = this.start(t, f);
    await child.waitForReady(() => this.hostReady(f), 'Host verification must start');
    child.kill('SIGINT');
    assert.equal(await child.closed, 130);
    const record = JSON.parse(child.stdout);
    assert.equal(record.stage, 'verification');
    assert.ok(this.hostReady(f));
    assert.equal(record.agent.status, 'completed');
    assert.equal(record.turns.length, 3);
  }
}

const suite = new StewardTests();

for (const model of ['gpt-6-luna', 'synthetic-model'])
  test(`SDK uses declared ${model} profile and explicit settings`, (t) =>
    suite.usesExplicitSdkSettings(t, model));

test('public task rejects caller quota options before inference', (t) =>
  suite.quotaOptionsFailBeforeInference(t));

test('baseline failure prevents activation', (t: any) =>
  suite.baselineFailurePreventsActivation(t));

for (const mode of ['preflight-fail', 'wrong-thread'])
  test(`${mode} cannot continue`, (t: any) => suite.stopsInvalidActivation(t, mode));

test('target Codex configuration is rejected before activation', (t: any) =>
  suite.targetCodexConfigurationIsRejectedBeforeActivation(t));

for (const activity of ['specification', 'implementation', 'review'])
  test(`${activity}: cancellation retains partial turn evidence`, (t) =>
    suite.retainsInterruptedTurnEvidence(t, activity));

test('run preserves inspected assignment and shared verification identity', (t) =>
  suite.inspectedSharedVerification(t));

test('final host verification cannot mutate maintained source', (t: any) =>
  suite.finalHostVerificationCannotMutateMaintainedSource(t));

test('verification cancellation preserves the completed agent turn', (t) =>
  suite.retainsInterruptedVerificationEvidence(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
