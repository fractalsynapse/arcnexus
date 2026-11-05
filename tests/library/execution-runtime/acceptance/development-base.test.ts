import { writeFileSync } from 'node:fs';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { stagingContext } from '../../../../dist/library/execution-runtime/staging-context.js';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { developmentBase } from '../../../../dist/library/execution-runtime/development-base.js';
import { git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { PromotionFixture } from '../support/promotion-fixture.js';

test('steward admission uses isolated staging and rejects a stale authority before dispatch', async (t) => {
  const f = new PromotionFixture(t);
  const source = f.context.source;
  const origin = join(f.general.fixture.root, 'development.git');
  git(source, 'clone', '--bare', '--no-local', '--', source, origin);
  const context = structuredClone(f.context);
  context.bindings.materializations = {
    sample: { source, origin, base: context.base, commonDir: context.commonDir },
  };
  const target = 'refs/heads/staging';
  const resolve = () =>
    developmentBase(
      context,
      'simulation',
      context.base,
      f.general.fixture.root,
      new AbortController().signal,
    );
  git(origin, 'update-ref', '-d', target);
  await assert.rejects(resolve, /missing development branch target/i);
  git(origin, 'update-ref', target, context.base, '');
  assert.equal(await resolve(), context.base);
  const older = git(source, 'rev-parse', context.base + '^').trim();
  git(origin, 'update-ref', target, older, context.base);
  await assert.rejects(resolve, /reconcile retained candidate/i);
  assert.equal(git(origin, 'rev-parse', target).trim(), older);
});

test('live admission pins upstream staging while the caller stays on their development branch', async (t) => {
  const f = new PromotionFixture(t);
  const { repo, root } = f.general.fixture;
  const upstream = 'example/promotion-fixture';
  writeFileSync(join(repo, 'source.txt'), 'Unpublished caller change');
  f.general.fixture.commit();
  const checkout = git(repo, 'rev-parse', 'HEAD').trim();
  f.credential(t);
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ref: 'refs/heads/staging', object: { type: 'commit', sha: f.context.base } }),
  );
  const stage = await stagingContext(
    repo,
    f.context.packageId,
    root,
    upstream,
    'staging',
    new AbortController().signal,
  );
  assert.equal(stage.checkoutAtCapture, checkout);
  const host = new ProjectHost(join(root, 'admission'), stage);
  t.after(() => host.close());
  const run = host.submit('Use real staging');
  assert.equal(run.data.authorityBase, f.context.base);
  assert.equal(run.data.candidateRevision, f.context.base);
  assert.equal(git(repo, 'rev-parse', 'HEAD').trim(), checkout);
  writeFileSync(join(repo, 'source.txt'), 'Later caller change');
  f.general.fixture.commit();
  assert.throws(() => host.submit('Require fresh admission'), /Source revision changed/);
});

/** Pins a controlled provider's actual staging head while the caller has only a development branch. */
async function simulatedWorkday(t: import('node:test').TestContext) {
  const f = new PromotionFixture(t);
  const { repo, root } = f.general.fixture;
  f.general.fixture.git('switch', '-c', 'unpublished');
  writeFileSync(join(repo, 'source.txt'), 'Caller-only change');
  f.general.fixture.commit();
  f.general.fixture.git('branch', '-D', 'staging');
  f.credential(t);
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ref: 'refs/heads/staging', object: { type: 'commit', sha: f.context.base } }),
  );
  const stage = await stagingContext(
    repo,
    f.context.packageId,
    root,
    'example/promotion-fixture',
    'staging',
    new AbortController().signal,
  );
  const host = new ProjectHost(join(root, 'isolated'), stage);
  t.after(() => host.close());
  return { stage, host, request };
}

test('GitHub simulation seeds only actual staging and uses isolated staging throughout the workday', async (t) => {
  const { stage, host, request } = await simulatedWorkday(t);
  host.control('start', true);
  await host.tick();
  const workday = host.store.runs().find((run) => run.mode === 'workday')!;
  const repositories = workday.data.environmentRepositories as Record<string, { origin: string }>;
  const origin = repositories.sample!.origin;
  assert.equal(
    git(origin, 'for-each-ref', '--format=%(refname) %(objectname)').trim(),
    'refs/heads/staging ' + stage.base,
  );
  assert.equal(git(origin, 'remote').trim(), '');
  assert.throws(
    () => host.submit('Race with a different workday', true, 'foreign'),
    /changed before admission/,
  );
  writeFileSync(join(stage.source, 'source.txt'), 'Unrelated local work during simulation');
  const task = host.submit('Use the isolated workday', true, workday.environment!.id);
  assert.equal(task.environment!.id, workday.environment!.id);
  assert.equal(request.mock.callCount(), 1);
});

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'development-branch'],
});
