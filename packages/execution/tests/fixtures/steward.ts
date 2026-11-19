import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import type { TestContext } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { HostTask } from '../../src/index.js';

const components = {
  owner: {
    id: 'owner',
    owns: ['fixture.txt', 'earlier.txt'],
    activities: { implementation: { profile: 'profile', operations: ['owner-tests'] } },
  },
  other: { id: 'other', owns: ['other.txt'], activities: {} },
};

/** Share an isolated real task journal and write scope across steward boundary scenarios. */
export class StewardFixture {
  readonly task: HostTask;

  /** Bind a private fixture worktree; each consumer closes its task before fixture removal. */
  constructor(t: TestContext, root: string) {
    const capture = {
      source: { root, remote: 'https://example.com/project.git' },
      project: { contractRegistry: 'registry.yaml' },
      contracts: [],
      components,
    } as unknown as Capture;
    const goal = 'Exercise failed steward check correction';
    const journal = new Coordination(root).admit(capture.source.remote, goal);
    assert('close' in journal);
    this.task = new HostTask(
      { capture, common: root, executable: '', base: 'staging', fresh: true, storage: root },
      goal,
      journal,
    );
    this.task.worktree = root;
    t.mock.method(this.task, 'cleanup', () => {});
    t.after(() => rmSync(root, { recursive: true, force: true }));
  }
}
