import { hostTask } from '../../execution/src/index.js';
import type { StandingGoal } from '../../planner/src/inventory.js';
import type { RunObserver } from './observer.js';
import type {
  CompletedRefinementRound,
  TaskInput,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';

type Child = (input: TaskInput, parent: TaskSession) => Promise<TaskOutcome>;
type ArchitectureChild = (
  directory: string,
  observer: RunObserver,
  signal: AbortSignal,
  parent: TaskSession,
  scope: string,
) => Promise<TaskOutcome>;
type SavedProgress = Extract<NonNullable<ReturnType<TaskSession['history']>[number]>, { refinement: unknown }>['refinement'];

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

  /** Resume the first unacknowledged phase and return one foreground terminal outcome. */
  async execute(): Promise<TaskOutcome> {
    if (!Number.isInteger(this.total) || this.total < 1)
      return { kind: 'invalid', reason: 'Round count must be a positive integer', evidence: [] };
    const invocation = hostTask(this.parent).journal.taskID;
    const saved = this.latestProgress();
    if (saved && saved.total !== this.total)
      return { kind: 'invalid', reason: `Unfinished refinement requested ${saved.total} rounds`, evidence: [] };
    for (let round = saved?.round ?? 1; round <= this.total; round++) {
      const state = round === saved?.round ? saved : undefined;
      const outcome = await this.runRound(invocation, round, state);
      if (outcome) return outcome;
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

  /** Read the latest durable cursor from this task's append-only history. */
  private latestProgress(): SavedProgress | undefined {
    const event = this.parent.history?.().findLast((item) => 'refinement' in item);
    return event && 'refinement' in event ? event.refinement : undefined;
  }

  /** Run each phase in order, then retain the completed round's observation and report. */
  private async runRound(invocation: string, round: number, saved?: SavedProgress) {
    const start = this.observer.eventFrames().length;
    let phase = saved?.phase ?? 'Plan';
    this.progress(invocation, round, phase);
    if (phase === 'Plan') {
      const outcome = await this.runPlanner(invocation, round);
      if (!successfulPhase(outcome)) return outcome;
      this.save(invocation, round, 'Architect', { outcome });
      phase = 'Architect';
    }
    if (phase === 'Architect') {
      const outcome = await this.runArchitect(invocation, round);
      if (!successfulPhase(outcome)) return outcome;
      this.save(invocation, round, 'Run', { outcome });
      phase = 'Run';
    }
    const goals = this.services.execution.round?.(
      this.parent.capture.source.root,
      `refine:${invocation}:${round}`,
    );
    if (!goals) return { kind: 'invalid', reason: 'Standing goal rounds are unavailable', evidence: [] };
    this.save(invocation, round, 'Run', { inventory: goals.goals });
    const index = phase === 'Run' && saved?.phase === 'Run' ? saved.goal ?? 0 : 0;
    const outcome = await this.runGoals(invocation, round, goals.goals, index);
    if (outcome) return outcome;
    goals.finish();
    this.completeRound(invocation, round, goals.goals, start);
  }

  /** Execute the Planner assessment as a normal task child of the retained writer. */
  private runPlanner(invocation: string, round: number) {
    const input: TaskInput = {
      directory: this.parent.capture.source.root,
      goal: 'Assess objectives and standing goals',
      planning: 'objective',
      scope: this.scope(invocation, round, 'plan'),
    };
    return this.phaseOutcome(input);
  }

  /** Execute Architect as a normal child while keeping its round identity distinct. */
  private runArchitect(invocation: string, round: number) {
    const scope = this.scope(invocation, round, 'architect');
    const goal = 'Assess architecture alignment';
    return (
      completedChild(this.parent, goal, scope, ['planned', 'merged']) ??
      this.updateChild(this.parent.capture.source.root, this.observer, this.signal, this.parent, scope)
    );
  }

  /** Reuse a successful phase child if its parent acknowledgement was interrupted. */
  private phaseOutcome(input: TaskInput) {
    return (
      completedChild(this.parent, input.goal, input.scope!, ['planned', 'merged']) ??
      this.runChild(input, this.parent)
    );
  }

  /** Run every goal from this round's pinned inventory in priority order. */
  private async runGoals(
    invocation: string,
    round: number,
    goals: readonly StandingGoal[],
    start: number,
  ): Promise<TaskOutcome | undefined> {
    for (let index = start; index < goals.length; index++) {
      const goal = goals[index]!;
      this.progress(invocation, round, 'Run', index, goals);
      const scope = this.scope(invocation, round, `goal:${goal.id}`);
      const outcome =
        completedChild(this.parent, goal.body, scope, ['merged', 'satisfied']) ??
        (await this.runChild(
          { directory: this.parent.capture.source.root, goal: goal.body, scope, standing: true },
          this.parent,
        ));
      if (outcome.kind !== 'merged' && outcome.kind !== 'satisfied') {
        this.save(invocation, round, 'Run', { goal: index, outcome, inventory: goals });
        return outcome;
      }
      this.save(invocation, round, 'Run', { goal: index + 1, outcome, inventory: goals });
    }
  }

  /** Register the report and expose only references to complete originating evidence. */
  private completeRound(invocation: string, round: number, goals: readonly StandingGoal[], start: number) {
    const frames = this.observer.eventFrames().slice(start);
    const report = this.report(invocation, round, goals, frames);
    const completion: CompletedRefinementRound = {
      invocation,
      round,
      report,
      findings: frames.map((frame) => frame.sequence),
      measurements: frames.filter((frame) => hasMeasurement(frame.observation)).map((frame) => frame.sequence),
      evidence: [...new Set(frames.flatMap((frame) => eventEvidence(frame.observation)))],
    };
    this.parent.record({ completedRound: completion });
    this.save(invocation, round + 1, 'Plan');
  }

  /** Persist the requested total and first unfinished logical position. */
  private save(
    invocation: string,
    round: number,
    phase: 'Plan' | 'Architect' | 'Run',
    details: { goal?: number; inventory?: readonly StandingGoal[]; outcome?: TaskOutcome } = {},
  ) {
    this.parent.record({ refinement: { invocation, total: this.total, round, phase, ...details } });
  }

  /** Publish human progress and persist its matching cursor before activating a child. */
  private progress(
    invocation: string,
    round: number,
    phase: 'Plan' | 'Architect' | 'Run',
    goal?: number,
    inventory?: readonly StandingGoal[],
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

  /** Derive a readable report from full events and the existing event-derived projection. */
  private report(
    invocation: string,
    round: number,
    goals: readonly StandingGoal[],
    frames: readonly import('../../coordination/src/index.js').JournalEvent[],
  ) {
    const text = [
      `# Refinement round ${round}`,
      '',
      `Invocation: ${invocation}`,
      `Captured goals: ${goals.map(({ id, body }) => `${id}: ${body}`).join('; ')}`,
      '',
      '## Complete originating journal observations',
      '',
      frames.map((frame) => JSON.stringify(frame)).join('\\n'),
      '',
      '## Event-derived measurements',
      '',
      JSON.stringify(this.observer.measurementSnapshot(), null, 2),
      '',
    ].join('\\n');
    return hostTask(this.parent).store(`refinement-round-${round}.md`, text);
  }
}

/** Accept only the terminal kinds that mean the child position actually completed. */
function completedChild(parent: TaskSession, goal: string, scope: string, kinds: readonly string[]) {
  const frames = hostTask(parent).journal.childEvents(goal, scope) as Record<string, unknown>[];
  const terminal = frames.findLast((event) => 'outcome' in event)?.outcome as TaskOutcome | undefined;
  return terminal && kinds.includes(terminal.kind) ? terminal : undefined;
}

/** Distinguish successful assessments from pending or failed task outcomes. */
function successfulPhase(outcome: TaskOutcome) {
  return outcome.kind === 'planned' || outcome.kind === 'merged' || outcome.kind === 'satisfied';
}

/** Select event records carrying provider measurement observations. */
function hasMeasurement(value: unknown) {
  return typeof value === 'object' && value !== null && 'provider' in value;
}

/** Preserve every evidence path exposed by an original observation. */
function eventEvidence(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [];
  const evidence = (value as Record<string, unknown>).evidence;
  return Array.isArray(evidence) ? evidence.filter((item): item is string => typeof item === 'string') : [];
}
