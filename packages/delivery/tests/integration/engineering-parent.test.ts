import assert from 'node:assert/strict';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { GitHub, type PublishedPull } from '../../../collaboration/src/index.js';
import { RecoveredAssessment } from '../../../verification/tests/fixtures/recovered-assessment.js';
import { integrate } from '../../src/index.js';
import type { Publication } from '../../src/publication.js';

export const suite = { owner: 'delivery', level: 'integration', tags: ['regression'] } as const;

/** Model upstream facts while validating the actual Git tree and confirmed merge parent. */
class EngineeringPublication {
  readonly provider = new GitHub(
    'https://github.com/example/recovered-verification.git',
    new AbortController().signal,
  );
  pull?: PublishedPull;
  opened = 0;
  merged = 0;
  confirmed?: string;

  /** Bind external operations without replacing assembly, acceptance or publication behavior. */
  constructor(
    private readonly fixture: RecoveredAssessment,
    context: TestContext,
  ) {
    const { task } = fixture;
    context.mock.method(task, 'provider', () => this.provider);
    context.mock.method(this.provider, 'publication', async () => this.pull);
    context.mock.method(this.provider, 'remoteHead', async (branch: string) =>
      fixture.git(fixture.root, 'rev-parse', branch),
    );
    context.mock.method(this.provider, 'pull', async () => this.open());
    context.mock.method(this.provider, 'verify', async (_url: string, head: string) => {
      assert.equal(head, this.pull?.head);
    });
    context.mock.method(this.provider, 'merge', async (_url: string, head: string) =>
      this.merge(head),
    );
    context.mock.method(this.provider, 'confirm', async (commit: string, tree: string) => {
      assert.equal(fixture.git(fixture.root, 'rev-parse', commit + '^{tree}'), tree);
      assert.equal(fixture.git(fixture.root, 'rev-parse', commit + '^'), fixture.original.source.revision);
      this.confirmed = commit;
    });
  }

  /** Retain exactly one PR for the checkpoint branch already observed on the provider. */
  private open() {
    assert.equal(this.pull, undefined);
    this.opened++;
    this.pull = {
      url: 'https://github.com/example/recovered-verification/pull/17',
      target: 'staging',
      head: this.fixture.git(this.fixture.root, 'rev-parse', '7-task'),
      state: 'open',
      commit: null,
    };
    return this.pull.url;
  }

  /** Produce the provider's squash identity from the real candidate and engineering parent. */
  private merge(head: string) {
    const fixture = this.fixture;
    const tree = fixture.git(fixture.root, 'rev-parse', head + '^{tree}');
    const commit = fixture.git(
      fixture.root, 'commit-tree', tree, '-p', 'staging', '-m', 'Accepted fixture #7',
    );
    fixture.git(fixture.root, 'update-ref', 'refs/heads/staging', commit);
    this.merged++;
    this.pull = { ...this.pull!, state: 'merged', commit };
    return commit;
  }
}

/** Keep active architecture on a distinct ref and identify the actual assessment checkout. */
function recovered(fixture: RecoveredAssessment) {
  const authority = fixture.advance('capture');
  fixture.git(fixture.root, 'branch', 'approved-architecture', authority.source.revision);
  fixture.git(fixture.root, 'reset', '--hard', fixture.original.source.revision);
  fixture.resume(fixture.original, authority);
  fixture.git(fixture.root, 'worktree', 'remove', join(fixture.directory, 'initial-checkpoint'));
  fixture.git(fixture.task.worktree!, 'checkout', '7-task');
  const checkout = fixture.git(fixture.task.worktree!, 'rev-parse', 'HEAD');
  assert.notEqual(checkout, fixture.original.source.revision);
  assert.notEqual(checkout, authority.source.revision);
  assert.notEqual(authority.source.revision, fixture.original.source.revision);
  return { authority: authority.source.revision, checkout };
}

test('accepted production assembly publishes and confirms its engineering parent after authority adoption', async (t) => {
  const fixture = new RecoveredAssessment(t);
  const { authority, checkout } = recovered(fixture);
  const provider = new EngineeringPublication(fixture, t);
  const candidate = await fixture.assemble();
  const verdict = await fixture.run(candidate);
  assert(verdict.kind === 'accepted' && verdict.verification);
  assert.equal(verdict.verification.base, fixture.original.source.revision);
  assert.equal(verdict.verification.capture, authority);
  fixture.task.record({ candidate, verdict });
  const result = await integrate(fixture.task, candidate, verdict, new AbortController().signal);
  assert(result.kind === 'merged', JSON.stringify(result));
  const publication = fixture.task.observations<{ publication?: Publication }>()
    .findLast((event) => event.publication)?.publication;
  assert.equal(publication?.parent, fixture.original.source.revision);
  assert.notEqual(publication?.parent, authority);
  assert.notEqual(publication?.parent, checkout);
  assert.equal(publication?.candidate, candidate.digest);
  assert.deepEqual(publication?.verification, verdict.verification);
  assert.equal(fixture.git(fixture.root, 'rev-parse', result.commit + '^'), publication?.parent);
  assert.equal(provider.confirmed, result.commit);
  assert.equal(provider.opened, 1);
  assert.equal(provider.merged, 1);
});
