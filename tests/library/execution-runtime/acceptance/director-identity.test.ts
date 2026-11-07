import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

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
    assert.equal(
      host.store.run(task.id).status,
      'completed',
      JSON.stringify(host.store.run(task.id).data),
    );
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
      (r) => r.executionRunId === runId && ['director', 'verifier'].includes(r.activationRole),
    );
    assert.ok(direction.some((r) => r.activationRole === 'director'));
    assert.ok(direction.some((r) => r.activationRole === 'verifier'));
    assert.ok(
      direction
        .filter((r) => r.activationRole === 'director')
        .every((r) => r.context.at(-1).id === 'c'),
    );
    assert.ok(
      !reports.some(
        (r) => r.executionRunId === runId && r.activationRole === 'director-assessment',
      ),
    );
    const planning = direction.find((r) => r.activationRole === 'director')!;
    this.planningPrompt(readFileSync(join(root, 'runs', planning.id, 'prompt.txt'), 'utf8'));
  }

  /** Keeps planning instructions distinct from the independently verified goal outcome. */
  private planningPrompt(prompt: string): void {
    assert.match(
      prompt,
      /may propose future engineering assignments within captured owner authority/,
    );
    assert.match(prompt, /never copy a future independent review into worker acceptance criteria/);
    assert.match(prompt, /combined stdout\/stderr/);
    assert.match(prompt, /owned documentation and regression scope/);
    assert.match(prompt, /test-only characterization of already correct behavior/);
    assert.match(prompt, /one independent assembled assessment/);
    assert.match(prompt, /independent review of this task is covered by the built-in reviewer/);
  }
}

const scenarios = new DirectorIdentityScenarios();

test('task planning retains director identity and delegates goal acceptance to the verifier', (t) =>
  scenarios.identity(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
