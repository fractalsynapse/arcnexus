import assert from 'node:assert/strict';
import { DeliveryCommit } from '../../../../dist/library/operations/delivery-commit.js';
import { join } from 'node:path';
import { git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

test('supervised delivery commits and pushes reviewed bytes without changing source HEAD', async (t) => {
  const f = new GitDeliveryFixture(t);
  const commit = await f.execute('delivery.commit');
  const push = await f.execute('delivery.push');
  assert.equal(commit.status, 'completed');
  assert.equal(push.result!.head, commit.result!.head);
  assert.equal(
    git(f.repository.origin, 'show', `${String(push.result!.head)}:source.txt`),
    'reviewed candidate',
  );
  assert.equal(git(f.repository.source, 'rev-parse', 'HEAD').trim(), f.repository.base);
  assert.equal(git(f.repository.source, 'status', '--porcelain'), '');
  assert.deepEqual(await f.execute('delivery.push'), push);
});

test('host receipt loss reconciles the actual commit without replaying Git', async (t) => {
  const f = new GitDeliveryFixture(t);
  f.effects.prepare({
    id: 'delivery.commit',
    environmentId: 'sim',
    runId: 'run',
    operation: 'delivery.commit',
    target: 'repo',
    definitionDigest: 'policy',
    input: { deliveryId: f.id },
  });
  const result = await f.provider.apply(f.effects.begin('delivery.commit'), f.signal);
  const recovered = await f.executor.recover('delivery.commit', f.signal);
  assert.equal(recovered.status, 'completed');
  assert.equal(recovered.result!.head, result.head);
  assert.equal(recovered.attempt, 1);
});

test('redirected push destination is rejected before any delivery ref exists', async (t) => {
  const f = new GitDeliveryFixture(t);
  git(
    f.repository.source,
    'remote',
    'set-url',
    '--push',
    'origin',
    'https://example.invalid/real.git',
  );
  await assert.rejects(() => f.execute('delivery.commit'), /materialization changed/);
  assert.equal(
    git(
      f.repository.source,
      'for-each-ref',
      '--format=%(refname)',
      'refs/arcnexus/deliveries',
    ).trim(),
    '',
  );
});

test('live delivery uses the shared supervised commit without touching checkout or upstream', async (t) => {
  const f = new GitDeliveryFixture(t);
  const delivery = { ...f.store.get(f.id), environment: { id: 'live', mode: 'live' as const } };
  const provider = new DeliveryCommit(delivery, f.repository.source, join(f.root, 'live-evidence'));
  const effect = f.effects.prepare({
    id: 'live-commit',
    environmentId: 'sim',
    runId: 'run',
    operation: 'delivery.commit',
    target: 'repo',
    definitionDigest: 'policy',
    input: { deliveryId: f.id },
  });
  const intent = { ...effect, environmentId: 'live' };
  const result = await provider.apply(intent, f.signal);
  assert.equal(result.simulation, false);
  assert.equal(git(f.repository.source, 'rev-parse', 'HEAD').trim(), f.repository.base);
  assert.equal(git(f.repository.source, 'status', '--porcelain'), '');
  assert.equal(
    git(f.repository.origin, 'for-each-ref', '--format=%(refname)', 'refs/heads/arcnexus').trim(),
    '',
  );
  assert.deepEqual(await provider.apply(intent, f.signal), result);
  assert.equal(provider.inspect(intent).status, 'completed');
  await assert.rejects(provider.apply({ ...intent, environmentId: 'sim' }, f.signal), /authority/);
});

test('conflicting retained delivery commit cannot be adopted as verified evidence', async (t) => {
  const f = new GitDeliveryFixture(t);
  git(f.repository.source, 'update-ref', 'refs/arcnexus/deliveries/' + f.id, f.repository.base);
  await assert.rejects(f.execute('delivery.commit'), /conflicts with retained state/);
  assert.equal(git(f.repository.source, 'rev-parse', 'HEAD').trim(), f.repository.base);
});

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
