import assert from 'node:assert/strict';
import { git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../support/delivery-fixture.js';

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

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
