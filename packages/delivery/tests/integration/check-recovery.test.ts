import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Architecture, Capture } from '../../../architecture/src/index.js';
import { GitHubCheckFailure, type GitHub } from '../../../collaboration/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution, HostTask } from '../../../execution/src/index.js';
import { integrate, resume, PublicationCheckFailure } from '../../src/index.js';
import { verificationIdentity, type Candidate } from '../../../verification/src/index.js';
import { activities, type Plan } from '../../../direction/src/index.js';

export const suite = { owner: 'delivery', level: 'integration', tags: ['regression'] } as const;
const remote = 'https://github.com/example/check-recovery.git';
const log = '\nComplete hosted check log\n  assertion failure\nfinal conclusion\n\n';

/** Own actual Git/SQLite assembly and replace only the external provider operations. */
class CheckScenario {
  readonly directory = mkdtempSync(join(tmpdir(), 'delivery-check-recovery-'));
  readonly root = join(this.directory, 'project');
  readonly storage = join(this.directory, 'state');
  readonly coordination = new Coordination(this.storage);
  readonly signal = new AbortController().signal;
  readonly base: string;
  head: string;
  authority: string;
  task: HostTask;
  failed = true;
  merged = 0;
  opened = 0;

  /** Commit a real accepted branch while keeping all tests away from hosted GitHub. */
  constructor(private readonly t: TestContext) {
    mkdirSync(this.root);
    this.base = this.repository();
    this.authority = this.base;
    this.head = this.git('rev-parse', 'HEAD');
    this.task = this.admit();
    t.after(() => {
      this.task.close();
      rmSync(this.directory, { recursive: true, force: true });
    });
  }

  /** Establish a changed candidate and a distinct retained staging parent. */
  private repository() {
    this.git('init', '-b', 'staging');
    this.git('config', 'user.name', 'Fixture');
    this.git('config', 'user.email', 'fixture@example.invalid');
    writeFileSync(join(this.root, 'baseline'), 'original\n');
    this.git('add', '.');
    this.git('commit', '-m', 'baseline');
    const base = this.git('rev-parse', 'HEAD');
    this.git('checkout', '-b', '7-task');
    writeFileSync(join(this.root, 'baseline'), 'candidate\n');
    this.git('add', '.');
    this.git('commit', '-m', 'candidate');
    return base;
  }

  /** Reopen the canonical journal with explicit captured authority and bound provider. */
  private admit() {
    const capture = {
      source: { root: this.root, revision: this.authority, remote },
      project: { delivery: { baseBranch: 'staging', protectedBranch: 'main' } },
      operations: {},
    } as unknown as Capture;
    const journal = this.coordination.admit(remote, 'Deliver the fixture');
    assert('close' in journal);
    const task = new HostTask(
      {
        capture,
        common: join(this.root, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      'Deliver the fixture',
      journal,
    );
    task.worktree = this.root;
    task.branch = '7-task';
    task.issue = '7';
    this.t.mock.method(task, 'provider', () => this.provider() as unknown as GitHub);
    return task;
  }

  /** Return an existing PR and make any accidental duplicate or merge observable. */
  private provider() {
    return {
      publication: async () => ({
        url: 'pull/7',
        target: 'staging',
        state: 'open',
        head: this.head,
        commit: null,
      }),
      remoteHead: async (branch: string) => (branch === 'staging' ? this.authority : this.head),
      verify: async () => {
        if (this.failed)
          throw new GitHubCheckFailure('pull/7', this.head, { conclusion: 'FAILURE' }, log);
      },
      merge: async () => {
        this.merged++;
        throw new Error('Unexpected merge');
      },
      pull: async () => {
        this.opened++;
        throw new Error('Unexpected new PR');
      },
      push: async (_root: string, _branch: string, head: string) => {
        this.head = head;
      },
    };
  }

  /** Consume the actual public Execution assembly record through Delivery. */
  async failPublication() {
    const execution = new Execution({} as Architecture, this.coordination, this.storage);
    const candidate = await execution.assemble(this.task, this.signal);
    const plan = publicationPlan();
    const verification = verificationIdentity(this.task, plan, candidate, []);
    this.task.record({ plan });
    this.task.note({ verification: { identity: verification, checks: [] } });
    const verdict = {
      kind: 'accepted' as const,
      verification,
      candidate: candidate.digest,
      criteria: ['behavior'],
      evidence: candidate.evidence,
    };
    this.task.record({ candidate, verdict });
    await assert.rejects(integrate(this.task, candidate, verdict, this.signal), (error) => {
      this.assertFailure(error, candidate);
      return true;
    });
    return candidate;
  }

  /** Require the full provider body and immutable candidate identity in retained evidence. */
  private assertFailure(error: unknown, candidate: Candidate) {
    assert.ok(error instanceof PublicationCheckFailure);
    assert.equal(error.candidate, candidate.digest);
    assert.equal(readFileSync(error.evidence[0]!, 'utf8'), log);
    const finding = this.task
      .observations<{ publicationCheckFailure?: { head: string; evidence: string[] } }>()
      .findLast((event) => event.publicationCheckFailure)?.publicationCheckFailure;
    assert.equal(finding?.head, this.head);
    assert.deepEqual(finding?.evidence, error.evidence);
    assert.equal(this.git('rev-parse', 'HEAD'), this.head);
    assert.equal(this.git('status', '--porcelain'), '');
  }

  /** Retain the failed attempt and provide a fresh authority or branch before resuming. */
  reopen(change: 'base' | 'head') {
    this.task.note({
      baseRevision: this.base,
      checkpoint: { head: this.head, previous: '', parent: this.base },
      confirmed: this.head,
    });
    this.task.finish({ kind: 'failed', reason: 'Hosted check failed', evidence: [] });
    this.task.close();
    if (change === 'base') this.git('checkout', 'staging');
    writeFileSync(join(this.root, 'fresh'), change + '\n');
    this.git('add', '.');
    this.git('commit', '-m', 'Fresh ' + change);
    if (change === 'base') {
      this.authority = this.git('rev-parse', 'HEAD');
      this.git('checkout', '7-task');
    } else this.head = this.git('rev-parse', 'HEAD');
    this.failed = false;
    this.task = this.admit();
  }

  /** Execute fixture-only Git arguments and preserve each resulting identity. */
  git(...args: string[]) {
    return execFileSync('git', args, {
      cwd: this.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
}

test('an observed accepted open PR can reconstruct its checkpoint on advanced staging', async (t) => {
  const scenario = new CheckScenario(t);
  await scenario.failPublication();
  const checkpoint = scenario.head;
  scenario.reopen('base');
  assert.equal(await resume(scenario.task, scenario.signal, () => {}), undefined);
  scenario.task.worktree = undefined;
  scenario.git('checkout', 'staging');
  const execution = new Execution({} as Architecture, scenario.coordination, scenario.storage);
  await execution.prepare(scenario.task, '7', scenario.signal);
  assert.ok(scenario.task.worktree);
  assert.equal(readFileSync(join(scenario.task.worktree, 'baseline'), 'utf8'), 'candidate\n');
  assert.equal(readFileSync(join(scenario.task.worktree, 'fresh'), 'utf8'), 'base\n');
  assert.equal(scenario.git('merge-base', scenario.head, checkpoint), checkpoint);
  assert.equal(scenario.git('merge-base', scenario.head, scenario.authority), scenario.authority);
  assert.equal(scenario.opened, 0);
  assert.equal(scenario.merged, 0);
  scenario.task.cleanup();
});

test('Delivery retains complete CI diagnostics for the actual assembled candidate', async (t) => {
  const scenario = new CheckScenario(t);
  await scenario.failPublication();
  assert.equal(scenario.merged, 0);
  assert.equal(scenario.opened, 0);
});

for (const change of ['base', 'head'] as const) {
  test(`an observed unmerged ${change} change returns to normal preparation without publication`, async (t) => {
    const scenario = new CheckScenario(t);
    await scenario.failPublication();
    scenario.reopen(change);
    if (change === 'base')
      assert.equal(await resume(scenario.task, scenario.signal, () => {}), undefined);
    else
      await assert.rejects(
        resume(scenario.task, scenario.signal, () => {}),
        /match the retained candidate/,
      );
    assert.equal(scenario.merged, 0);
    assert.equal(scenario.opened, 0);
  });
}

/** Supply the explicit accepted plan used by the journaled verification identity. */
function publicationPlan(): Plan {
  return {
    focus: { purpose: 'Deliver the fixture', objectives: [], constraints: [] },
    milestones: [
      {
        id: 'delivery',
        owner: 'work',
        criteria: [
          { id: 'behavior', description: 'Preserve diagnostics and retained publication' },
        ],
        steps: activities.map((activity) => ({
          activity,
          checklist: [],
          inapplicable: 'Controlled publication fixture',
        })),
      },
    ],
  };
}
