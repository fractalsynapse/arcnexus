import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DeliveryAssembly } from '../../../../dist/library/operations/delivery-assembly.js';
import { git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

/** Supplies a live assembly boundary over the same supervised local Git fixture used by simulation. */
class LiveAssemblyFixture extends GitDeliveryFixture {
  readonly assembly = new DeliveryAssembly(
    { ...this.store.get(this.id), environment: { id: 'live', mode: 'live' } },
    this.repository.source,
    join(this.root, 'live-assembly'),
  );

  /** Prepares one host-captured merge intent without authorizing any upstream transition. */
  intent() {
    this.effects.prepare({
      id: 'merge',
      environmentId: 'sim',
      runId: 'run',
      operation: 'pull-request.merge',
      target: 'repo',
      definitionDigest: 'policy',
      input: { deliveryId: this.id, targetHead: this.repository.base },
    });
    return { ...this.effects.begin('merge'), environmentId: 'live' };
  }
}

test('live assembly shares verified object handling and leaves source and upstream untouched', async (t) => {
  const f = new LiveAssemblyFixture(t);
  const head = String((await f.execute('delivery.commit')).result!.head);
  const assembly = f.assembly;
  const effect = f.intent();
  const merged = await assembly.assemble(effect, head, f.signal);
  assert.equal(git(f.repository.source, 'show', `${merged}:source.txt`), 'reviewed candidate');
  assert.equal(
    git(f.repository.source, 'show', '-s', '--format=%P', merged).trim(),
    f.repository.base + ' ' + head,
  );
  assert.equal(git(f.repository.source, 'rev-parse', 'HEAD').trim(), f.repository.base);
  assert.equal(git(f.repository.origin, 'rev-parse', 'staging').trim(), f.repository.base);
  assert.equal(await assembly.assemble(effect, head, f.signal), merged);
  await assert.rejects(
    assembly.assemble(effect, head, AbortSignal.abort(new Error('Cancelled'))),
    /Cancelled/,
  );
});

test('shared assembly refuses changed retained objects and substituted target intent', async (t) => {
  const f = new LiveAssemblyFixture(t);
  const head = String((await f.execute('delivery.commit')).result!.head);
  const assembly = f.assembly;
  const effect = f.intent();
  await assembly.assemble(effect, head, f.signal);
  git(f.repository.source, 'update-ref', 'refs/arcnexus/merges/' + effect.inputDigest, head);
  await assert.rejects(assembly.assemble(effect, head, f.signal), /captured parents/);
  await assert.rejects(
    assembly.assemble({ ...effect, environmentId: 'sim' }, head, f.signal),
    /authority/,
  );
  await assert.rejects(
    assembly.assemble(
      { ...effect, input: { ...effect.input, targetHead: 'HEAD' } },
      head,
      f.signal,
    ),
    /authority/,
  );
});

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
