import { hostTask } from '../../execution/src/index.js';
import type { RunObserver } from './observer.js';
import type {
  CompletedRefinementRound,
  TaskInput,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';

type Child = (input: TaskInput, parent: TaskSession) => Promise<TaskOutcome>;
type ArchitectureChild = (directory: string, observer: RunObserver, signal: AbortSignal, parent: TaskSession, scope: string) => Promise<TaskOutcome>;

/** Sequence resumable assessments and goals inside one admitted foreground journal. */
export class RefinementRun {
  /** Bind the sequential child entry points to the parent writer and original observer. */
  constructor(
    private readonly services: WorkflowServices,
    private readonly parent: TaskSession,
    private readonly observer: RunObserver,
    private readonly signal: AbortSignal,
    private readonly total: number,
    private readonly runChild: Child,
    private readonly updateChild: ArchitectureChild,
  ) {}

  /** Resume the first unacknowledged phase while retaining completed outcomes and inventory. */
  async execute(): Promise<TaskOutcome> {
    if (!Number.isInteger(this.total) || this.total < 1)
      return { kind: 'invalid', reason: 'Round count must be a positive integer', evidence: [] };
    const journal = hostTask(this.parent).journal;
    const invocation = journal.taskID;
    const previous = this.parent.history?.().filter((event) => 'refinement' in event).at(-1);
    const saved = previous && 'refinement' in previous ? previous.refinement : undefined;
    if (saved && saved.total !== this.total)
      return { kind: 'invalid', reason: `Unfinished refinement requested ${saved.total} rounds`, evidence: [] };

    for (let round = saved?.round ?? 1; round <= this.total; round++) {
      let phase = round === saved?.round ? saved.phase : 'Plan';
      this.progress(invocation, round, phase);
      if (phase === 'Plan') {
        const scope = this.scope(invocation, round, 'plan');
        const outcome = await this.phaseOutcome(
          'Planner',
          { directory: this.parent.capture.source.root, goal: 'Assess objectives and standing goals', planning: 'objective', scope },
          scope,
        );
        if (!successfulPhase(outcome)) return outcome;
        this.save(invocation, round, 'Architect', { outcome });
        phase = 'Architect';
      }
      if (phase === 'Architect') {
        const scope = this.scope(invocation, round, 'architect');
        const outcome = await this.architectOutcome(scope);
        if (!successfulPhase(outcome)) return outcome;
        this.save(invocation, round, 'Run', { outcome });
        phase = 'Run';
      }

      const namespace = `refine:${invocation}:${round}`;
      const goals = this.services.execution.round?.(this.parent.capture.source.root, namespace);
      if (!goals) return { kind: 'invalid', reason: 'Standing goal rounds are unavailable', evidence: [] };
      this.save(invocation, round, 'Run', { inventory: goals.goals });
      for (let index = phase === 'Run' && round === saved?.round ? saved.goal ?? 0 : 0; index < goals.goals.length; index++) {
        const goal = goals.goals[index]!;
        this.progress(invocation, round, 'Run', index, goals.goals);
        const scope = this.scope(invocation, round, `goal:${goal.id}`);
        const outcome =
          completedChild(this.parent, goal.body, scope, ['merged', 'satisfied']) ??
          (await this.runChild(
            { directory: this.parent.capture.source.root, goal: goal.body, scope, standing: true },
            this.parent,
          ));
        if (outcome.kind !== 'merged' && outcome.kind !== 'satisfied') {
          this.save(invocation, round, 'Run', { goal: index, outcome, inventory: goals.goals });
          return outcome;
        }
        this.save(invocation, round, 'Run', {
          goal: index + 1,
          outcome,
          inventory: goals.goals,
        });
      }
      goals.finish();
      const report = this.report(invocation, round, goals.goals);
      const completion = {
        invocation,
        round,
        report,
        findings: this.observer.eventFrames().map((frame) => frame.sequence),
        measurements: this.observer.eventFrames()
          .filter((frame) => hasMeasurement(frame.observation))
          .map((frame) => frame.sequence),
        evidence: [...new Set(this.observer.eventFrames().flatMap((frame) => eventEvidence(frame.observation)))],
      } satisfies CompletedRefinementRound;
      this.parent.record({ completedRound: completion });
      this.observer.eventFrames();
      this.save(invocation, round + 1, 'Plan');
    }
    this.parent.record({
      refinement: { invocation, total: this.total, round: this.total, phase: 'complete' },
    });
    return {
      kind: 'planned',
      commit: this.parent.capture.source.revision,
      summary: `Completed ${this.total} refinement round(s)`,
      evidence: hostTask(this.parent).evidence,
    };
  }

  /** Reuse a successful child terminal event after an interrupted parent acknowledgement. */
  private async phaseOutcome(title: string, input: TaskInput, scope: string) {
    return (
      completedChild(this.parent, input.goal, scope, ['planned', 'merged']) ??
      (await this.runChild(input, this.parent))
    );
  }

  /** Reuse an acknowledged Architect child or run its ordinary lifecycle under the parent writer. */
  private async architectOutcome(scope: string) {
    return (
      completedChild(this.parent, 'Assess architecture alignment', scope, ['planned', 'merged']) ??
      (await this.updateChild(
        this.parent.capture.source.root,
        this.observer,
        this.signal,
        this.parent,
        scope,
      ))
    );
  }

  /** Retain the durable phase cursor in the existing parent journal. */
  private save(
    invocation: string,
    round: number,
    phase: 'Plan' | 'Architect' | 'Run',
    details: { goal?: number; inventory?: readonly import('../../planner/src/inventory.js').StandingGoal[]; outcome?: TaskOutcome } = {},
  ) {
    this.parent.record({
      refinement: { invocation, total: this.total, round, phase, ...details },
    });
  }

  /** Publish progress with the current round and phase for human-readable adapters. */
  private progress(
    invocation: string,
    round: number,
    phase: 'Plan' | 'Architect' | 'Run',
    goal?: number,
    inventory?: readonly import('../../planner/src/inventory.js').StandingGoal[],
  ) {
    this.observer.progress({
      phase: 'planning',
      message: `Refinement round ${round}/${this.total} · ${phase}${goal === undefined ? '' : ` · goal ${goal + 1}/${inventory?.length ?? 0}`}`,
    });
    this.save(invocation, round, phase, { goal, inventory });
  }

  /** Give every phase and captured goal a stable child identity for restart recovery. */
  private scope(invocation: string, round: number, part: string) {
    return `refine:${invocation}:round:${round}:${part}`;
  }

  /** Derive an external report from complete observed events and register it with the parent. */
  private report(invocation: string, round: number, goals: readonly { id: string; body: string }[]) {
    const frames = this.observer.eventFrames();
    const source = frames.map((frame) => JSON.stringify(frame)).join('\n');
    const text = [
      `# Refinement round ${round}`,
      '',
      `Invocation: ${invocation}`,
      `Captured goals: ${goals.map(({ id, body }) => `${id}: ${body}`).join('; ')}`,
      '',
      '## Complete originating journal observations',
      '',
      source,
      '',
      '## Event-derived measurements',
      '',
      JSON.stringify(this.observer.measurementSnapshot(), null, 2),
      '',
    ].join('\n');
    return hostTask(this.parent).store(`refinement-round-${round}.md`, text);
  }
}

/** Accept only the terminal kinds that mean the child position actually completed. */
function completedChild(
  parent: TaskSession,
  goal: string,
  scope: string,
  kinds: readonly string[],
): TaskOutcome | undefined {
  const frames = hostTask(parent).journal.childEvents(goal, scope) as Record<string, unknown>[];
  const terminal = frames.findLast((event) => 'outcome' in event)?.outcome as TaskOutcome | undefined;
  return terminal && kinds.includes(terminal.kind) ? terminal : undefined;
}

/** Distinguish a successful phase assessment from a durable pending or failed result. */
function successfulPhase(outcome: TaskOutcome) {
  return outcome.kind === 'planned' || outcome.kind === 'merged' || outcome.kind === 'satisfied';
}

/** Identify event-derived measurement records without manufacturing missing values. */
function hasMeasurement(value: unknown) {
  return typeof value === 'object' && value !== null && 'provider' in value;
}

/** Retain all evidence references available in each original journal observation. */
function eventEvidence(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const evidence = record.evidence;
  return Array.isArray(evidence) ? evidence.filter((item): item is string => typeof item === 'string') : [];
}
