import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Coordination } from '../../../coordination/src/index.js';
import { verifiedGoalRun, type HostTask } from '../../src/index.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['evidence'] } as const;
const remote = 'https://github.com/example/fixture.git';
const pull = 'https://github.com/example/fixture/pull/1';

/** Bind actual SQLite and Git identities while controlling the journaled observations. */
class GoalEvidenceScenario {
  private readonly directory = mkdtempSync(join(tmpdir(), 'goal-evidence-'));
  private readonly coordination = new Coordination(join(this.directory, 'state'));
  private readonly revision: string;
  private readonly tree: string;

  /** Create one immutable source tree for the observed staging fixture. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.directory, { force: true, recursive: true }));
    this.git('init', '-q');
    this.git(
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '--allow-empty',
      '-qm',
      'fixture',
    );
    this.revision = this.git('rev-parse', 'HEAD');
    this.tree = this.git('rev-parse', 'HEAD^{tree}');
  }

  /** Record assembled checks, review, and terminal evidence for the attempted tree. */
  publish(tree: string = this.tree, status = 0) {
    const journal = this.coordination.admit(remote, 'Fixture goal');
    assert('record' in journal);
    journal.record({ artifact: 'current.diff' });
    journal.record({ check: { id: 'repository-tests', status } });
    journal.record({ check: { id: 'owner-tests', status: 0 }, scope: { owner: 'fixture' } });
    const candidate = { digest: tree, evidence: ['current.diff'] };
    journal.record({
      candidate,
      verdict: { kind: 'accepted', candidate: tree, criteria: ['coverage'] },
    });
    journal.record({ publication: { candidate: tree } });
    journal.finish({ kind: 'merged', commit: this.revision, evidence: [pull] });
    journal.close();
  }

  /** Evaluate the captured repository through the next task's actual journal connection. */
  read() {
    const journal = this.coordination.admit(remote, 'Assess the fixture');
    assert('record' in journal);
    try {
      const capture = {
        source: { root: this.directory, revision: this.revision },
        project: { checks: { acceptance: ['repository-tests'] } },
      };
      return verifiedGoalRun({ capture, journal } as HostTask);
    } finally {
      journal.finish({ kind: 'planned' });
      journal.close();
    }
  }

  /** Execute local Git fixture commands and remove their trailing newline. */
  private git(...args: string[]) {
    return execFileSync('git', args, {
      cwd: this.directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
}

test('a later task can reuse only passing assembled observations from the verified staging tree', (t) => {
  const scenario = new GoalEvidenceScenario(t);
  scenario.publish('obsolete-tree');
  assert.equal(scenario.read(), undefined);
  scenario.publish(undefined, 1);
  assert.equal(scenario.read(), undefined);
  scenario.publish();
  const evidence = scenario.read();
  assert(evidence);
  assert.equal(evidence.pull, pull);
  assert.deepEqual(evidence.checks, [{ operation: 'repository-tests', status: 0 }]);
});
