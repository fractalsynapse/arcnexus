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
import type { Plan } from '../../../../packages/direction/src/index.js';
import { HostTask } from '../../../../packages/execution/src/index.js';
import { assess } from '../../../../packages/reviewer/src/index.js';
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

const plan: Plan = {
  focus: { purpose: 'Review the fixture', objectives: [], constraints: [] },
  milestones: [{
    id: 'review-parity',
    owner: 'execution',
    criteria: [{ id: 'parity', description: 'Observe Reviewer subprocess input' }],
    steps: [],
  }],
};

/** Prepare a real assessment with an observing Codex subprocess. */
function scenario(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'cli-reviewer-parity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('../fixtures/director-observation.js', import.meta.url));
  const architecture = new RecordingArchitecture();
  const capture = architecture.capture(process.cwd());
  const goal = 'Reviewer parity fixture goal';
  const journal = new Coordination(root).admit(capture.source.remote, goal);
  assert(journal instanceof Journal);
  t.after(() => journal.close());
  const task = new HostTask(
    { capture, common: root, executable, base: 'staging', fresh: true, storage: root },
    goal,
    journal,
  );
  task.worktree = capture.source.root;
  const evidence = task.store('candidate.diff', 'Fixture candidate diff\n');
  const candidate = { digest: 'fixture-tree', ownerEvidenceDigest: 'fixture-owner', evidence: [evidence] };
  const checks = [{ id: 'fixture-check', status: 0, log: evidence }];
  const response = { kind: 'accepted', candidate: candidate.digest, criteria: ['parity'], evidence: [evidence] };
  writeFileSync(
    executable,
    `#!/bin/sh
export PARITY_OBSERVATION="${observation}"
export PARITY_RESPONSE='${JSON.stringify(response)}'
exec "${process.execPath}" "${fixture}" "$@"
`,
  );
  chmodSync(executable, 0o700);
  return { architecture, capture, goal, observation, task, evidence, candidate, checks };
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

/** Preserve selected activity, sources and task values in observed stdin. */
function assertContext(input: string, state: ReturnType<typeof scenario>) {
  const activity = input.match(/## Activity\nSource: [^\n]+\n\n([\s\S]*?)\n\n## Role/);
  assert(activity?.[1]);
  assert.deepEqual((parse(activity[1]) as { instructions: string[] }).instructions, [
    'Bind the verdict to the assembled-candidate digest.',
    'Return any transferable lesson with the execution evidence that supports it.',
  ]);
  for (const value of [
    'Source: .arc/architecture/components/reviewer.yaml (activities.assessment)',
    'Source: .arc/architecture/roles/reviewer.yaml',
    'Source: Task inputs supplied at activation',
    state.goal, 'review-parity', 'Observe Reviewer subprocess input',
    state.candidate.digest, state.evidence, 'fixture-check', 'fixture-owner',
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

/** Retain the actual assessment inputs, including supplied evidence and check observations. */
function assertTask(task: TaskContext, state: ReturnType<typeof scenario>) {
  assert.equal(task.goal, state.goal);
  assert.equal(task.worktree, state.task.worktree);
  assert.deepEqual(task.milestone, plan.milestones);
  assert.deepEqual(task.acceptance, [{ owner: 'execution', ...plan.milestones[0]!.criteria[0] }]);
  assert.deepEqual(task.evidence, [state.evidence]);
  const assignment = task.assignment as Record<string, unknown>;
  assert.equal(assignment.candidate, state.candidate.digest);
  assert.equal(assignment.ownerEvidenceDigest, state.candidate.ownerEvidenceDigest);
  assert.deepEqual(assignment.checks, state.checks);
  assert.deepEqual(assignment.ownerChecks, []);
  assert.deepEqual(assignment.accepted, {
    kind: 'accepted', candidate: state.candidate.digest,
    criteria: ['all accepted criterion IDs'], evidence: ['evidence paths'],
  });
  assert.deepEqual(assignment.rejected, {
    kind: 'rejected', candidate: state.candidate.digest,
    findings: [{ criterion: 'criterion ID', owner: 'component ID',
      reason: 'observed deficiency', evidence: ['evidence paths'] }],
  });
  assert.match(String(assignment.instructions), /Read the candidate diff and trusted check evidence/);
}

test('Reviewer complete inspection matches production activation and CLI rendering', async (t) => {
  const state = scenario(t);
  await assess(new Agent(state.architecture), state.task, plan, state.candidate, state.checks,
    AbortSignal.timeout(10_000));
  const delivered = state.architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, state.capture);
  assert.deepEqual(delivered.selection, state.capture.project.verifier);
  assert.deepEqual(delivered.selection, { component: 'reviewer', activity: 'assessment' });
  assertTask(delivered.task, state);
  const view = new Agent(new Architecture()).prepareRequest(
    state.capture, delivered.selection, delivered.task,
  );
  const actual = JSON.parse(readFileSync(state.observation, 'utf8')) as Observation;
  assertInvocation(actual, view);
  assertContext(actual.input, state);
  assertRendered(view);
});
