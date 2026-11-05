import { RunPromotion } from './run-promotion.js';
import { HostActivation } from './host-activation.js';
import { RunPublication } from './run-publication.js';
import { RunSelection } from './run-selection.js';
import { RunCreation } from './run-creation.js';
import { RunEnvironments } from './run-environments.js';
import { RunContinuation } from './run-continuation.js';
import { ResourceQuery } from '../report/resource-query.js';
import { HostRecovery } from './host-recovery.js';
import { RunAuthority } from './run-authority.js';
import { ExecutionEvidence, ExecutionReports } from '../report/report.js';
import { StewardshipPolicy } from '../workday/workday.js';
import { InputError } from '../architecture/config.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import { ExecutionStore } from '../coordination-store/execution-store.js';
import { RunWorkspace } from './run-workspace.js';
import type { RecordData } from '../workspace/state.js';
import { Direction, StewardshipRefusal, VerificationIssue } from '../task-intake/direction.js';
import { ProgressObserver } from '../report/progress.js';
import type { InitializationResult } from '../architecture/initialization.js';
import { AssignmentDispatch } from './assignment-dispatch.js';
import { CollaborativeDispatch } from './collaborative-dispatch.js';

/** Owns sequential project execution while task and workday policies select different work. */
export class ProjectHost {
  readonly store: ExecutionStore;

  readonly reports: ExecutionReports;

  private readonly environments: RunEnvironments;

  private readonly authority: RunAuthority;

  private readonly collaboration: CollaborativeDispatch;

  private readonly selection: RunSelection;

  private readonly activation = new HostActivation();

  /** Opens durable project state without automatically replaying interrupted activations. */
  constructor(
    readonly root: string,
    readonly context: ProjectExecution,
  ) {
    mkdirSync(join(root, 'runs'), { recursive: true, mode: 0o700 });
    mkdirSync(join(root, 'workspaces'), { recursive: true, mode: 0o700 });
    this.store = new ExecutionStore(join(root, 'projects', context.key, 'execution.sqlite'));
    this.reports = new ExecutionReports(join(root, 'projects', context.key), this.store);
    this.environments = new RunEnvironments(root, context, this.store);
    this.collaboration = new CollaborativeDispatch(root, context, this.store, this.environments);
    this.selection = new RunSelection(context, this.store);
    this.authority = new RunAuthority(context, this.store);
    new HostRecovery(root, this.store, this.authority).recover();
  }

  /** Releases host-owned databases only after managed activation has stopped. */
  close(): void {
    if (this.activation.busy) throw new Error('Cannot close an active execution host');
    this.environments.effects.close();
    this.store.close();
  }

  /** Applies user lifecycle intent immediately; active work reaches a checkpoint before pause. */
  control(action: string, simulate = false): unknown {
    let workday = this.selection.workday();
    if (action === 'status') return this.status();
    if (action === 'start' && (!workday || workday.status === 'stopped'))
      workday = this.create('workday', 'Self-directed stewardship', simulate);
    if (!workday) throw new Error('No workday exists');
    if (workday.status === 'stopped' && ['pause', 'stop'].includes(action)) return this.status();
    if (action === 'pause' && workday.status !== 'stopped')
      this.store.updateRun(
        workday.id,
        this.activation.current?.runId === workday.id ? 'pausing' : 'paused',
        {
          pauseReason: 'user',
        },
      );
    else if (action === 'resume') this.continuation(workday);
    else if (action === 'stop') {
      this.store.updateRun(
        workday.id,
        this.activation.current?.runId === workday.id ? 'stopping' : 'stopped',
      );
      if (this.activation.current?.runId === workday.id)
        this.activation.current.controller.abort(new Error('Cancelled'));
    } else if (!['start', 'status'].includes(action)) throw new Error('Unknown workday action');
    return this.status();
  }

  /** Binds workday mutations to their retained identity so a historical request cannot affect newer work. */
  workdayControl(action: string, id: string, expectedRevision?: string) {
    const run = this.store.run(id);
    if (run.mode !== 'workday') throw new InputError('Expected workday identity');
    if (
      expectedRevision !== undefined &&
      new ResourceQuery().revision(this.reports.view(id)) !== expectedRevision
    )
      throw new InputError('Stale workday revision; read the workday again');
    if (run.status === 'stopped' && ['pause', 'stop'].includes(action))
      return this.reports.view(id);
    if (this.selection.workday()?.id !== id)
      throw new InputError('Historical workday cannot resume or control current execution');
    if (!['pause', 'resume', 'stop'].includes(action))
      throw new InputError('Unknown workday action');
    this.control(action);
    return this.reports.view(id);
  }

  /** Queues publication under the sole repository host without overlapping active engineering. */
  publish(id: string, expectedRevision?: string) {
    return new RunPublication(this.root, this.context, this.store).request(id, expectedRevision);
  }

  /** Starts fresh-target promotion in the same task queue and repository execution lock. */
  promote(id: string, expectedRevision?: string) {
    return new RunPromotion(this.root, this.context, this.store, this.environments).request(
      id,
      expectedRevision,
      (prompt) => this.submit(prompt),
    );
  }

  /** Queues a goal without interrupting an in-flight safe checkpoint. */
  submit(prompt: string, simulate = false, expectedEnvironmentId?: string): ExecutionRun {
    if (!prompt.trim()) throw new InputError('Task prompt must not be empty');
    const workday = this.selection.workday();
    const reusable = simulate && this.environments.reusable('simulation', workday);
    if (expectedEnvironmentId && expectedEnvironmentId !== reusable)
      throw new InputError(
        'Simulated workday changed before admission; submit again to capture staging',
      );
    const task = this.create('task', prompt, simulate);
    if (workday && ['running', 'idle'].includes(workday.status))
      this.store.updateRun(
        workday.id,
        this.activation.current?.runId === workday.id ? 'pausing' : 'paused',
        {
          pauseReason: 'task',
        },
      );
    return task;
  }

  /** Retains a clarification response and schedules the director on the same task. */
  answer(id: string, answer: string): void {
    if (!answer.trim()) throw new InputError('Task answer must not be empty');
    const run = this.store.run(id);
    this.authority.assert(run);
    if (run.mode !== 'task' || run.status !== 'needs_input')
      throw new InputError('Task is not awaiting input');
    this.store.updateRun(id, 'running', {
      prompt: String(run.data.prompt ?? run.objective) + '\nArchitect response: ' + answer,
      initialized: false,
    });
  }

  /** Cancels only the identified task and preserves its candidate and logs. */
  cancel(id: string, explicitStop = false): void {
    const run = this.store.run(id);
    if (run.mode !== 'task') throw new Error('Expected task identity');
    if (['completed', 'cancelled', 'failed', 'stopped'].includes(run.status)) return;
    if (!explicitStop && ['interrupted', 'needs_attention'].includes(run.status)) return;
    this.store.updateRun(id, 'cancelled');
    if (this.activation.current?.runId === id)
      this.activation.current.controller.abort(new Error('Cancelled'));
  }

  /** Applies task intent at the host boundary and rejects stale resource mutations before effects. */
  taskControl(action: string, id: string, answer?: string, expectedRevision?: string) {
    const run = this.store.run(id);
    if (run.mode !== 'task') throw new InputError('Expected task identity');
    if (
      expectedRevision !== undefined &&
      new ResourceQuery().revision(this.reports.view(id)) !== expectedRevision
    )
      throw new InputError('Stale task revision; read the task again');
    if (action === 'stop') this.cancel(id, true);
    else if (action === 'answer') this.answer(id, answer ?? '');
    else if (action === 'pause') this.pauseTask(run);
    else if (action === 'resume') {
      if (run.status !== 'running') {
        if (!['paused', 'interrupted'].includes(run.status))
          throw new InputError('Task cannot resume from ' + run.status);
        this.continuation(run);
      }
    } else throw new InputError('Unknown task action');
    return this.reports.view(id);
  }

  /** Pauses only actionable tasks and preserves missing-input and terminal outcomes. */
  private pauseTask(run: ExecutionRun): void {
    if (['paused', 'pausing'].includes(run.status)) return;
    if (run.status !== 'running') throw new InputError('Task cannot pause from ' + run.status);
    const active = this.activation.current?.runId === run.id;
    this.store.updateRun(run.id, active ? 'pausing' : 'paused', {
      pauseReason: 'user',
      executionOwner: active,
    });
  }

  /** Reuses checkpoint validation for both run modes without replacing retained plans or dependencies. */
  private continuation(run: ExecutionRun): void {
    new RunContinuation(this.root, this.context.base, this.store, this.authority).resume(
      run,
      this.selection.delivery(run.environment),
    );
  }

  /** Executes at most one activation so IPC controls remain responsive between checkpoints. */
  async tick(): Promise<void> {
    if (this.activation.busy || this.activation.closing) return;
    const run = this.selection.next();
    if (!run) return;
    await this.activation.run(run.id, async (signal) => {
      try {
        await this.advance(run, signal);
      } catch (error) {
        this.failure(run.id, error);
      } finally {
        this.settle(run.id);
        this.reports.save(run.id);
      }
    });
  }

  /** Drains managed execution and persists interruption before the caller closes host stores. */
  async shutdown(): Promise<void> {
    await this.activation.shutdown(this.store, this.reports);
    new HostRecovery(this.root, this.store, this.authority).recover();
  }

  /** Quarantines integrity failures across mode handoffs while retaining ordinary task failure isolation. */
  private failure(id: string, error: unknown): void {
    const current = this.store.run(id);
    if (!['cancelled', 'stopping', 'stopped'].includes(current.status))
      this.store.updateRun(id, 'needs_attention', { error: String(error) });
    if (!(error instanceof Error) || error.name !== 'CandidateIntegrityError') return;
    this.store.updateRun(id, this.store.run(id).status, { integrityError: String(error) });
    const workday = this.selection.workday();
    if (workday && workday.status !== 'stopped')
      this.store.updateRun(workday.id, 'needs_attention', { integrityError: String(error) });
  }

  /** Projects current lifecycle and accountable assignments for the option-free status command. */
  status() {
    return this.selection.status(this.activation.current?.runId ?? null, this.reports);
  }

  /** Captures a new run against the last compatible verified candidate. */
  private create(mode: 'task' | 'workday', objective: string, simulate = false): ExecutionRun {
    return new RunCreation(this.context, this.store, this.environments).create(
      mode,
      objective,
      simulate,
      mode === 'task' ? this.selection.workday() : undefined,
    );
  }

  /** Resolves isolated run source without replacing the captured steward catalog or profiles. */
  private workspaces(run: ExecutionRun): RunWorkspace {
    return new RunWorkspace(this.root, this.environments.contextFor(run), this.store);
  }

  /** Prepares context, advances ready assignments or invokes the mode-specific selection policy. */
  private async advance(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    this.authority.assert(run);
    if (run.data.pendingPublication)
      return new RunPublication(this.root, this.context, this.store).advance(
        run,
        this.environments,
        signal,
      );
    if (run.data.promotionSource)
      return new RunPromotion(this.root, this.context, this.store, this.environments).advance(
        run,
        signal,
      );
    await this.environments.prepare(run, signal);
    run = this.store.run(run.id);
    if (!run.data.workspace) await this.workspaces(run).prepare(run, signal);
    run = this.store.run(run.id);
    if (run.data.workspacePrepared !== true)
      throw new Error('Workspace preparation was interrupted; inspect retained command evidence');
    if (!run.data.initialized) return this.direct(run, signal);
    await this.advanceAssignments(run, signal);
  }

  /** Reconciles collaboration before engineering or goal assessment can pass a retained milestone. */
  private async advanceAssignments(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    await this.collaboration.progress(run, signal);
    const ready = this.store.ready(run.id);
    if (ready.length && (run.mode === 'task' || run.data.lastDispatch !== 'assignment')) {
      await this.dispatchAssignment(run, signal);
      return;
    }
    if (run.mode === 'workday') await this.stewardship(run, signal);
    else await this.finishTask(run, signal);
  }

  /** Executes ready engineering and retains any verified workday delivery before another activation. */
  private async dispatchAssignment(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    await this.collaboration.step(run, signal);
    this.store.updateRun(run.id, this.store.run(run.id).status, { lastDispatch: 'assignment' });
    if (run.mode === 'workday')
      await new RunPublication(this.root, this.context, this.store).advance(
        this.store.run(run.id),
        this.environments,
        signal,
      );
  }

  /** Runs task direction and retains interactive questions before any owner activation. */
  private async direct(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const input = this.workspaces(run).directionInput(run, this.reports);
    const result = await new Direction(
      this.root,
      this.environments.contextFor(run),
      signal,
    ).propose(
      await this.workspaces(run).policy(run, signal),
      input.prompt,
      undefined,
      input.retained,
    );
    if (signal.aborted) return;
    if (result.status !== 'ready') {
      this.clarification(run, result);
      return;
    }
    if (run.mode === 'task' && !result.assignments.length && !result.continuations.length)
      throw new Error('Task director returned no assignment or continuation');
    await this.collaboration.initialize(run, result, signal);
  }

  /** Visits each eligible steward once per changed candidate, interleaved with inbox work. */
  private async stewardship(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const context = this.environments.contextFor(run);
    const selected = new StewardshipPolicy(context).next(run, this.store.assignments(run.id));
    if (!selected) {
      this.store.updateRun(run.id, this.store.ready(run.id).length ? 'running' : 'idle', {
        lastDispatch: 'stewardship',
      });
      return;
    }
    const { owner, fingerprint } = selected;
    const workspace = await this.workspaces(run).policy(run, signal);
    const result = await new Direction(this.root, context, signal)
      .propose(
        workspace,
        'Self-directed stewardship based on captured purpose, objectives, questions and inbox.',
        owner,
        {
          purpose:
            'Review completed findings and unresolved owner work in the retained state before proposing another assignment. Worker results are claims; preserve observed checkpoint and delivery status.',
          state: this.store.assignments(run.id).filter((a) => a.owner === owner),
          feedback: null,
        },
      )
      .catch(StewardshipRefusal.retain);
    if (signal.aborted) return;
    const dispatch = new AssignmentDispatch(this.root, this.context, this.store);
    const checkpoint = dispatch.stewardshipCheckpoint(run, owner, fingerprint, result);
    if (result.status === 'ready') dispatch.apply(run, result, checkpoint);
    else this.store.updateRun(run.id, this.store.run(run.id).status, checkpoint);
  }

  /** Requires all assignments and a separate goal-level assessment before task completion. */
  private async finishTask(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const assignments = this.store.assignments(run.id);
    if (assignments.some((a) => this.store.effective(a.id).status !== 'completed'))
      return this.redirect(
        run,
        { error: 'Goal has undelivered assignments', assignments },
        true,
        signal,
      );
    if (run.data.goalEvidence && run.data.goalCandidate === run.data.candidateRevision)
      return this.completeTask(run, signal);
    try {
      await this.assessGoal(run, assignments, signal);
      if (!signal.aborted) await this.completeTask(this.store.run(run.id), signal);
    } catch (error) {
      if (!(error instanceof VerificationIssue)) throw error;
      await this.redirect(run, error.result, false, signal);
    }
  }

  /** Retains goal acceptance as a checkpoint before publication or terminal run transitions. */
  private async assessGoal(
    run: ExecutionRun,
    assignments: ExecutionAssignment[],
    signal: AbortSignal,
  ): Promise<void> {
    const record = await this.workspaces(run).policy(run, signal);
    const evidence = await new Direction(
      this.root,
      this.environments.contextFor(run),
      signal,
    ).verify(
      record,
      run.owners[0]!,
      run.objective,
      assignments,
      true,
      new ExecutionEvidence(this.root, this.store).capture(run.id),
    );
    if (!signal.aborted)
      this.store.updateRun(run.id, this.store.run(run.id).status, {
        goalEvidence: evidence,
        goalCandidate: run.data.candidateRevision,
      });
  }

  /** Completes only after idempotent publication capture, so host loss cannot omit a verified delivery. */
  private async completeTask(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    if (this.store.run(run.id).status !== 'running') return;
    await new RunPublication(this.root, this.context, this.store).advance(
      run,
      this.environments,
      signal,
    );
    if (signal.aborted || this.store.run(run.id).status !== 'running') return;
    this.store.updateRun(run.id, 'completed');
  }

  /** Reactivates goal direction without discarding deliveries or fabricating resolution of blocked work. */
  private async redirect(
    run: ExecutionRun,
    feedback: unknown,
    blocked: boolean,
    signal: AbortSignal,
  ): Promise<void> {
    this.observeGoalFailure(run, feedback);
    const record = await this.workspaces(run).policy(run, signal);
    const result = await new Direction(
      this.root,
      this.environments.contextFor(run),
      signal,
    ).reconsider(record, run.objective, this.store.assignments(run.id), feedback, blocked);
    if (signal.aborted) return;
    this.store.updateRun(run.id, this.store.run(run.id).status, {
      redirection: feedback,
      directionHistory: [...((run.data.directionHistory ?? []) as unknown[]), result],
    });
    this.applyRedirection(run, result, blocked);
  }

  /** Accepts diagnosed continuations without treating new unrelated assignments as resolution of blockers. */
  private applyRedirection(
    run: ExecutionRun,
    result: import('../task-intake/direction.js').DirectorResult,
    blocked: boolean,
  ): void {
    if (result.status !== 'ready') this.clarification(run, result);
    else if (
      (blocked && !result.continuations.length) ||
      (!result.assignments.length && !result.continuations.length)
    )
      this.store.updateRun(run.id, 'needs_attention', {
        error: 'Director has not resolved required work',
        recoveryProposal: result,
      });
    else new AssignmentDispatch(this.root, this.context, this.store).apply(run, result);
  }

  /** Captures substantive questions and architectural proposals before the task releases execution. */
  private clarification(run: ExecutionRun, result: InitializationResult): void {
    this.store.updateRun(run.id, 'needs_input', {
      questions: result.questions,
      architectureProposal: result.architectureProposal,
      direction: result,
    });
  }

  /** Records repeated equivalent goal failures using retained progress evidence rather than a retry allowance. */
  private observeGoalFailure(run: ExecutionRun, feedback: unknown): void {
    const record = this.store.run(run.id).data.workspace as RecordData;
    new ProgressObserver(this.root, record).failed(
      { activity: 'goal-assessment' },
      JSON.stringify(feedback),
      String(run.data.candidateRevision),
    );
    this.store.updateRun(run.id, this.store.run(run.id).status, { workspace: record });
  }

  /** Completes pending control requests without allowing a worker result to overwrite user intent. */
  private settle(id: string): void {
    const run = this.store.run(id);
    if (run.mode === 'task' && run.status !== 'running')
      this.store.updateRun(id, run.status, { executionOwner: false });
    if (run.status === 'pausing') this.store.updateRun(id, 'paused');
    if (run.status === 'stopping') this.store.updateRun(id, 'stopped');
  }
}
