import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { Agent, AgentActivityHold } from '../../../agent/src/index.js';
import {
  type ActivitySelection,
  type TaskContext,
  resolveOperation,
} from '../../../architecture/src/index.js';
import { activities, type Plan } from '../../../direction/src/index.js';
import type { HostTask } from '../../../execution/src/index.js';
import { checkInput, reusableCheck } from '../../../execution/src/check-cache.js';
import { verificationContext } from '../../../execution/src/research.js';
import { verify, type Candidate, type Verdict } from '../../src/index.js';
import {
  answer,
  goal,
  originalRequirement,
  RecoveredProject,
  signal,
} from './recovered-project.js';

type Request = Omit<TaskContext, 'goal' | 'worktree'>;
type CheckResult = Awaited<ReturnType<HostTask['check']>>;
export type CheckState = Pick<CheckResult, 'status' | 'diagnostic'>;

/** Control external responses while retaining production assembly, gate, resolver and journal behavior. */
export class RecoveredAssessment extends RecoveredProject {
  readonly requests: Request[] = [];
  readonly checks: CheckResult[] = [];
  readonly artifacts = new Map<string, string>();
  plan = recoveryPlan();
  replay?: Verdict;
  pause = false;
  checkState: CheckState = { status: 0 };

  /** Preserve distinguishable complete source artifacts once, avoiding recursive transcript fixtures. */
  constructor(private readonly context: TestContext) {
    super(context);
    this.retain('original-plan.json', JSON.stringify({ goal, plan: this.plan }));
    this.retain('original-answer.txt', answer);
    this.retain(
      'original-review.txt',
      'Original attempt finding: preserve boundary.\nFull second line.\n',
    );
    this.task.note({ plan: this.plan });
    this.control();
  }

  /** Reopen retained state before installing the external response controls for the new attempt. */
  resume(...args: Parameters<RecoveredProject['reopen']>) {
    this.reopen(...args);
    this.control();
    this.retain(
      'resumed-finding.txt',
      'Resumed attempt finding: inspect current checks.\nDifferent final line.\n',
    );
  }

  /** Assess the actual assembled record through Verification and its independent Reviewer boundary. */
  async run(candidate?: Candidate) {
    return verify(
      new Agent(this.architecture),
      this.task,
      this.plan,
      candidate ?? (await this.assemble()),
      signal,
    );
  }

  /** Preserve an interruption after the check list reaches the real assessment input builder. */
  async interrupt() {
    this.pause = true;
    await assert.rejects(this.run(), /Controlled interruption before independent verdict/);
    this.pause = false;
  }

  /** A stale external verdict must be refused, either as a hold or as a nonaccepting gate result. */
  async refuseReplay(verdict: Verdict) {
    this.replay = verdict;
    let result: Verdict;
    try {
      result = await this.run();
    } catch (error) {
      assert(error instanceof AgentActivityHold, String(error));
      assert.match(
        error.message,
        /Reviewer|verification|identity|candidate|acceptance|capture|base/i,
      );
      return;
    }
    assert.notEqual(
      result.kind,
      'accepted',
      'Earlier acceptance authorized a changed recovery identity',
    );
  }

  /** Retrieve full authorized artifacts through the same file boundary available to assessment. */
  assertHistory(request = this.requests.at(-1)!) {
    const references = (request.evidence ?? []).flatMap((path) => {
      assert.equal(typeof path, 'string');
      assert(typeof path === 'string');
      const artifact = this.task.readFile(path).text;
      const parsed = path.includes('retained-evidence') ? JSON.parse(artifact) : undefined;
      return parsed?.references ?? [path];
    });
    for (const [path, expected] of this.artifacts) {
      assert(references.includes(path), 'Reviewer lost historical artifact ' + path);
      assert.equal(this.task.readFile(path).text, expected);
    }
    assert.deepEqual(
      request.acceptance,
      this.plan.milestones.flatMap(({ owner, criteria }) =>
        criteria.map((criterion) => ({ owner, ...criterion })),
      ),
    );
    assert.equal(this.task.goal, goal);
  }

  /** Keep exact source text outside maintained code and record its actual host artifact identity. */
  private retain(name: string, text: string) {
    this.artifacts.set(this.task.store(name, text), text);
  }

  /** Simulate process status only; resolve argv and source scope from the real current capture. */
  private control() {
    this.context.mock.method(this.task, 'check', async (id: string) => this.observeCheck(id));
    this.context.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, selection: ActivitySelection, data: Request) => {
        assert.deepEqual(selection, this.task.capture.project.verifier);
        this.requests.push(structuredClone(data));
        if (this.pause) {
          this.task.note(verificationContext(this.task, selection, data));
          throw new Error('Controlled interruption before independent verdict');
        }
        return this.replay ?? this.accept(data);
      },
    );
  }

  /** Resolve current command data and retain the controlled process observation with its complete log. */
  private observeCheck(id: string) {
    const operation = resolveOperation(this.task.capture, id);
    const input = checkInput(this.task, id);
    assert(input, 'Controlled execution still requires real clean candidate inputs');
    const reused = reusableCheck(this.task.observations(), input);
    if (reused) {
      this.task.note({ check: reused, checkInput: input, reusedFrom: reused.log });
      return reused;
    }
    const log = this.task.store(
      id + '.log',
      'Controlled check: ' + JSON.stringify({ operation, input, result: this.checkState }) + '\n',
    );
    const result: CheckResult = {
      id,
      command: operation.command!,
      args: operation.args,
      cwd: this.task.worktree!,
      durationMs: 1,
      log,
      ...this.checkState,
    };
    this.checks.push(result);
    this.task.note({ check: result, checkInput: input });
    return result;
  }

  /** Echo the host's requested binding so tests do not invent a future verdict identity schema. */
  private accept(data: Request) {
    const assignment = data.assignment as { accepted: Record<string, unknown> };
    return {
      ...assignment.accepted,
      kind: 'accepted',
      criteria: this.plan.milestones.flatMap(({ criteria }) => criteria.map(({ id }) => id)),
      evidence: [...this.task.evidence],
    };
  }
}

/** Keep original promises and all ordered activities in the captured plan fixture. */
function recoveryPlan(): Plan {
  return {
    focus: {
      purpose: goal,
      objectives: [originalRequirement],
      constraints: ['Retain original authority history'],
    },
    milestones: [
      {
        id: 'recover',
        owner: 'work',
        criteria: [{ id: 'continuity', description: originalRequirement }],
        steps: activities.map((activity) => ({
          activity,
          checklist:
            activity === 'implementation'
              ? [{ id: 'preserve', criteria: ['continuity'], expected: originalRequirement }]
              : [],
          ...(activity === 'implementation'
            ? {}
            : { inapplicable: 'Outside this verification fixture' }),
        })),
      },
    ],
  };
}
