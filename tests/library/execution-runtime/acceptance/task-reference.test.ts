import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Carries retained noninteractive questions into a new prompt without silently resuming old work. */
class TaskReferenceScenario {
  /** The next director sees the exact referenced question while old task and assignment state remain unchanged. */
  async run(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    const previous = host.submit('Retained goal requiring an answer');
    const assignment = host.store.enqueue(previous.id, 'c', 'Unfinished retained assignment');
    host.store.updateRun(previous.id, 'needs_input', {
      questions: ['Which evidence format: JSON or Markdown?'],
    });
    host.store.updateAssignment(assignment.id, 'waiting');
    const next = host.submit(
      `READ_DIRECTION_EVIDENCE: Use JSON for retained task ${previous.id}; finish the goal`,
    );
    await host.tick();
    this.evidence(f.calls);
    assert.notEqual(next.id, previous.id);
    assert.equal(host.store.run(previous.id).status, 'needs_input');
    assert.equal(host.store.assignment(assignment.id).status, 'waiting');
    assert.equal(host.store.assignments(next.id).length, 1);
  }

  /** Requires exact prior context from the real paged capability rather than an oversized initial prompt. */
  private evidence(path: string): void {
    const calls = readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const prompt = calls.find((call) => call.prompt.startsWith('ArcNexus task direction.')).prompt;
    const trace = JSON.parse(readFileSync(path + '.evidence', 'utf8').trim());
    assert.doesNotMatch(prompt, /Which evidence format: JSON or Markdown/);
    assert.match(trace.artifacts.feedback, /Which evidence format: JSON or Markdown/);
    assert.match(trace.artifacts.feedback, /Unfinished retained assignment/);
    assert.match(trace.artifacts.feedback, /Retained goal requiring an answer/);
  }
}

const scenario = new TaskReferenceScenario();

test('a subsequent prompt gives the director explicitly referenced retained task context', (t) =>
  scenario.run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
