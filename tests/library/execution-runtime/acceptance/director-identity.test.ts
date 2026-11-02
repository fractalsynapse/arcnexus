import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture } from '../../testing/support/general-fixture.js';

/** Exercises captured director identity through production task routing and goal assessment. */
class DirectorIdentityScenarios {
  /** Direction uses the captured director while dynamic engineering assignments keep their own owners. */
  async identity(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const context = new ExecutionContext().resolve(f.repo);
    context.directorComponent = 'c';
    const host = new ProjectHost(f.state, context);
    t.after(() => host.store.close());
    const task = host.submit('Research the supplier chain');
    for (let observation = 0; observation < 30; observation++) {
      await host.tick();
      if (host.store.run(task.id).status !== 'running') break;
    }
    assert.equal(host.store.run(task.id).status, 'completed');
    assert.deepEqual(
      host.store.assignments(task.id).map((a) => a.owner),
      ['a', 'b', 'c'],
    );
    this.directionEvidence(f.state, task.id);
  }

  /** Checks retained production prompts and actor identities, independently of controlled model claims. */
  private directionEvidence(root: string, runId: string): void {
    const reports = readdirSync(join(root, 'runs')).map((id) =>
      JSON.parse(readFileSync(join(root, 'runs', id, 'report.json'), 'utf8')),
    );
    const direction = reports.filter(
      (r) =>
        r.executionRunId === runId &&
        ['director', 'director-assessment'].includes(r.activationRole),
    );
    assert.ok(direction.some((r) => r.activationRole === 'director'));
    assert.ok(direction.some((r) => r.activationRole === 'director-assessment'));
    assert.ok(direction.every((r) => r.context.at(-1).id === 'c'));
    const planning = direction.find((r) => r.activationRole === 'director')!;
    const prompt = readFileSync(join(root, 'runs', planning.id, 'prompt.txt'), 'utf8');
    assert.match(prompt, /combined stdout\/stderr/);
    assert.match(prompt, /automatically runs independent delivery verification/);
    assert.match(prompt, /independent review of this task is covered by the built-in reviewer/);
  }
}

const scenarios = new DirectorIdentityScenarios();

test('task planning and final assessment retain the captured director component', (t) =>
  scenarios.identity(t));

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
