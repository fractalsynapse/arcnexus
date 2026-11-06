import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CapturedVerification } from '../../../../dist/library/assignment/captured-verification.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture, type WorkflowFixture } from '../../testing/support/workflow-fixture.js';

/** Runs actual captured checks against changed source to detect acceptance that restores implementation. */
class CapturedVerificationScenarios {
  /** A test removed by a verified delivery is not restored from original authority. */
  async removed(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    writeFileSync(join(f.repo, 'tests/removed.test.ts'), 'old');
    f.commit();
    const authority = f.git('rev-parse', 'HEAD');
    rmSync(join(f.repo, 'tests/removed.test.ts'));
    f.commit();
    writeFileSync(join(f.repo, 'verify.cjs'), 'process.exit(0);');
    const verifier = this.verifier(
      f,
      () => {
        assert.equal(existsSync(join(f.repo, 'tests/removed.test.ts')), false);
      },
      {
        authority,
        base: f.git('rev-parse', 'HEAD'),
        verifiedTestPaths: ['tests/removed.test.ts'],
        trustedVerificationPaths: ['tests'],
      },
    );
    await verifier.verify();
    assert.equal(existsSync(join(f.repo, 'tests/removed.test.ts')), false);
  }

  /** Verified fixture changes are used while candidate implementation and captured commands stay authoritative. */
  async baseline(t: TestContext, broken: boolean): Promise<void> {
    const f = workflowFixture(t);
    writeFileSync(join(f.repo, 'tests/fixture.txt'), 'old');
    writeFileSync(
      join(f.repo, 'verify.cjs'),
      "const f=require('node:fs');if(f.readFileSync('source.txt','utf8')!==f.readFileSync('tests/fixture.txt','utf8'))process.exit(1);",
    );
    f.commit();
    const authority = f.git('rev-parse', 'HEAD');
    writeFileSync(join(f.repo, 'tests/fixture.txt'), 'verified');
    f.commit();
    const base = f.git('rev-parse', 'HEAD');
    const source = broken ? 'broken' : 'verified';
    writeFileSync(join(f.repo, 'source.txt'), source);
    writeFileSync(join(f.repo, 'tests/fixture.txt'), 'unverified');
    writeFileSync(join(f.repo, 'verify.cjs'), 'process.exit(0);');
    const verifier = this.verifier(f, () => {}, {
      authority,
      base,
      verifiedTestPaths: ['tests/fixture.txt'],
      trustedVerificationPaths: ['tests'],
    });
    if (broken) await assert.rejects(() => verifier.verify(), /Command failed/);
    else await verifier.verify();
    assert.equal(readFileSync(join(f.repo, 'source.txt'), 'utf8'), source);
    assert.equal(readFileSync(join(f.repo, 'tests/fixture.txt'), 'utf8'), 'unverified');
    assert.equal(readFileSync(join(f.repo, 'verify.cjs'), 'utf8'), 'process.exit(0);');
  }

  /** A weakened check must fail when restored against a broken candidate implementation. */
  async broken(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    const verifier = this.verifier(f);
    writeFileSync(join(f.repo, 'source.txt'), 'broken');
    writeFileSync(join(f.repo, 'verify.cjs'), 'process.exit(0);');
    await assert.rejects(() => verifier.verify(), /Command failed/);
    assert.equal(readFileSync(join(f.repo, 'source.txt'), 'utf8'), 'broken');
    assert.equal(readFileSync(join(f.repo, 'verify.cjs'), 'utf8'), 'process.exit(0);');
  }

  /** Directory-valued command arguments do not make unrelated documentation a captured check input. */
  async documentation(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    let checks = 0;
    const verifier = this.verifier(f, () => {
      checks++;
    });
    writeFileSync(join(f.repo, 'docs/behavior.md'), 'A documentation-only update');
    await verifier.verify();
    assert.equal(checks, 0);
  }

  /** Captures a passing source/check pair before introducing candidate-only changes. */
  private fixture(t: TestContext): WorkflowFixture {
    const f = workflowFixture(t);
    writeFileSync(join(f.repo, 'source.txt'), 'good');
    writeFileSync(
      join(f.repo, 'verify.cjs'),
      "if(require('node:fs').readFileSync('source.txt','utf8')!=='good') process.exit(1);",
    );
    f.commit();
    return f;
  }

  /** Supplies the real filesystem and command boundary used by the built captured-verification component. */
  private verifier(f: WorkflowFixture, observed = () => {}, baseline: any = {}) {
    const check = { command: process.execPath, args: ['verify.cjs', '--project', '.'] };
    return new CapturedVerification({
      options: {
        record: { generalExecution: true, source: f.repo, workspace: f.repo, ...baseline },
      },
      resolved: { base: baseline.authority ?? f.git('rev-parse', 'HEAD') },
      component: { tests: [], verification: [check] },
      safe: () => {},
      checks: async (commands: Array<{ command: string; args: string[] }>) => {
        for (const command of commands) {
          observed();
          execFileSync(command.command, command.args, { cwd: f.repo, stdio: 'pipe' });
        }
      },
    } as any);
  }
}

const scenarios = new CapturedVerificationScenarios();

test('verified removal of a test is preserved during captured checks', (t) => scenarios.removed(t));

test('captured checks accept independently verified fixture changes', (t) =>
  scenarios.baseline(t, false));

test('verified fixture checks reject broken current implementation and preserve edits', (t) =>
  scenarios.baseline(t, true));

test('captured acceptance retains broken candidate implementation while restoring weakened checks', (t) =>
  scenarios.broken(t));

test('project directory arguments do not recapture unrelated documentation', (t) =>
  scenarios.documentation(t));

registerSuite({ component: 'assignment', level: 'acceptance', tags: ['deterministic'] });
