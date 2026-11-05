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
  await assert.rejects(resolve, /missing simulated development branch target/i);
  git(origin, 'update-ref', target, context.base, '');
  assert.equal(await resolve(), context.base);
  const older = git(source, 'rev-parse', context.base + '^').trim();
  git(origin, 'update-ref', target, older, context.base);
  await assert.rejects(resolve, /reconcile retained candidate/i);
  assert.equal(git(origin, 'rev-parse', target).trim(), older);
});

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'development-branch'],
});
