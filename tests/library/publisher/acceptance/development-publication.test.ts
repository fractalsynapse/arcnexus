import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  DevelopmentDeliveries,
  SimulationPublication,
} from '../../../../dist/library/publisher/publisher.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { assertIdentity } from '../../../../dist/library/workspace/workspace.js';
import { candidateDigest } from '../../../../dist/library/change-inspection/changes.js';
import { git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

/** Exercises steward branch lineage and repeated publication with actual isolated Git. */
class DevelopmentScenario {
  readonly fixture;

  readonly assignments: any[] = [];

  record: any;

  head: string;

  readonly branches: string[] = [];

  readonly policy = {
    owner: 'publisher',
    operation: {
      schemaVersion: 4 as const,
      id: 'publish',
      kind: 'upstream' as const,
      action: 'delivery.publish' as const,
      purpose: 'Controlled test',
      repository: 'repo',
      cwd: '.',
      category: 'collaboration',
      activities: ['release' as const],
      generatedDirectories: [],
      artifacts: [],
      probes: [],
      targetBranch: 'staging',
      definitionDigest: 'policy',
    },
  };

  /** Creates the same candidate chain for any supplied owner catalog. */
  constructor(t: TestContext, count: number) {
    this.fixture = new GitDeliveryFixture(t);
    this.head = this.fixture.repository.base;
    for (let index = 0; index < count; index++) this.steward(index);
  }

  /** Captures one owner's actual worktree, branch and delivered snapshot. */
  private steward(index: number): void {
    const f = this.fixture,
      id = randomUUID();
    const branch = 'codex/run-' + id,
      workspace = join(f.root, id);
    git(f.repository.source, 'worktree', 'add', '-b', branch, workspace, f.repository.base);
    git(workspace, 'merge', '--ff-only', this.head);
    writeFileSync(join(workspace, 'owner-' + index + '.txt'), 'Verified owner ' + index);
    const candidate = new CandidateSnapshots(
      f.repository.source,
      join(f.root, 'snapshots'),
    ).capture(workspace, this.head);
    this.record = {
      id,
      branch,
      workspace,
      source: f.repository.source,
      base: this.head,
      branchBase: f.repository.base,
      status: 'completed',
      assignmentId: id,
      executionRunId: 'run',
    };
    this.saveAssignment(id, index, candidate);
    this.branches.push(branch);
    this.head = candidate;
  }

  /** Retains controlled assignment evidence separately from the actual Git workspace. */
  private saveAssignment(id: string, index: number, candidate: string): void {
    const f = this.fixture;
    mkdirSync(join(f.root, 'runs', id), { recursive: true });
    writeFileSync(join(f.root, 'runs', id, 'report.json'), JSON.stringify(this.record));
    this.assignments.push({
      id,
      runId: 'run',
      owner: 'owner-' + index,
      status: 'completed',
      data: {
        recordId: id,
        deliveredRevision: candidate,
        reviewedDigest: candidateDigest(this.record),
      },
      evidence: ['controlled-review'],
    });
  }

  /** Builds immutable parent attribution and authorizes only that exact assembled candidate. */
  parent() {
    const f = this.fixture;
    const manifest = new DevelopmentDeliveries(f.root).capture(
      this.assignments,
      this.record,
      this.head,
    );
    const original = f.store.get(f.id);
    const parent = f.store.capture({
      ...original,
      id: createHash('sha256').update(this.head).digest('hex'),
      candidate: this.head,
      assignmentIds: this.assignments.map((a) => a.id),
      developments: manifest,
    });
    return f.store.approve(parent.id, parent.version, parent.candidate);
  }

  /** Starts another workday assignment from the newly integrated staging revision. */
  continueWorkday(): void {
    this.head = this.fixture.provider.targetHead();
    this.steward(this.assignments.length);
  }

  /** Routes every child through production publication with visibly controlled check inputs. */
  async publish(parent: ReturnType<DevelopmentScenario['parent']>) {
    const f = this.fixture;
    await new DevelopmentDeliveries(f.root).publish(parent, f.store, async (child) => {
      const publication = new SimulationPublication(
        {
          root: f.root,
          repositoryId: 'repo',
          repository: f.repository,
          effects: f.effects,
          deliveries: f.store,
          policy: this.policy,
          checks: async (head) => this.check(head),
        },
        child,
      );
      try {
        await publication.publish(f.signal);
      } finally {
        publication.close();
      }
    });
  }

  /** Observes real objects and retains a deterministic artifact at the verification boundary. */
  private check(head: string) {
    const f = this.fixture;
    git(f.repository.source, 'cat-file', '-e', head + '^{commit}');
    const path = join(f.root, head + '.artifact');
    writeFileSync(path, head);
    return {
      status: 'passed' as const,
      evidence: ['controlled-check:' + head],
      artifacts: [{ path, sha256: createHash('sha256').update(head).digest('hex') }],
    };
  }

  /** Requires every steward's actual branch head to survive staging integration. */
  verify(): void {
    const { source, origin } = this.fixture.repository;
    for (const [index, branch] of this.branches.entries()) {
      const head = git(origin, 'rev-parse', 'refs/heads/' + branch).trim();
      assert.equal(head, this.assignments[index].data.deliveredRevision);
      assert.equal(git(source, 'rev-parse', branch).trim(), head);
      const record = JSON.parse(
        readFileSync(
          join(this.fixture.root, 'runs', this.assignments[index].data.recordId, 'report.json'),
          'utf8',
        ),
      );
      assertIdentity(record);
      assert.equal(candidateDigest(record), this.assignments[index].data.reviewedDigest);
      assert.equal(git(origin, 'rev-list', '--max-count=1', head, '--not', 'staging').trim(), '');
      assert.equal(
        git(origin, 'show', 'staging:owner-' + index + '.txt'),
        'Verified owner ' + index,
      );
    }
  }
}

for (const count of [3, 5]) {
  test(`${count} steward branches integrate through the same development workflow`, async (t) => {
    const scenario = new DevelopmentScenario(t, count);
    const parent = scenario.parent();
    await scenario.publish(parent);
    scenario.verify();
    assert.equal(scenario.fixture.store.get(parent.id).publication, 'released');
    const effects = scenario.fixture.effects.effects();
    await scenario.publish(parent);
    assert.deepEqual(scenario.fixture.effects.effects(), effects);
  });
}

test('a changed steward branch blocks before publishing another revision', async (t) => {
  const scenario = new DevelopmentScenario(t, 1);
  const parent = scenario.parent();
  git(
    scenario.fixture.repository.source,
    'update-ref',
    'refs/heads/' + scenario.branches[0],
    scenario.fixture.store.get(scenario.fixture.id).candidate,
  );
  await assert.rejects(scenario.publish(parent), /development branch changed/);
  assert.match(scenario.fixture.store.get(parent.id).blocker!, /development branch changed/);
  assert.equal(scenario.fixture.provider.targetHead(), scenario.fixture.repository.base);
});

test('later workday delivery reuses previously integrated steward branches', async (t) => {
  const scenario = new DevelopmentScenario(t, 1);
  await scenario.publish(scenario.parent());
  const original = scenario.fixture.effects.effects();
  scenario.continueWorkday();
  await scenario.publish(scenario.parent());
  scenario.verify();
  const effects = scenario.fixture.effects.effects();
  assert.equal(effects.length, original.length * 2);
  for (const effect of original)
    assert.deepEqual(
      effects.find((e) => e.id === effect.id),
      effect,
    );
});

registerSuite({
  component: 'publisher',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'development-branch'],
});
