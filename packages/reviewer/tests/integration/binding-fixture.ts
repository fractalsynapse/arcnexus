import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Agent } from '../../../agent/src/index.js';
import type { Capture, TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import type { Plan } from '../../../direction/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import type { Candidate, VerificationIdentity, Verdict } from '../../../verification/src/index.js';
import { assess } from '../../src/index.js';

export const identity: VerificationIdentity = {
  tree: 'recovered-tree',
  base: 'new-staging-parent',
  capture: 'approved-recovery-capture',
  acceptance: 'complete-goal-and-plan-digest',
  inputs: 'actual-checks-and-owner-evidence-digest',
};

export const plan: Plan = {
  focus: { purpose: 'Preserve recovered review identity', objectives: [], constraints: [] },
  milestones: [{
    id: 'recovered-work', owner: 'reviewer', steps: [],
    criteria: [{ id: 'binding', description: 'Assess the recovered candidate' }],
  }],
};

export interface Assignment {
  candidate: string;
  verification?: VerificationIdentity;
  checks: unknown;
  accepted: Extract<Verdict, { kind: 'accepted' }>;
  rejected: Extract<Verdict, { kind: 'rejected' }>;
  diagnostic?: string;
  citationRepair?: { diagnostic: string; verdict: Verdict };
}

type Script = (assignment: Assignment, visit: number) => Verdict;

/** Exercise public assess with a real journal and controlled responses at the Agent boundary. */
export class BindingScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'reviewer-binding-'));
  readonly task: HostTask;
  readonly candidate: Candidate;
  readonly requests: TaskContext[] = [];
  readonly artifacts: string[] = [];
  readonly checks: { id: string; status: number; log: string }[];
  readonly evidence: string;
  private script: Script = () => { throw new Error('Response script not installed'); };

  /** Admit isolated storage and install the controlled boundary without native inference. */
  constructor(t: TestContext, bound = true) {
    this.task = this.admit();
    this.evidence = this.task.store('checks.log', 'Recovered checks: exit 0\nAll scoped assertions ran.\n');
    this.checks = [{ id: 'recovered-owner-tests', status: 0, log: this.evidence }];
    this.candidate = {
      digest: identity.tree, ownerEvidenceDigest: 'recovered-owner-evidence',
      evidence: [this.evidence], ...(bound ? { verification: { ...identity } } : {}),
    };
    t.after(() => { this.task.close(); rmSync(this.root, { recursive: true, force: true }); });
    t.mock.method(this.task, 'check', () => { throw new Error('assess must reuse supplied checks'); });
    t.mock.method(this.task, 'activate', async (_agent: Agent, _selection: unknown, data: TaskContext) =>
      this.respond(data));
  }

  /** Supply every capture field read by assess; native activation is intentionally controlled. */
  private admit() {
    const capture = {
      source: { root: this.root, revision: identity.capture, remote: 'https://example.com/binding.git' },
      project: { verifier: { component: 'reviewer', activity: 'assessment' } },
      operations: {},
    } as unknown as Capture;
    const journal = new Coordination(this.root).admit(capture.source.remote, 'Original goal\nKeep exact requirements.');
    assert('close' in journal);
    return new HostTask({
      capture, common: this.root, executable: '', base: 'staging', fresh: true, storage: this.root,
    }, 'Original goal\nKeep exact requirements.', journal);
  }

  /** Retain distinct complete request and response artifacts, with controlled profile observations. */
  private respond(data: TaskContext) {
    this.requests.push(structuredClone(data));
    const visit = this.requests.length;
    const request = this.task.store('controlled-request.json', JSON.stringify(data));
    const reply = this.script(data.assignment as Assignment, visit);
    const response = this.task.store('controlled-response.json', JSON.stringify(reply));
    const profile = this.task.store('controlled-profile.json', JSON.stringify({
      profile: 'reviewer-assessment', visit, usage: { input: visit * 13, output: visit * 7 },
      provider: 'controlled-fixture',
    }));
    this.artifacts.push(request, response, profile);
    this.task.note({ controlledAttempt: { visit, request, response, profile } });
    return reply;
  }

  /** Run only the public Reviewer boundary with supplied candidate and actual-shaped observations. */
  run(script: Script) {
    this.script = script;
    return assess({} as Agent, this.task, plan, this.candidate, this.checks, new AbortController().signal);
  }

  /** Build an explicit supplied binding independently of the templates being tested. */
  verdict(kind: 'accepted' | 'rejected', verification: VerificationIdentity | undefined = identity): Verdict {
    const common = { candidate: identity.tree, ...(verification ? { verification } : {}) };
    return kind === 'accepted'
      ? { ...common, kind, criteria: ['binding'], evidence: [this.evidence] }
      : { ...common, kind, findings: [{
        criterion: 'binding', owner: 'reviewer', reason: 'Recovered evidence misses the promised behavior.',
        evidence: [this.evidence],
      }] };
  }
}
