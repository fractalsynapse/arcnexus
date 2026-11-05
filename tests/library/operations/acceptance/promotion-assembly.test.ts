import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { PromotionAssembly } from '../../../../dist/library/operations/promotion-assembly.js';
import { git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

/** Uses different baseline histories to detect accidental import of unrelated simulation development. */
class PromotionFixture extends GitDeliveryFixture {
  readonly target = join(this.root, 'target');

  readonly assembly: PromotionAssembly;

  readonly head: string;

  /** Captures simulation-only baseline content and independent target changes without external repositories. */
  constructor(t: TestContext, conflict = false) {
    super(t);
    git(this.root, 'clone', '--no-local', this.repository.origin, this.target);
    writeFileSync(join(this.target, conflict ? 'source.txt' : 'target.txt'), 'target work');
    this.head = this.commit(this.target);
    const snapshots = new CandidateSnapshots(this.repository.source, join(this.root, 'promotion'));
    writeFileSync(join(this.repository.source, 'bootstrap.txt'), 'unrelated bootstrap');
    const base = snapshots.capture(this.repository.source, this.repository.base);
    writeFileSync(join(this.repository.source, 'source.txt'), 'reviewed candidate');
    const candidate = snapshots.capture(this.repository.source, base);
    this.assembly = new PromotionAssembly(
      { ...this.store.get(this.id), base, candidate },
      this.repository.source,
      this.target,
      join(this.root, 'promotion-evidence'),
    );
  }

  /** Builds a distinct live effect without mutating the source simulation's environment or evidence. */
  intent() {
    this.effects.register({
      id: 'live',
      mode: 'live',
      repositoryId: 'repo',
      providerId: 'live',
      authorityDigest: 'new',
    });
    this.effects.prepare({
      id: 'promotion',
      environmentId: 'live',
      runId: 'new-run',
      operation: 'delivery.promote',
      target: 'repo',
      definitionDigest: 'new-policy',
      input: { deliveryId: this.id, targetHead: this.head },
    });
    return this.effects.begin('promotion');
  }

  /** Retains an ordinary target commit to check that object assembly never modifies its branch. */
  private commit(source: string): string {
    git(source, 'add', '.');
    git(
      source,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'target work',
    );
    return git(source, 'rev-parse', 'HEAD').trim();
  }
}

test('promotion applies only attributed changes and preserves target history and both checkouts', async (t) => {
  const f = new PromotionFixture(t);
  const effect = f.intent();
  const sourceBefore = git(f.repository.source, 'status', '--porcelain');
  const candidate = await f.assembly.assemble(effect, f.signal);
  assert.equal(git(f.target, 'show', `${candidate}:source.txt`), 'reviewed candidate');
  assert.equal(git(f.target, 'show', `${candidate}:target.txt`), 'target work');
  assert.equal(git(f.target, 'ls-tree', '--name-only', candidate, '--', 'bootstrap.txt'), '');
  assert.equal(git(f.target, 'show', '-s', '--format=%P', candidate).trim(), f.head);
  assert.equal(git(f.target, 'rev-parse', 'HEAD').trim(), f.head);
  assert.equal(git(f.target, 'status', '--porcelain'), '');
  assert.equal(git(f.repository.source, 'status', '--porcelain'), sourceBefore);
  assert.equal(git(f.repository.origin, 'rev-parse', 'staging').trim(), f.repository.base);
  assert.equal(await f.assembly.assemble(effect, f.signal), candidate);
  assert.equal(f.store.get(f.id).environment.mode, 'simulation');
});

test('promotion preserves conflicting revisions and refuses mode reuse or cancellation', async (t) => {
  const f = new PromotionFixture(t, true);
  const effect = f.intent();
  await assert.rejects(
    f.assembly.assemble({ ...effect, environmentId: 'sim' }, f.signal),
    /new run/,
  );
  await assert.rejects(
    f.assembly.assemble(effect, AbortSignal.abort(new Error('Cancelled'))),
    /Cancelled/,
  );
  await assert.rejects(f.assembly.assemble(effect, f.signal), (error: any) => {
    assert.equal(error.commandResult.exitCode, 1);
    assert.match(readFileSync(error.commandResult.log, 'utf8'), /CONFLICT/);
    return true;
  });
  const prefix = 'refs/arcnexus/promotions/' + effect.inputDigest;
  assert.equal(git(f.target, 'for-each-ref', '--format=%(objectname)', prefix).trim(), '');
  for (const name of ['base', 'incoming', 'target'])
    assert.match(git(f.target, 'rev-parse', prefix + '-' + name).trim(), /^[a-f0-9]{40}$/);
  assert.equal(git(f.target, 'rev-parse', 'HEAD').trim(), f.head);
  assert.equal(git(f.target, 'show', 'HEAD:source.txt'), 'target work');
});

test('promotion rejects linked worktrees and substituted retained candidates', async (t) => {
  const f = new PromotionFixture(t);
  const effect = f.intent();
  await f.assembly.assemble(effect, f.signal);
  git(f.target, 'update-ref', 'refs/arcnexus/promotions/' + effect.inputDigest, f.head);
  await assert.rejects(f.assembly.assemble(effect, f.signal), /target or attribution/);
  await assert.rejects(
    f.assembly.assemble({ ...effect, input: { ...effect.input, targetHead: 'HEAD' } }, f.signal),
    /exact target/,
  );
  const linked = join(f.root, 'linked');
  git(f.repository.source, 'worktree', 'add', '--detach', linked, f.repository.base);
  assert.throws(
    () =>
      new PromotionAssembly(
        f.store.get(f.id),
        f.repository.source,
        linked,
        join(f.root, 'rejected'),
      ),
    /isolated/,
  );
});

test('promotion refuses configured executable merge drivers before any object import', async (t) => {
  const f = new PromotionFixture(t);
  const marker = join(f.target, 'unauthorized-write');
  git(f.target, 'config', 'merge.external.driver', 'touch ' + marker);
  const effect = f.intent();
  await assert.rejects(f.assembly.assemble(effect, f.signal), /executable merge driver/);
  assert.equal(existsSync(marker), false);
  assert.equal(git(f.target, 'for-each-ref', 'refs/arcnexus/promotions'), '');
});

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
