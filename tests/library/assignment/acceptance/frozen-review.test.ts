import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { linkSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { TurnEvidence } from '../../../../dist/library/assignment/session-turn-evidence.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Distinguishes specification changes from forbidden post-freeze changes in actual candidate review evidence. */
class FrozenReviewScenarios {
  /** A changed Git diff remains visible while exact accepted regression bytes are reported preserved. */
  preserved(t: TestContext): void {
    const f = this.fixture(t);
    const evidence = f.review.review() as any;
    assert.match(evidence.patch, /new regression/);
    assert.equal(evidence.basis, 'candidate');
    assert.equal(evidence.frozenRegressions.basis, 'frozen-regression-checkpoint');
    assert.deepEqual(evidence.frozenRegressions.files, [
      {
        path: 'regression.test.ts',
        frozenSha256: f.hash,
        currentSha256: f.hash,
        status: 'preserved',
      },
    ]);
    assert.equal(readFileSync(f.path, 'utf8'), f.frozen);
    assert.notEqual(createHash('sha256').update('original\n').digest('hex'), f.hash);
  }

  /** Missing and changed candidate bytes are never mislabeled as preservation or automatically restored. */
  deficient(t: TestContext, missing: boolean): void {
    const f = this.fixture(t);
    if (missing) rmSync(f.path);
    else writeFileSync(f.path, 'weakened\n');
    const evidence = f.review.review() as any;
    const comparison = evidence.frozenRegressions.files[0];
    assert.equal(comparison.status, missing ? 'missing' : 'changed');
    assert.equal(comparison.frozenSha256, f.hash);
    assert.notEqual(comparison.currentSha256, f.hash);
    if (missing) assert.equal(comparison.currentSha256, null);
    else assert.equal(readFileSync(f.path, 'utf8'), 'weakened\n');
  }

  /** Unsafe aliases and corrupted retained checkpoint bytes fail review capture before any preservation claim. */
  unsafe(t: TestContext, mode: string): void {
    const f = this.fixture(t);
    if (mode === 'corrupt') f.state.frozen[0]!.sha256 = 'invalid';
    else {
      const outside = join(f.root, 'outside');
      writeFileSync(outside, f.frozen);
      rmSync(f.path);
      if (mode === 'symlink') symlinkSync(outside, f.path);
      else linkSync(outside, f.path);
    }
    assert.throws(() => f.review.review(), /Symlink|Unsafe frozen|digest mismatch/);
  }

  /** Captures an actual Git base before a legitimate specification edit and immutable freeze. */
  private fixture(t: TestContext) {
    const f = workflowFixture(t);
    const path = join(f.repo, 'regression.test.ts');
    writeFileSync(path, 'original\n');
    f.commit();
    const base = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: f.repo,
      encoding: 'utf8',
    }).trim();
    const frozen = 'original\nnew regression\n';
    writeFileSync(path, frozen);
    const hash = createHash('sha256').update(frozen).digest('hex');
    const dir = join(f.state, 'runs', 'review');
    mkdirSync(dir, { recursive: true });
    const state: any = {
      options: { root: f.state, record: { id: 'review', workspace: f.repo, base } },
      assignment: { kind: 'change' },
      dir,
      frozen: [
        {
          path: 'regression.test.ts',
          content: Buffer.from(frozen).toString('base64'),
          sha256: hash,
        },
      ],
    };
    return { root: f.root, path, frozen, hash, state, review: new TurnEvidence(state) };
  }
}

const scenarios = new FrozenReviewScenarios();

test('candidate review distinguishes accepted specification edits from post-freeze changes', (t) =>
  scenarios.preserved(t));

for (const missing of [false, true])
  test(
    'candidate review identifies ' + (missing ? 'missing' : 'changed') + ' frozen regressions',
    (t) => scenarios.deficient(t, missing),
  );

for (const mode of ['symlink', 'hardlink', 'corrupt'])
  test('candidate frozen review rejects ' + mode, (t) => scenarios.unsafe(t, mode));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'evidence'],
});
