import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { minimalWorkflowFixture } from '../../testing/support/workflow-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises activity routing through the actual session, SDK adapter and supervised executable. */
class ActivityTurnScenarios {
  /** A single retained assignment changes profiles at host stages without splitting its model thread. */
  workflow(t: TestContext): void {
    const f = minimalWorkflowFixture(t);
    this.profiles(f);
    f.commit();
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    const expected: Record<string, string> = {
      planning: 'gpt-6-luna',
      specification: 'design-model',
      implementation: 'gpt-6-luna',
    };
    const calls = readFileSync(f.calls, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    for (const call of calls) {
      assert.equal(call.args[call.args.indexOf('--model') + 1], expected[call.stage]);
    }
    assert.deepEqual(
      record.turns.map((turn: any) => turn.model),
      Object.values(expected),
    );
    assert.deepEqual(
      record.turns.map((turn: any) => turn.executionProfile),
      ['luna', 'design', 'luna'],
    );
    assert.equal(new Set(record.turns.map((turn: any) => turn.threadId)).size, 1);
  }

  /** Declares distinct model settings once and references them through the real component schema. */
  private profiles(f: ReturnType<typeof minimalWorkflowFixture>): void {
    const base = JSON.parse(
      readFileSync(join(f.repo, 'architecture/execution-profiles/luna.yaml'), 'utf8'),
    );
    for (const id of ['design', 'review'])
      writeFileSync(
        join(f.repo, `architecture/execution-profiles/${id}.json`),
        JSON.stringify({
          ...base,
          id,
          model: `${id}-model`,
          reasoning: 'high',
        }),
      );
    const path = join(f.repo, 'architecture/components/sample.json');
    const component = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(
      path,
      JSON.stringify({ ...component, activityProfiles: { design: 'design', review: 'review' } }),
    );
  }
}

const scenarios = new ActivityTurnScenarios();

test('host workflow selects activity profiles on the retained engineering thread', (t) =>
  scenarios.workflow(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
