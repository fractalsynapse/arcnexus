import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Agent } from '../../../../packages/agent/src/index.js';
import {
  Architecture,
  type ActivitySelection,
  type Capture,
  type TaskContext,
} from '../../../../packages/architecture/src/index.js';
import { Coordination, Journal } from '../../../../packages/coordination/src/index.js';
import { direct } from '../../../../packages/direction/src/index.js';
import { HostTask } from '../../../../packages/execution/src/index.js';
import { renderInspection } from '../../src/inspection.js';

type Observation = { args: string[]; input: string; cwd: string; tools: unknown[] };

/** Retain exactly the inputs supplied to the production activation builder. */
class RecordingArchitecture extends Architecture {
  delivered?: { capture: Capture; selection: ActivitySelection; task?: TaskContext };

  /** Record inputs while preserving the canonical request implementation. */
  override request(capture: Capture, selection: ActivitySelection, task?: TaskContext) {
    this.delivered = { capture, selection, task };
    return super.request(capture, selection, task);
  }
}

/** Prepare a real host task with an observing Codex subprocess. */
function scenario() {
  const root = mkdtempSync(join(tmpdir(), 'cli-director-parity-'));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('../fixtures/director-observation.js', import.meta.url));
  writeFileSync(
    executable,
    `#!/bin/sh
export PARITY_OBSERVATION="${observation}"
exec "${process.execPath}" "${fixture}" "$@"
`,
  );
  chmodSync(executable, 0o700);
  const architecture = new RecordingArchitecture();
  const capture = architecture.capture(process.cwd());
  const goal = 'Director parity fixture goal';
  const journal = new Coordination(root).admit(capture.source.remote, goal);
  assert(journal instanceof Journal);
  const task = new HostTask(
    { capture, common: root, executable, base: 'staging', fresh: true, storage: root },
    goal,
    journal,
  );
  return { root, observation, architecture, capture, goal, journal, task };
}

/** Compare effective subprocess options and the schemas exposed by its MCP server. */
function assertInvocation(actual: Observation, view: ReturnType<Agent['prepareRequest']>) {
  const options = view.request.options;
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
  assert(actual.args.includes('--ignore-user-config'));
  assert(!actual.args.includes('--no-project-doc'));
  assert(
    !actual.args.some((arg) =>
      /^(?:project_doc_max_bytes|project_doc_fallback_filenames|features\.skills)=/.test(arg),
    ),
  );
}

/** Compare the CLI renderer with the complete structured request. */
function assertRendered(view: ReturnType<Agent['prepareRequest']>) {
  const rendered = renderInspection(view);
  const marker = '--- Codex input ---\n';
  const start = rendered.indexOf(marker);
  assert(start >= 0);
  assert.equal(rendered.slice(start + marker.length), view.request.input);
  assert(rendered.slice(0, start).includes(JSON.stringify(view.request.options, null, 2)));
  assert.deepEqual(view.placeholders, []);
}

test('Director complete inspection matches production subprocess activation and CLI rendering', async (t) => {
  const state = scenario();
  t.after(() => state.journal.close());
  t.after(() => rmSync(state.root, { recursive: true, force: true }));
  await direct(new Agent(state.architecture), state.task, AbortSignal.timeout(10_000));
  const delivered = state.architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, state.capture);
  assert.deepEqual(delivered.selection, state.capture.project.director);
  assert.equal(delivered.task.goal, state.goal);
  assert.equal(delivered.task.milestone, 'Initial planning');
  assert.deepEqual(delivered.task.acceptance, []);
  const view = new Agent(new Architecture()).prepareRequest(
    state.capture,
    delivered.selection,
    delivered.task,
  );
  const actual = JSON.parse(readFileSync(state.observation, 'utf8')) as Observation;
  assert.equal(actual.input, view.request.input);
  assert.match(
    actual.input,
    /Source: .arc\/architecture\/components\/direction.yaml \(activities.planning\)/,
  );
  assert.match(actual.input, /Source: Task inputs supplied at activation/);
  assert(actual.input.includes(state.goal));
  assert(actual.input.includes('Initial planning'));
  assert(actual.input.includes('Plan the smallest sufficient changes for the goal.'));
  assertInvocation(actual, view);
  assertRendered(view);
});
