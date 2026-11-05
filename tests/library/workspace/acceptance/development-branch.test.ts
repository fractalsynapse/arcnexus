import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { createWorkspace, prepareWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { fixture } from '../support/workspace-fixture.js';

test('each steward branch starts at observed staging and retains verified candidate commits', async (t) => {
  const f = fixture(t);
  const staging = f.git('rev-parse', 'HEAD');
  f.git('branch', 'staging', staging);
  writeFileSync(join(f.repo, 'source.txt'), 'verified dependency');
  f.commit();
  const candidate = f.git('rev-parse', 'HEAD');
  const options = { project: f.repo, base: candidate, branchBase: staging };
  mkdirSync(join(f.state, 'runs'), { recursive: true });
  const first = createWorkspace(f.state, options);
  const second = createWorkspace(f.state, options);
  for (const record of [first, second]) {
    await prepareWorkspace(f.state, record, new AbortController().signal);
    assert.equal(f.git('rev-parse', record.branch + '@{1}'), staging);
    assert.equal(f.git('rev-parse', record.branch), candidate);
  }
  assert.notEqual(first.branch, second.branch);
  assert.equal(f.git('rev-parse', 'staging'), staging);
  const stale = createWorkspace(f.state, { project: f.repo, base: staging, branchBase: candidate });
  await assert.rejects(
    prepareWorkspace(f.state, stale, new AbortController().signal),
    /missing commits/,
  );
  assert.equal(existsSync(stale.workspace), false);
});

registerSuite({
  component: 'workspace',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'development-branch'],
});
