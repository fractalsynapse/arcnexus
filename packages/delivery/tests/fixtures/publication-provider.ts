import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { PublishedPull } from '../../../collaboration/src/index.js';
import { PreparedRecoveryFixture } from './prepared-publication.js';

/** Model durable upstream effects independently of reopened local task sessions. */
export class PublicationProvider {
  readonly calls: string[] = [];
  pull?: PublishedPull;
  head?: string;
  opened = 0;
  merged = 0;
  lose?: 'push' | 'open' | 'merge';
  unavailable = false;
  branchUnavailable = false;
  moveDuringVerify = false;

  /** Bind only external operations while real task services retain their own records. */
  constructor(
    private readonly fixture: PreparedRecoveryFixture,
    private readonly t: TestContext,
  ) {
    this.observe();
    this.effects();
    this.t.mock.method(
      this.fixture.provider,
      'merge',
      async (url: string, head: string, issue: string) => this.merge(url, head, issue),
    );
  }

  /** Observe complete upstream identities before any missing effect can be retried. */
  private observe() {
    const mock = this.t.mock;
    mock.method(this.fixture.provider, 'publication', async (branch: string) => {
      this.calls.push('observe PR ' + branch);
      if (this.unavailable)
        throw Object.assign(new Error('Credential unavailable: restore provider access'), {
          stdout: 'Complete provider observation stdout\n  retained detail\n',
          stderr: 'Complete provider observation stderr\n  restore credentials\n',
        });
      return this.pull && { ...this.pull };
    });
    mock.method(this.fixture.provider, 'remoteHead', async (branch: string) =>
      this.observeBranch(branch),
    );
    mock.method(this.fixture.provider, 'verify', async (url: string, head: string) => {
      this.calls.push('verify ' + head);
      assert.equal(url, this.pull?.url);
      assert.equal(head, this.pull?.head);
      if (this.moveDuringVerify) this.fixture.advance('later.txt', 'later staging work\n');
    });
    mock.method(this.fixture.provider, 'confirm', async (commit: string, tree: string) => {
      this.calls.push('confirm ' + commit);
      assert.equal(this.fixture.git('rev-parse', commit + '^{tree}'), tree);
      assert.equal(this.fixture.git('merge-base', commit, 'staging'), commit);
    });
  }

  /** Preserve an unavailable branch lookup as distinct from a successful PR observation. */
  private observeBranch(branch: string) {
    this.calls.push('observe branch ' + branch);
    if (this.branchUnavailable && branch === '7-task')
      throw Object.assign(new Error('Issue-branch facts unavailable: restore branch access'), {
        stdout: 'Complete provider observation stdout\n  retained detail\n',
        stderr: 'Complete provider observation stderr\n  restore credentials\n',
      });
    return branch === 'staging' ? this.fixture.git('rev-parse', 'staging') : this.head;
  }

  /** Apply each effect before optionally losing its acknowledgment. */
  private effects() {
    const mock = this.t.mock;
    mock.method(
      this.fixture.provider,
      'push',
      async (_root: string, branch: string, head: string) => {
        this.calls.push('push ' + head);
        assert.equal(branch, '7-task');
        this.head = head;
        if (this.pull?.state === 'open') this.pull = { ...this.pull, head };
        this.fixture.checkpoints.push(head);
        this.lost('push');
      },
    );
    mock.method(this.fixture.provider, 'pull', async (target: string, branch: string) => {
      this.calls.push('open ' + branch);
      assert.equal(this.pull, undefined, 'A second PR would abandon retained publication');
      this.opened++;
      this.pull = {
        url: 'https://github.com/example/round-consumption/pull/17',
        target,
        head: this.head!,
        state: 'open',
        commit: null,
      };
      this.lost('open');
      return this.pull.url;
    });
  }

  /** Create a real squash commit with the exact upstream head tree and staging parent. */
  private merge(url: string, head: string, issue: string) {
    this.calls.push('merge ' + head);
    assert.equal(issue, '7');
    assert.equal(url, this.pull?.url);
    assert.equal(head, this.head);
    const tree = this.fixture.git('rev-parse', head + '^{tree}');
    const commit = this.fixture.git(
      'commit-tree',
      tree,
      '-p',
      'staging',
      '-m',
      'Fixture squash #7',
    );
    this.fixture.git('reset', '--hard', commit);
    this.merged++;
    this.pull = { ...this.pull!, state: 'merged', head, commit };
    this.lost('merge');
    return commit;
  }

  /** Retain the completed upstream operation while reporting a lost transport response once. */
  private lost(effect: 'push' | 'open' | 'merge') {
    if (this.lose !== effect) return;
    this.lose = undefined;
    throw new Error('Lost ' + effect + ' acknowledgment after upstream effect');
  }
}
