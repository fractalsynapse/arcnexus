import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { Agent } from '../../../agent/src/index.js';
import {
  Architecture,
  type ActivitySelection,
  type Capture,
  type TaskContext,
} from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import type { Plan } from '../../../direction/src/index.js';
import { assess } from '../../../reviewer/src/index.js';
import { HostTask } from '../../src/index.js';

/** Record the complete inputs delivered by production activation to the request builder. */
class RecordingArchitecture extends Architecture {
  delivered?: { capture: Capture; selection: ActivitySelection; task?: TaskContext };

  /** Record the request inputs without changing the shared builder. */
  override request(capture: Capture, selection: ActivitySelection, task?: TaskContext) {
    this.delivered = { capture, selection, task };
    return super.request(capture, selection, task);
  }
}

const plan: Plan = {
  focus: { purpose: 'Review the fixture', objectives: [], constraints: [] },
  milestones: [
    {
      id: 'review-parity',
      owner: 'execution',
      criteria: [{ id: 'parity', description: 'Observe Reviewer subprocess input' }],
      steps: [],
    },
  ],
};

type Observation = { args: string[]; input: string; cwd: string; tools: unknown[] };

/** Prepare a candidate and the production Reviewer activation inputs. */
function scenario() {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-reviewer-parity-'));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('./director-parity-fixture.js', import.meta.url));
  const architecture = new RecordingArchitecture();
  const capture = architecture.capture(process.cwd());
  const goal = 'Reviewer parity fixture goal';
  const journal = new Coordination(root).admit(capture.source.remote, goal);
  assert(journal instanceof Journal);
  const task = new HostTask(
    { capture, common: root, executable, base: 'staging', fresh: true, storage: root },
    goal, journal,
  );
  task.worktree = capture.source.root;
  const evidence = task.store('candidate.diff', 'Fixture candidate diff\\n');
  const candidate = { digest: 'fixture-tree', ownerEvidenceDigest: 'fixture-owner', evidence: [evidence] };
  const checks = [{ id: 'fixture-check', status: 0, log: evidence }];
  const response = { kind: 'accepted', candidate: candidate.digest, criteria: ['parity'], evidence: [evidence] };
  writeFileSync(executable, `#!/bin/sh
export PARITY_OBSERVATION="${observation}"
export PARITY_RESPONSE='${JSON.stringify(response)}'
exec "${process.execPath}" "${fixture}" "$@"
`);
  chmodSync(executable, 0o700);
  return { root, journal, observation, architecture, capture, goal, task, evidence, candidate, checks };
}

/** Release the temporary task journal and fixture directory. */
function cleanup(t: import('node:test').TestContext, state: ReturnType<typeof scenario>) {
  t.after(() => state.journal.close());
  t.after(() => rmSync(state.root, { recursive: true, force: true }));
}

/** Retain every task assignment field requested from the Reviewer. */
function assertAssignment(task: TaskContext, state: ReturnType<typeof scenario>) {
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

/** Confirm the selected activity and supplied task values appear in actual stdin. */
function assertContext(input: string, goal: string, candidate: string, evidence: string) {
  const activity = input.match(/## Activity\\nSource: [^\\n]+\\n\\n([\\s\\S]*?)\\n\\n## Role/);
  assert(activity?.[1]);
  assert.deepEqual((parse(activity[1]) as { instructions: string[] }).instructions, [
    'Bind the verdict to the assembled-candidate digest.',
    'Return any transferable lesson with the execution evidence that supports it.',
  ]);
  for (const value of [
    'Source: .arc/architecture/components/reviewer.yaml (activities.assessment)',
    'Source: .arc/architecture/roles/reviewer.yaml',
    'Source: Task inputs supplied at activation',
    'Bind the verdict to the assembled-candidate digest.',
    'Return any transferable lesson with the execution evidence that supports it.',
    goal, 'review-parity', 'Observe Reviewer subprocess input', candidate,
    evidence, 'fixture-check', 'fixture-owner',
  ]) assert(input.includes(value), value);
}

/** Compare effective invocation options, schemas and actual subprocess bytes. */
function assertInvocation(actual: Observation, expected: ReturnType<Agent['prepareRequest']>) {
  const options = expected.request.options;
  assert.deepEqual(Buffer.from(actual.input), Buffer.from(expected.request.input));
  assert.equal(actual.cwd, options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--cd') + 1], options.workingDirectory);
  assert.equal(actual.args[actual.args.indexOf('--model') + 1], options.model);
  assert(actual.args.includes(`model_reasoning_effort=${JSON.stringify(options.modelReasoningEffort)}`));
  assert(actual.args.includes(`web_search=${JSON.stringify(options.webSearchMode)}`));
  assert.deepEqual(actual.tools, options.tools.map(({ handler: _handler, ...tool }) => tool));
}

/** Run assessment and verify the recorded shared request and selected context. */
async function exercise(t: import('node:test').TestContext) {
  const state = scenario();
  cleanup(t, state);
  await assess(new Agent(state.architecture), state.task, plan, state.candidate, state.checks,
    AbortSignal.timeout(10_000));
  const delivered = state.architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, state.capture);
  assert.deepEqual(delivered.selection, state.capture.project.verifier);
  assert.deepEqual(delivered.selection, { component: 'reviewer', activity: 'assessment' });
  assertTask(delivered.task, state);
  assertAssignment(delivered.task, state);
  const expected = new Agent(new Architecture()).prepareRequest(
    state.capture, delivered.selection, delivered.task,
  );
  const actual = JSON.parse(readFileSync(state.observation, 'utf8')) as Observation;
  assertInvocation(actual, expected);
  assertContext(actual.input, state.goal, state.candidate.digest, state.evidence);
}

/** Compare milestone, acceptance and evidence fields passed to Reviewer activation. */
function assertTask(task: TaskContext, state: ReturnType<typeof scenario>) {
  assert.equal(task.goal, state.goal);
  assert.equal(task.worktree, state.task.worktree);
  assert.deepEqual(task.milestone, plan.milestones);
  assert.deepEqual(task.acceptance, [
    { owner: 'execution', ...plan.milestones[0]!.criteria[0] },
  ]);
  assert.deepEqual(task.evidence, [state.evidence]);
}

test('Reviewer assessment activation forwards the shared request and mapped tools', async (t) => {
  await exercise(t);
});
