import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { TestProcess } from '../../testing/support/test-process.js';
import { minimalWorkflowFixture as operationFixture } from '../../testing/support/workflow-fixture.js';
import { cli, stewardEntry } from '../../testing/support/workflow-fixture.js';

/** Exercises prior evidence behavior through observable scenarios. */
class PriorEvidenceTests {
  /** Verifies that built clisnapshots selected historical text before setup and supplies identical inspected context. */
  async builtCLISnapshotsSelectedHistoricalTextBeforeSetupAndSuppliesIdenticalInspectedContext(
    t: TestContext,
  ) {
    const f = operationFixture(t),
      a = assignment(f);
    this.setupGate(f);
    const inspected = invoke(f, a, 'inspect');
    assert.equal(inspected.status, 0, inspected.stderr);
    const child = new TestProcess(t, argumentsFor(f, a), f.env);
    await child.waitForReady(
      () => this.setupReady(f) !== undefined,
      'Shared setup must reach its gate',
    );
    const workspace = this.setupReady(f)!;
    writeFileSync(a.history, 'REPLACED');
    writeFileSync(join(workspace, 'generated/release'), 'continue');
    assert.equal(await child.closed, 0, child.stderr);
    this.assertCaptured(f, JSON.parse(child.stdout), JSON.parse(inspected.stdout));
  }

  /** Checks retained bytes, model context and inspection against the original capture. */
  private assertCaptured(f: any, record: any, resolved: any): void {
    assert.equal(record.resolvedAssignment.digest, resolved.digest);
    assert.match(record.resolvedAssignment.priorEvidence[0].content, /PRIOR_FINDING_42/);
    assert.equal(
      record.resolvedAssignment.priorEvidence[0].bytes,
      Buffer.byteLength('PRIOR_FINDING_42: verify boundaries.'),
    );
    const dir = join(f.state, 'runs', record.id);
    assert.match(readFileSync(join(dir, 'prior-evidence/0.txt'), 'utf8'), /PRIOR_FINDING_42/);
    assert.match(readFileSync(f.calls, 'utf8'), /Historical evidence.*PRIOR_FINDING_42/);
    assert.equal(record.reusableFindings[0].componentId, 'sample');
    assert.equal(record.changes.length, 0);
    assert.match(readFileSync(join(dir, 'timeline.jsonl'), 'utf8'), /workspace.prepared/);
  }

  /** Makes setup wait at an observable generated-output gate without granting access to caller files. */
  private setupGate(f: any): void {
    const path = join(f.repo, 'architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    platform.operations['setup-gate'] = ['setup'];
    writeFileSync(path, JSON.stringify(platform));
    const operation = JSON.parse(
      readFileSync(join(f.repo, 'architecture/operations/verify.yaml'), 'utf8'),
    );
    operation.id = 'setup-gate';
    operation.args = [
      '-e',
      "const fs=require('fs');fs.mkdirSync('generated',{recursive:true});fs.writeFileSync('generated/ready','ready');const timer=setInterval(()=>{if(fs.existsSync('generated/release'))clearInterval(timer)},25)",
    ];
    writeFileSync(
      join(f.repo, 'architecture/operations/setup-gate.yaml'),
      JSON.stringify(operation),
    );
    f.commit();
  }

  /** Locates only this fixture's materialized workspace once its confined setup has actually started. */
  private setupReady(f: any): string | undefined {
    const root = join(f.state, 'workspaces');
    if (!existsSync(root)) return;
    return readdirSync(root)
      .map((id) => join(root, id))
      .find((workspace) => existsSync(join(workspace, 'generated/ready')));
  }

  /** Verifies the scenario rejects invalid historical input. */
  rejectsInvalidHistoricalInput(t: TestContext, mode: any) {
    const f = operationFixture(t),
      a = assignment(f);
    if (mode === 'missing') a.value.priorEvidence[0].path += '.missing';
    if (mode === 'oversized') writeFileSync(a.history, 'x'.repeat(65537));
    if (mode === 'non-text') writeFileSync(a.history, Buffer.from([255, 0]));
    if (mode === 'duplicate') a.value.priorEvidence.push(a.value.priorEvidence[0]);
    if (mode === 'version-one') a.value.schemaVersion = 1;
    writeFileSync(a.path, JSON.stringify(a.value));
    const r = invoke(f, a);
    assert.equal(r.status, 2, r.stderr);
    assert.equal(r.stdout, '');
  }
}

const suite = new PriorEvidenceTests();

function assignment(f: any): any {
  const history = join(f.root, 'finding.txt'),
    path = join(f.root, 'assignment.json');
  writeFileSync(history, 'PRIOR_FINDING_42: verify boundaries.');
  const value = {
    schemaVersion: 3,
    kind: 'research',
    objective: 'Inspect prior finding',
    expectedOutcome: 'Evidence-backed conclusion',
    acceptanceCriteria: ['Explain finding'],
    hostChecks: [],
    priorEvidence: [
      {
        path: history,
        sourceId: 'previous-run',
        revision: 'caller-selected-revision',
        reason: 'Investigate uncertainty',
      },
    ],
  };
  writeFileSync(path, JSON.stringify(value));
  return { history, path, value };
}

/** Supplies identical captured bindings to inspection and the assembled session. */
function argumentsFor(f: any, a: any, command = 'run'): string[] {
  return [
    command === 'run' ? stewardEntry : cli,
    command,
    'sample',
    '--assignment',
    a.path,
    '--project',
    f.repo,
    '--bindings',
    join(f.root, 'minimal-bindings.json'),
    ...(command === 'run' ? ['--codex-path', f.executable] : ['--json']),
  ];
}

function invoke(f: any, a: any, command = 'run'): any {
  return spawnSync(process.execPath, argumentsFor(f, a, command), {
    encoding: 'utf8',
    env: f.env,
    timeout: 30 * 60 * 1000,
  });
}

test('built CLI snapshots selected historical text before setup and supplies identical inspected context', (t: any) =>
  suite.builtCLISnapshotsSelectedHistoricalTextBeforeSetupAndSuppliesIdenticalInspectedContext(t));

for (const mode of ['missing', 'oversized', 'non-text', 'duplicate', 'version-one'])
  test(`historical evidence rejects ${mode} before inference`, (t: any) =>
    suite.rejectsInvalidHistoricalInput(t, mode));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
