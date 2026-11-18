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

/** Compare the observed process configuration and bytes with the shared request. */
function assertInvocation(
  actual: { args: string[]; input: string; cwd: string; tools: unknown[] },
  expected: ReturnType<Agent['prepareRequest']>,
) {
  const options = expected.request.options;
  assert.deepEqual(Buffer.from(actual.input), Buffer.from(expected.request.input));
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

test('Reviewer assessment activation forwards the shared request and mapped tools', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-reviewer-parity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const observation = join(root, 'observation.json');
  const executable = join(root, 'codex');
  const fixture = fileURLToPath(new URL('./director-parity-fixture.js', import.meta.url));
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
  const candidate = {
    digest: 'fixture-tree',
    ownerEvidenceDigest: 'fixture-owner',
    evidence: [evidence],
  };
  const checks = [{ id: 'fixture-check', status: 0, log: evidence }];
  const response = {
    kind: 'accepted',
    candidate: candidate.digest,
    criteria: ['parity'],
    evidence: [evidence],
  };
  writeFileSync(
    executable,
    `#!/bin/sh\nexport PARITY_OBSERVATION="${observation}"\nexport PARITY_RESPONSE='${JSON.stringify(response)}'\nexec "${process.execPath}" "${fixture}" "$@"\n`,
  );
  chmodSync(executable, 0o700);
  await assess(new Agent(architecture), task, plan, candidate, checks, AbortSignal.timeout(10_000));
  const delivered = architecture.delivered;
  assert(delivered?.task);
  assert.equal(delivered.capture, capture);
  assert.deepEqual(delivered.selection, capture.project.verifier);
  assert.deepEqual(delivered.selection, { component: 'reviewer', activity: 'assessment' });
  assert.equal(delivered.task.goal, goal);
  assert.equal(delivered.task.worktree, task.worktree);
  assert.deepEqual(delivered.task.milestone, plan.milestones);
  assert.deepEqual(delivered.task.acceptance, [
    { owner: 'execution', ...plan.milestones[0]!.criteria[0] },
  ]);
  assert.deepEqual(delivered.task.evidence, [evidence]);
  const assignment = delivered.task.assignment as Record<string, unknown>;
  assert.equal(assignment.candidate, candidate.digest);
  assert.equal(assignment.ownerEvidenceDigest, candidate.ownerEvidenceDigest);
  assert.deepEqual(assignment.checks, checks);
  assert.deepEqual(assignment.ownerChecks, []);
  assert.deepEqual(assignment.accepted, {
    kind: 'accepted',
    candidate: candidate.digest,
    criteria: ['all accepted criterion IDs'],
    evidence: ['evidence paths'],
  });
  assert.deepEqual(assignment.rejected, {
    kind: 'rejected',
    candidate: candidate.digest,
    findings: [
      {
        criterion: 'criterion ID',
        owner: 'component ID',
        reason: 'observed deficiency',
        evidence: ['evidence paths'],
      },
    ],
  });
  assert.match(
    String(assignment.instructions),
    /Read the candidate diff and trusted check evidence/,
  );
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
  const activity = actual.input.match(/## Activity\nSource: [^\n]+\n\n([\s\S]*?)\n\n## Role/);
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
    goal,
    'review-parity',
    'Observe Reviewer subprocess input',
    candidate.digest,
    evidence,
    'fixture-check',
    'fixture-owner',
  ])
    assert(actual.input.includes(value), value);
});
