import { recordedRound, type RoundCount } from './round-count.js';
import { hostTask } from '../../execution/src/index.js';
import { RunMeasurements, type JournalEvent } from '../../coordination/src/index.js';
import type { StandingGoal } from '../../planner/src/inventory.js';
import type { RunObserver } from './observer.js';
import type {
  CompletedRefinementRound,
  RefinementProgress,
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
type SavedProgress = RefinementProgress;

/** Sequence resumable assessments and goals inside one admitted foreground journal. */
export class RefinementRun {
  /** Bind the sequential child entry points to the parent writer and original observer. */
  constructor(
    private readonly services: WorkflowServices,
    private readonly parent: TaskSession,
    private readonly observer: RunObserver,
    private readonly signal: AbortSignal,
    private readonly total: RoundCount,
    private readonly runChild: Child,
    private readonly updateChild: ArchitectureChild,
  ) {}

  /** Resume the first unacknowledged phase and return one foreground terminal outcome. */
  async execute(): Promise<TaskOutcome> {
    const invocation = hostTask(this.parent).journal.taskID;
    const saved = this.latestProgress();
    if (saved && saved.total !== this.total)
      return {
        kind: 'invalid',
        reason: `Unfinished refinement requested ${saved.total} rounds`,
        evidence: [],
      };
    if (saved?.phase === 'complete')
      return {
        kind: 'planned',
        commit: this.parent.capture.source.revision,
        summary: 'Refinement is complete',
        evidence: hostTask(this.parent).evidence,
      };
    for (
      let round = saved?.round ?? '1';
      BigInt(round) <= BigInt(this.total);
      round = (BigInt(round) + 1n).toString()
    ) {
      const state = round === saved?.round ? saved : undefined;
      const outcome = await this.runRound(invocation, round, state);
      if (outcome) return outcome;
    }
    return this.completeInvocation(invocation);
  }

  /** Record the completed cursor and return the aggregate invocation result. */
  private completeInvocation(invocation: string): TaskOutcome {
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

  /** Recover a report already acknowledged before a round cursor update was interrupted. */
  private roundAlreadyCompleted(invocation: string, round: RoundCount) {
    return Boolean(
      this.parent
        .history?.()
        .some(
          (event) =>
            'completedRound' in event &&
            event.completedRound.invocation === invocation &&
            recordedRound(event.completedRound.round) === round,
        ),
    );
  }

  /** Read the latest durable cursor from this task's append-only history. */
  private latestProgress(): SavedProgress | undefined {
    const event = this.parent.history?.().findLast((item) => 'refinement' in item);
    if (!event || !('refinement' in event)) return undefined;
    const saved = event.refinement;
    if (!['Plan', 'Architect', 'Run', 'complete'].includes(saved.phase))
      throw new Error('Invalid retained refinement phase');
    return { ...saved, total: recordedRound(saved.total), round: recordedRound(saved.round) };
  }

  /** Run each phase in order, then retain the completed round's observation and report. */
  private async runRound(
    invocation: string,
    round: RoundCount,
    saved?: SavedProgress,
  ): Promise<TaskOutcome | undefined> {
    if (this.roundAlreadyCompleted(invocation, round)) {
      this.save(invocation, (BigInt(round) + 1n).toString(), 'Plan');
      return;
    }
    let phase: Exclude<SavedProgress['phase'], 'complete'> =
      saved?.phase === 'complete' ? 'Plan' : (saved?.phase ?? 'Plan');
    this.progress(invocation, round, phase, saved?.goal, saved?.inventory);
    if (phase === 'Plan') {
      const outcome = await this.runPlanner(invocation, round);
      if (!successfulPhase(outcome)) return outcome;
      this.save(invocation, round, 'Architect', { outcome });
      phase = 'Architect';
      this.progress(invocation, round, phase);
    }
    if (phase === 'Architect') {
      const outcome = await this.runArchitect(invocation, round);
      if (!successfulPhase(outcome)) return outcome;
      this.save(invocation, round, 'Run', { outcome });
      phase = 'Run';
      this.progress(invocation, round, phase);
    }
    return this.runInventory(invocation, round, phase, saved);
  }

  /** Capture this round's immutable inventory and resume its first unfinished goal. */
  private async runInventory(
    invocation: string,
    round: RoundCount,
    phase: SavedProgress['phase'],
    saved: SavedProgress | undefined,
  ): Promise<TaskOutcome | undefined> {
    const goals = this.services.execution.round?.(
      this.parent.capture.source.root,
      `refine:${invocation}:${this.roundIdentity(round)}`,
    );
    if (!goals)
      return { kind: 'invalid', reason: 'Standing goal rounds are unavailable', evidence: [] };
    const index = phase === 'Run' && saved?.phase === 'Run' ? (saved.goal ?? 0) : 0;
    this.save(invocation, round, 'Run', { goal: index, inventory: goals.goals });
    const outcome = await this.runGoals(invocation, round, goals.goals, index);
    if (outcome) return outcome;
    this.completeRound(invocation, round, goals.goals);
    goals.finish();
    this.save(invocation, (BigInt(round) + 1n).toString(), 'Plan');
  }

  /** Execute the Planner assessment as a normal task child of the retained writer. */
  private runPlanner(invocation: string, round: RoundCount) {
    const input: TaskInput = {
      directory: this.parent.capture.source.root,
      goal: 'Assess objectives and standing goals',
      planning: 'exploration',
      scope: this.scope(invocation, round, 'plan'),
    };
    return this.phaseOutcome(input);
  }

  /** Execute Architect as a normal child while keeping its round identity distinct. */
  private runArchitect(invocation: string, round: RoundCount) {
    const scope = this.scope(invocation, round, 'architect');
    const goal = 'Assess architecture alignment';
    return (
      completedChild(this.parent, goal, scope, ['planned', 'merged']) ??
      this.updateChild(
        this.parent.capture.source.root,
        this.observer,
        this.signal,
        this.parent,
        scope,
      )
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
    round: RoundCount,
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
  private completeRound(invocation: string, round: RoundCount, goals: readonly StandingGoal[]) {
    const frames = this.originatingFrames(invocation, round, goals);
    const measurements = new RunMeasurements();
    for (const frame of frames) measurements.accept(frame);
    const report = this.report(invocation, round, goals, frames, measurements.snapshot());
    const completion: CompletedRefinementRound = {
      invocation,
      round,
      report,
      findings: frames.map((frame) => frame.sequence),
      measurements: frames
        .filter((frame) => hasMeasurement(frame.observation))
        .map((frame) => frame.sequence),
      evidence: [...new Set(frames.flatMap((frame) => eventEvidence(frame.observation)))],
    };
    this.parent.record({ completedRound: completion });
  }

  /** Rebuild this round from canonical child and descendant history across every attempt. */
  private originatingFrames(invocation: string, round: RoundCount, goals: readonly StandingGoal[]) {
    const host = hostTask(this.parent);
    const children: [string, string][] = [
      ['Assess objectives and standing goals', this.scope(invocation, round, 'plan')],
      ['Assess architecture alignment', this.scope(invocation, round, 'architect')],
      ...goals.map((goal): [string, string] => [
        goal.body,
        this.scope(invocation, round, `goal:${goal.id}`),
      ]),
    ];
    const frames = children.flatMap(([goal, scope]) => host.journal.childTimeline(goal, scope));
    return [...new Map(frames.map((frame) => [frame.sequence, frame])).values()].sort(
      (left, right) => Number(left.sequence) - Number(right.sequence),
    );
  }

  /** Persist the requested total and first unfinished logical position. */
  private save(
    invocation: string,
    round: RoundCount,
    phase: 'Plan' | 'Architect' | 'Run',
    details: { goal?: number; inventory?: readonly StandingGoal[]; outcome?: TaskOutcome } = {},
  ) {
    this.parent.record({ refinement: { invocation, total: this.total, round, phase, ...details } });
  }

  /** Publish human progress and persist its matching cursor before activating a child. */
  private progress(
    invocation: string,
    round: RoundCount,
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
  private scope(invocation: string, round: RoundCount, part: string) {
    return `refine:${invocation}:round:${this.roundIdentity(round)}:${part}`;
  }

  /** Retain the spelling used by old numeric child and inventory identities across retries. */
  private roundIdentity(round: RoundCount) {
    const legacy = this.parent
      .history?.()
      .find(
        (event) =>
          'refinement' in event &&
          typeof event.refinement.round === 'number' &&
          recordedRound(event.refinement.round) === round,
      );
    return legacy && 'refinement' in legacy ? String(legacy.refinement.round) : round;
  }

  /** Derive a readable report from full events and the existing event-derived projection. */
  private report(
    invocation: string,
    round: RoundCount,
    goals: readonly StandingGoal[],
    frames: readonly JournalEvent[],
    measurements: ReturnType<RunMeasurements['snapshot']>,
  ) {
    const recovery = recoveryObservations(
      hostTask(this.parent).history?.() ?? [],
      invocation,
      this.roundIdentity(round),
    );
    return hostTask(this.parent).store(
      `refinement-round-${round}.md`,
      roundReport(invocation, round, goals, frames, measurements, recovery),
    );
  }
}

/** Render a round report from complete source events and the round's recovery evidence. */
function roundReport(
  invocation: string,
  round: RoundCount,
  goals: readonly StandingGoal[],
  frames: readonly JournalEvent[],
  measurements: ReturnType<RunMeasurements['snapshot']>,
  recovery: readonly unknown[],
) {
  return [
    `# Refinement round ${round}`,
    '',
    `Invocation: ${invocation}`,
    `Captured goals: ${goals.map(({ id, body }) => `${id}: ${body}`).join('; ')}`,
    '',
    '## Complete originating journal observations',
    '',
    frames.map((frame) => JSON.stringify(frame)).join('\n'),
    '',
    '## Child recovery observations',
    '',
    JSON.stringify(recovery, null, 2),
    '',
    '## Event-derived measurements',
    '',
    JSON.stringify(measurements, null, 2),
    '',
  ].join('\n');
}

/** Accept only the terminal kinds that mean the child position actually completed. */
function completedChild(
  parent: TaskSession,
  goal: string,
  scope: string,
  kinds: readonly string[],
) {
  const frames = hostTask(parent).journal.childEvents(goal, scope) as Record<string, unknown>[];
  const terminal = frames.findLast((event) => 'outcome' in event)?.outcome as
    TaskOutcome | undefined;
  if (!terminal || !kinds.includes(terminal.kind)) return undefined;
  parent.record({
    phase: 'planning',
    message: `Reused completed child outcome for ${scope}: ${terminal.kind}`,
    evidence: terminal.evidence,
  });
  return terminal;
}

/** Select durable recovery observations without copying assessment content. */
function recoveryObservations(events: readonly unknown[], invocation: string, round: RoundCount) {
  const roundScope = 'for refine:' + invocation + ':round:' + round + ':';
  return events.filter(
    (event) =>
      typeof event === 'object' &&
      event !== null &&
      'phase' in event &&
      Reflect.get(event, 'phase') === 'planning' &&
      typeof Reflect.get(event, 'message') === 'string' &&
      Reflect.get(event, 'message').startsWith('Reused completed child outcome for ') &&
      Reflect.get(event, 'message').includes(roundScope),
  );
}

/** Distinguish successful assessments from pending or failed task outcomes. */
function successfulPhase(outcome: TaskOutcome) {
  return outcome.kind === 'planned' || outcome.kind === 'merged' || outcome.kind === 'satisfied';
}

/** Select event records carrying provider measurement observations. */
function hasMeasurement(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['nativeStarted', 'nativeEvent', 'nativeFinished', 'nativeInvocation'].some(
      (key) => key in value,
    )
  );
}

/** Preserve every evidence path exposed by an original observation. */
function eventEvidence(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [];
  const evidence = (value as Record<string, unknown>).evidence;
  return Array.isArray(evidence)
    ? evidence.filter((item): item is string => typeof item === 'string')
    : [];
}
