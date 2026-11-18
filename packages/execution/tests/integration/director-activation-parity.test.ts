import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import {
  Architecture,
  type ActivitySelection,
  type Capture,
  type TaskContext,
} from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { direct } from '../../../direction/src/index.js';
import { HostTask } from '../../src/index.js';

type Observation = { args: string[]; input: string; cwd: string; tools: unknown[] };

/** Record the complete inputs actually delivered to the shared request builder. */
class RecordingArchitecture extends Architecture {
  delivered?: { capture: Capture; selection: ActivitySelection; task?: TaskContext };

  /** Preserve the original builder and record its activation inputs. */
  override request(capture: Capture, selection: ActivitySelection, task?: TaskContext) {
    this.delivered = { capture, selection, task };
    return super.request(capture, selection, task);
  }
}

/** Prepare the production Director activation and its observing subprocess. */
function scenario() {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-director-parity-'));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('./director-parity-fixture.js', import.meta.url));
  writeFileSync(executable, `#!/bin/sh
export PARITY_OBSERVATION="${observation}"
exec "${process.execPath}" "${fixture}" "$@"
`);
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
  return { root, journal, architecture, capture, goal, observation, task };
}

/** Ensure fixture resources close even when production activation fails. */
function cleanup(t: import('node:test').TestContext, state: ReturnType<typeof scenario>) {
  t.after(() => state.journal.close());
  t.after(() => rmSync(state.root, { recursive: true, force: true }));
}

/** Load the exact input recorded by the subprocess fixture. */
function observed(path: string): Observation {
  return JSON.parse(readFileSync(path, 'utf8')) as Observation;
}

/** Compare complete shared request input and native guidance boundaries. */
function assertPrompt(actual: Observation, expected: ReturnType<Agent['prepareRequest']>, capture: Capture, goal: string) {
  assert.equal(actual.input, expected.request.input);
  for (const path of ['AGENTS.md', '.agents/skills/arcnexus-release/SKILL.md']) {
    const body = capture.source.read(path);
    assert(body.length > 0, path);
    assert(!actual.input.includes(body), `Native guidance body leaked into request: ${path}`);
  }
  assert(actual.input.includes('Source: .arc/architecture/components/direction.yaml (activities.planning)'));
  assert.match(actual.input, /Source: Task inputs supplied at activation/);
  assert(actual.input.includes(goal));
  assert(actual.input.includes('Initial planning'));
  assert(actual.input.includes('Plan the smallest sufficient changes for the goal.'));
}

/** Confirm normal project guidance discovery remains enabled in Codex. */
function assertNativeDiscovery(actual: Observation) {
  assert(actual.args.includes('--ignore-user-config'));
  assert(!actual.args.includes('--no-project-doc'));
  assert(!actual.args.some((arg) => /^(?:project_doc_max_bytes|project_doc_fallback_filenames|features\\.skills)=/.test(arg)));
}

/** Compare effective process settings and MCP schemas to the shared builder. */
function assertInvocation(actual: Observation, expected: ReturnType<Agent['prepareRequest']>) {
  const options = expected.request.options;
  assert.equal(actual.cwd, options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--cd') + 1], options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--model') + 1], options.model);
  assert(actual.args.includes(`model_reasoning_effort=${JSON.stringify(options.modelReasoningEffort)}`));
  assert(actual.args.includes(`web_search=${JSON.stringify(options.webSearchMode)}`));
  assert.deepEqual(actual.tools, options.tools.map(({ handler: _handler, ...tool }) => tool));
}

/** Verify complete activation task context and all observed process behavior. */
async function exercise(t: import('node:test').TestContext) {
  const state = scenario();
  cleanup(t, state);
  await direct(new Agent(state.architecture), state.task, AbortSignal.timeout(10_000));
  const delivered = state.architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, state.capture);
  assert.deepEqual(delivered.selection, state.capture.project.director);
  assert.equal(delivered.task.goal, state.goal);
  assert.equal(delivered.task.milestone, 'Initial planning');
  assert.deepEqual(delivered.task.acceptance, []);
  const expected = new Agent(new Architecture()).prepareRequest(state.capture, delivered.selection, delivered.task);
  const actual = observed(state.observation);
  assertPrompt(actual, expected, state.capture, state.goal);
  assertNativeDiscovery(actual);
  assertInvocation(actual, expected);
}

test('Director production activation forwards the shared request and mapped tools', async (t) => {
  await exercise(t);
});
