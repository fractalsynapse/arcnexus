import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { parse } from 'yaml';
import { Agent } from '../../../agent/src/index.js';
import {
  Architecture,
  type ActivitySelection,
  type Capture,
  type TaskContext,
} from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import type { Milestone } from '../../../direction/src/index.js';
import { HostTask, steward } from '../../src/index.js';

/** Retain the exact capture, selection and task sent through production activation. */
class RecordingArchitecture extends Architecture {
  delivered?: { capture: Capture; selection: ActivitySelection; task?: TaskContext };

  /** Record inputs while preserving the shared request builder. */
  override request(capture: Capture, selection: ActivitySelection, task?: TaskContext) {
    this.delivered = { capture, selection, task };
    return super.request(capture, selection, task);
  }
}

const milestone: Milestone = {
  id: 'steward-parity',
  owner: 'execution',
  criteria: [{ id: 'parity', description: 'Observe the supplied task data' }],
  steps: [
    {
      activity: 'testing',
      checklist: [{ id: 'observe', criteria: ['parity'], expected: 'Observe subprocess input' }],
    },
  ],
};

/** Prepare the real host activation with a deterministic Codex subprocess. */
function scenario(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-steward-parity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('./director-parity-fixture.js', import.meta.url));
  writeFileSync(
    executable,
    `#!/bin/sh
export PARITY_OBSERVATION="${observation}"
export PARITY_RESPONSE='{"kind":"completed","edits":[],"checks":[]}'
exec "${process.execPath}" "${fixture}" "$@"
`,
  );
  chmodSync(executable, 0o700);
  const architecture = new RecordingArchitecture();
  const capture = architecture.capture(process.cwd());
  const goal = 'Steward parity fixture goal';
  const journal = new Coordination(root).admit(capture.source.remote, goal);
  assert(journal instanceof Journal);
  t.after(() => journal.close());
  const task = new HostTask(
    { capture, common: root, executable, base: 'staging', fresh: true, storage: root },
    goal,
    journal,
  );
  task.worktree = capture.source.root;
  return { architecture, capture, goal, observation, task };
}

/** Compare the effective process invocation with the shared request. */
function assertInvocation(
  actual: { args: string[]; input: string; cwd: string; tools: unknown[] },
  expected: ReturnType<Agent['prepareRequest']>,
) {
  const options = expected.request.options;
  assert.deepEqual(Buffer.from(actual.input, 'utf8'), Buffer.from(expected.request.input, 'utf8'));
  assert.equal(actual.cwd, options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--cd') + 1], options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--model') + 1], options.model);
  assert(
    actual.args.includes(`model_reasoning_effort=${JSON.stringify(options.modelReasoningEffort)}`),
  );
  assert(actual.args.includes(`web_search=${JSON.stringify(options.webSearchMode)}`));
  assert.deepEqual(
    actual.tools,
    options.tools.map(({ handler: _handler, ...tool }) => tool),
  );
}

/** Check captured activity authority and supplied task context are present in actual stdin. */
function assertContext(input: string, goal: string) {
  const activity = input.match(/## Activity\nSource: [^\n]+\n\n([\s\S]*?)\n\n## Role/);
  assert(activity?.[1]);
  assert.deepEqual((parse(activity[1]) as { instructions: string[] }).instructions, [
    'Exercise checked edits, stale hashes, host confinement and descendant cancellation.',
  ]);
  for (const value of [
    'Source: .arc/architecture/components/execution.yaml (activities.testing)',
    'Source: .arc/architecture/roles/designer.yaml',
    'Source: docs/foundation/typescript-standard.md',
    'Source: Task inputs supplied at activation',
    'Express acceptance as a test before anything is built',
    'packages/execution',
    'owner-tests',
    'checked-edit',
    goal,
    'steward-parity',
    'Observe subprocess input',
    'Observe the supplied task data',
  ])
    assert(input.includes(value), value);
}

test('Steward production activation forwards the shared request and mapped tools', async (t) => {
  const { architecture, capture, goal, observation, task } = scenario(t);
  const outcome = await steward(
    new Agent(architecture),
    task,
    milestone,
    'testing',
    AbortSignal.timeout(10_000),
  );
  assert.equal(outcome.kind, 'completed');
  const delivered = architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, capture);
  assert.deepEqual(delivered.selection, { component: 'execution', activity: 'testing' });
  assert.equal(delivered.task.goal, goal);
  assert.equal(delivered.task.worktree, task.worktree);
  assert.deepEqual(delivered.task.milestone, { id: milestone.id, step: milestone.steps[0] });
  assert.deepEqual(delivered.task.acceptance, milestone.criteria);
  const expected = new Agent(new Architecture()).prepareRequest(
    capture,
    delivered.selection,
    delivered.task,
  );
  const actual = JSON.parse(readFileSync(observation, 'utf8')) as {
    args: string[];
    input: string;
    cwd: string;
    tools: unknown[];
  };
  assertInvocation(actual, expected);
  assertContext(actual.input, goal);
});
