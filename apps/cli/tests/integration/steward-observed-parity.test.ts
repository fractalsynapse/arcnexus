import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { Agent } from '../../../../packages/agent/src/index.js';
import {
  Architecture,
  type ActivitySelection,
  type Capture,
  type TaskContext,
} from '../../../../packages/architecture/src/index.js';
import { Coordination, Journal } from '../../../../packages/coordination/src/index.js';
import type { Milestone } from '../../../../packages/direction/src/index.js';
import { HostTask, steward } from '../../../../packages/execution/src/index.js';
import { renderInspection } from '../../src/inspection.js';

type Observation = { args: string[]; input: string; cwd: string; tools: unknown[] };

/** Retain the actual inputs delivered to the shared activation builder. */
class RecordingArchitecture extends Architecture {
  delivered?: { capture: Capture; selection: ActivitySelection; task?: TaskContext };

  /** Record the inputs without changing request construction. */
  override request(capture: Capture, selection: ActivitySelection, task?: TaskContext) {
    this.delivered = { capture, selection, task };
    return super.request(capture, selection, task);
  }
}

const milestone: Milestone = {
  id: 'steward-parity',
  owner: 'execution',
  criteria: [{ id: 'parity', description: 'Observe the supplied task data' }],
  steps: [{
    activity: 'testing',
    checklist: [{ id: 'observe', criteria: ['parity'], expected: 'Observe subprocess input' }],
  }],
};

/** Set up a production host with the CLI's observing Codex subprocess. */
function scenario(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'cli-steward-parity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('../fixtures/director-observation.js', import.meta.url));
  writeFileSync(executable, `#!/bin/sh
export PARITY_OBSERVATION="${observation}"
export PARITY_RESPONSE='{"kind":"completed","edits":[],"checks":[]}'
exec "${process.execPath}" "${fixture}" "$@"
`);
  chmodSync(executable, 0o700);
  const architecture = new RecordingArchitecture();
  const capture = architecture.capture(process.cwd());
  const goal = 'Steward parity fixture goal';
  const journal = new Coordination(root).admit(capture.source.remote, goal);
  assert(journal instanceof Journal);
  t.after(() => journal.close());
  const task = new HostTask(
    { capture, common: root, executable, base: 'staging', fresh: true, storage: root },
    goal, journal,
  );
  task.worktree = capture.source.root;
  return { architecture, capture, goal, observation, task };
}

/** Compare the effective subprocess invocation and exposed MCP schemas. */
function assertInvocation(actual: Observation, view: ReturnType<Agent['prepareRequest']>) {
  const options = view.request.options;
  assert.deepEqual(Buffer.from(actual.input), Buffer.from(view.request.input));
  assert.equal(actual.cwd, options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--cd') + 1], options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--model') + 1], options.model);
  assert(actual.args.includes(`model_reasoning_effort=${JSON.stringify(options.modelReasoningEffort)}`));
  assert(actual.args.includes(`web_search=${JSON.stringify(options.webSearchMode)}`));
  assert.deepEqual(actual.tools, options.tools.map(({ handler: _handler, ...tool }) => tool));
}

/** Preserve captured authority and task assertions in the observed input. */
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
    'packages/execution', 'owner-tests', 'checked-edit', goal,
    'steward-parity', 'Observe subprocess input', 'Observe the supplied task data',
  ]) assert(input.includes(value), value);
}

/** Check the renderer preserves the complete prompt and invocation options. */
function assertRendered(view: ReturnType<Agent['prepareRequest']>) {
  const rendered = renderInspection(view);
  const marker = '--- Codex input ---\n';
  const start = rendered.indexOf(marker);
  assert(start >= 0);
  assert.equal(rendered.slice(start + marker.length), view.request.input);
  assert(rendered.slice(0, start).includes(JSON.stringify(view.request.options, null, 2)));
  assert.deepEqual(view.placeholders, []);
}

test('Steward complete inspection matches production activation and CLI rendering', async (t) => {
  const state = scenario(t);
  const outcome = await steward(
    new Agent(state.architecture), state.task, milestone, 'testing', AbortSignal.timeout(10_000),
  );
  assert.equal(outcome.kind, 'completed');
  const delivered = state.architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, state.capture);
  assert.deepEqual(delivered.selection, { component: 'execution', activity: 'testing' });
  assert.equal(delivered.task.goal, state.goal);
  assert.equal(delivered.task.worktree, state.task.worktree);
  assert.deepEqual(delivered.task.milestone, { id: milestone.id, step: milestone.steps[0] });
  assert.deepEqual(delivered.task.acceptance, milestone.criteria);
  const view = new Agent(new Architecture()).prepareRequest(
    state.capture, delivered.selection, delivered.task,
  );
  const actual = JSON.parse(readFileSync(state.observation, 'utf8')) as Observation;
  assertInvocation(actual, view);
  assertContext(actual.input, state.goal);
  assertRendered(view);
});
