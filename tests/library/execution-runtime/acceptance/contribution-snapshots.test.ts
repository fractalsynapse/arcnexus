import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import type { ExecutionAssignment } from '../../../../dist/library/coordination-store/execution-types.js';
import { ContributionSnapshots } from '../../../../dist/library/execution-runtime/contribution-snapshots.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';

/** Captures actual Git contributions without invoking a model or granting shared source permissions. */
class ContributionFixture {
  readonly fixture;

  readonly context;

  readonly runId = randomUUID();

  readonly assembly;

  /** Creates a committed three-owner catalog and a private snapshot composer. */
  constructor(t: TestContext) {
    this.fixture = generalCatalogFixture(t);
    mkdirSync(join(this.fixture.repo, 'b'), { recursive: true });
    writeFileSync(join(this.fixture.repo, 'b/source.txt'), 'before');
    this.fixture.commit();
    this.context = new ExecutionContext().resolve(this.fixture.repo);
    this.assembly = new ContributionSnapshots(this.fixture.state, this.context);
  }

  /** Captures one file edit, then restores the fixture checkout without changing its branch or index. */
  contribution(owner: string, path: string, content: string): ExecutionAssignment {
    const f = this.fixture;
    const original = readFileSync(join(f.repo, path));
    writeFileSync(join(f.repo, path), content);
    const revision = new CandidateSnapshots(f.repo, join(f.state, 'snapshots')).capture(
      f.repo,
      this.context.base,
    );
    writeFileSync(join(f.repo, path), original);
    const recordId = randomUUID();
    return {
      id: randomUUID(),
      runId: this.runId,
      owner,
      objective: 'Related change',
      acceptance: ['Observed combined behavior'],
      status: 'prepared',
      dependencies: [],
      evidence: [],
      data: {
        recordId,
        contribution: {
          recordId,
          base: this.context.base,
          revision,
          checkpoint: 'a'.repeat(64),
        },
      },
    };
  }
}

/** Exercises assembly and refusal against actual Git trees, not fabricated successful merge responses. */
class ContributionScenarios {
  /** Combines distinct owners while leaving their source and verified baseline unchanged. */
  combines(t: TestContext): void {
    const f = new ContributionFixture(t);
    const implementation = f.contribution('a', 'source.txt', 'implementation');
    const second = f.contribution('b', 'b/source.txt', 'related behavior');
    const revision = f.assembly.assemble(f.context.base, [implementation, second]);
    assert.equal(f.fixture.git('show', revision + ':source.txt'), 'implementation');
    assert.equal(f.fixture.git('show', revision + ':b/source.txt'), 'related behavior');
    assert.equal(f.fixture.git('rev-parse', 'HEAD'), f.context.base);
    assert.equal(f.fixture.git('status', '--porcelain'), '');
  }

  /** Rejects cross-owner changes even when a receipt claims that engineering prepared them. */
  ownership(t: TestContext): void {
    const f = new ContributionFixture(t);
    const invalid = f.contribution('b', 'source.txt', 'unauthorized');
    assert.throws(() => f.assembly.assemble(f.context.base, [invalid]), /another owner's file/);
    assert.equal(f.fixture.git('status', '--porcelain'), '');
  }

  /** Preserves both conflicting snapshots and identifies the retained reconciliation evidence. */
  conflict(t: TestContext): void {
    const f = new ContributionFixture(t);
    const left = f.contribution('a', 'source.txt', 'left');
    const right = f.contribution('a', 'source.txt', 'right');
    assert.throws(
      () => f.assembly.assemble(f.context.base, [left, right]),
      /conflicts; retained evidence/,
    );
    for (const [item, value] of [
      [left, 'left'],
      [right, 'right'],
    ] as const) {
      const contribution = item.data.contribution as { revision: string };
      assert.equal(f.fixture.git('show', contribution.revision + ':source.txt'), value);
    }
    assert.equal(f.fixture.git('status', '--porcelain'), '');
  }
}

const scenarios = new ContributionScenarios();

test('prepared owner contributions assemble without changing source or claiming verification', (t) =>
  scenarios.combines(t));

test('assembly rejects source outside the contributing component ownership', (t) =>
  scenarios.ownership(t));

test('assembly preserves conflicting contributions and reports retained evidence', (t) =>
  scenarios.conflict(t));

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
