import assert from 'node:assert/strict';
import test from 'node:test';
import { HostTask } from '../../../execution/src/index.js';

/** Provide an isolated task with locked paths captured before candidate changes. */
function task() {
  const capture = {
    source: { remote: 'https://example.test/project' },
    project: { contractRegistry: 'registry.yaml' },
    contracts: [{ file: 'contract.md', stage: 'locked' }],
    components: { architecture: { id: 'architecture', owns: ['.'] } },
  };
  const journal = { taskID: 'fixture', run: 1, events: () => [], record: () => {} };
  const config = { capture, storage: '/fixture' };
  const host = new HostTask(
    config as unknown as ConstructorParameters<typeof HostTask>[0],
    'fixture',
    journal as unknown as ConstructorParameters<typeof HostTask>[2],
  );
  host.worktree = '/fixture/worktree';
  return { host, capture };
}

for (const path of ['contract.md', 'registry.yaml']) {
  test(`checked edit refuses captured protected path ${path}`, () => {
    const { host } = task();
    assert.throws(
      () => host.edits('architecture', 'testing', [{ path, expected: null, content: 'forged' }]),
      /Locked contract or registry/,
    );
  });
}
