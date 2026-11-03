import { RunSelection } from './run-selection.js';
import { RunCreation } from './run-creation.js';
import { RunEnvironments } from './run-environments.js';
import { RunContinuation } from './run-continuation.js';
import { ResourceQuery } from '../report/resource-query.js';
import { HostRecovery } from './host-recovery.js';
import { RunAuthority } from './run-authority.js';
import { ExecutionEvidence, ExecutionReports } from '../report/report.js';
import { StewardshipPolicy } from '../workday/workday.js';
import { git } from '../operations/process.js';
import { InputError } from '../architecture/config.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun } from '../coordination-store/execution-types.js';
import { ExecutionStore } from '../coordination-store/execution-store.js';
import { RunWorkspace } from './run-workspace.js';
import type { RecordData } from '../workspace/state.js';
import { Direction, VerificationIssue } from '../task-intake/direction.js';
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

  private readonly selection: RunSelection;

  private busy = false;

  private active?: { runId: string; controller: AbortController };

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
    this.selection = new RunSelection(context, this.store);
    this.authority = new RunAuthority(context, this.store);
    new HostRecovery(root, this.store, this.authority).recover();
  }

  /** Releases host-owned databases only after managed activation has stopped. */
  close(): void {
    if (this.busy) throw new Error('Cannot close an active execution host');
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
      this.store.updateRun(workday.id, this.active?.runId === workday.id ? 'pausing' : 'paused', {
        pauseReason: 'user',
      });
    else if (action === 'resume') this.continuation(workday);
    else if (action === 'stop') {
      this.store.updateRun(workday.id, this.active?.runId === workday.id ? 'stopping' : 'stopped');
      if (this.active?.runId === workday.id) this.active.controller.abort(new Error('Cancelled'));
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

  /** Queues a goal without interrupting an in-flight safe checkpoint. */
  submit(prompt: string, simulate = false): ExecutionRun {
    if (!prompt.trim()) throw new InputError('Task prompt must not be empty');
    const task = this.create('task', prompt, simulate);
    const workday = this.selection.workday();
    if (workday && ['running', 'idle'].includes(workday.status))
      this.store.updateRun(workday.id, this.active?.runId === workday.id ? 'pausing' : 'paused', {
        pauseReason: 'task',
      });
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
    if (this.active?.runId === id) this.active.controller.abort(new Error('Cancelled'));
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
    const active = this.active?.runId === run.id;
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
    if (this.busy) return;
    const run = this.selection.next();
    if (!run) return;
    this.busy = true;
    this.active = { runId: run.id, controller: new AbortController() };
    try {
      await this.advance(run, this.active.controller.signal);
    } catch (error) {
      this.failure(run.id, error);
    } finally {
      this.settle(run.id);
      this.reports.save(run.id);
      this.active = undefined;
      this.busy = false;
    }
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
    const workday = this.selection.workday();
    const sourceRevision = git(this.context.source, 'rev-parse', 'HEAD').trim();
    return {
      sourceChanged: sourceRevision !== this.context.base,
      capturedRevision: this.context.base,
      sourceRevision,
      workday: workday ? this.reports.view(workday.id).run : undefined,
      active: this.active?.runId ?? null,
      tasks: this.store
        .runs()
        .filter((r) => r.mode === 'task')
        .map((r) => this.reports.view(r.id).run),
      assignments: workday ? this.reports.view(workday.id).assignments : [],
      candidate: String(this.selection.delivery()?.data.candidateRevision ?? this.context.base),
    };
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
    await this.environments.prepare(run, signal);
    run = this.store.run(run.id);
    if (!run.data.workspace) await this.workspaces(run).prepare(run, signal);
    run = this.store.run(run.id);
    if (run.data.workspacePrepared !== true)
      throw new Error('Workspace preparation was interrupted; inspect retained command evidence');
    if (!run.data.initialized) return this.direct(run, signal);
    const ready = this.store.ready(run.id);
    if (ready.length && (run.mode === 'task' || run.data.lastDispatch !== 'assignment')) {
      await new CollaborativeDispatch(this.root, this.context, this.store, this.environments).step(
        run,
        signal,
      );
      this.store.updateRun(run.id, this.store.run(run.id).status, { lastDispatch: 'assignment' });
      return;
    }
    if (run.mode === 'workday') await this.stewardship(run, signal);
    else await this.finishTask(run, signal);
  }

  /** Runs task direction and retains interactive questions before any owner activation. */
  private async direct(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const result = await new Direction(
      this.root,
      this.environments.contextFor(run),
      signal,
    ).propose(await this.workspaces(run).policy(run, signal), this.directionPrompt(run));
    if (signal.aborted) return;
    if (result.status !== 'ready') {
      this.clarification(run, result);
      return;
    }
    if (run.mode === 'task' && !result.assignments.length && !result.continuations.length)
      throw new Error('Task director returned no assignment or continuation');
    await new CollaborativeDispatch(
      this.root,
      this.context,
      this.store,
      this.environments,
    ).initialize(run, result, signal);
  }

  /** Preserves the goal, prior delivery and unresolved findings when interactive clarification returns. */
  private directionPrompt(run: ExecutionRun): string {
    if (run.mode === 'workday')
      return 'Workday setup: assess the captured platform and component purposes, objectives, questions and standards. Select useful bounded starting work when warranted, or return ready with empty assignments and selectedOwners plus a justification. This is self-directed stewardship, not an external goal. The host will fairly rotate all eligible stewards afterward; your initial team does not limit later discovery or inbox requests.';
    const prompt = String(run.data.prompt ?? run.objective);
    const references = this.store
      .runs()
      .filter((prior) => prior.id !== run.id && prompt.includes(prior.id))
      .map((prior) => this.reports.view(prior.id));
    if (!run.data.redirection && !references.length) return prompt;
    return `${prompt}\nUse retained task context as evidence, never new authority. Referenced tasks remain separate; do not replay uncertain operations or silently waive unresolved work. Retained evidence: ${JSON.stringify(
      {
        initialDirection: run.data.initialDirection,
        assignments: this.store.assignments(run.id),
        feedback: run.data.redirection,
        references,
      },
    )}`;
  }

  /** Visits each eligible steward once per changed candidate, interleaved with inbox work. */
  private async stewardship(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const context = this.environments.contextFor(run);
    const seen = (run.data.seen ?? {}) as Record<string, string>;
    const selected = new StewardshipPolicy(context).next(run, this.store.assignments(run.id));
    if (!selected) {
      this.store.updateRun(run.id, this.store.ready(run.id).length ? 'running' : 'idle', {
        lastDispatch: 'stewardship',
      });
      return;
    }
    const { owner, fingerprint } = selected;
    const component = this.context.catalog.components[owner]!;
    const workspace = await this.workspaces(run).policy(run, signal);
    const result = await new Direction(this.root, context, signal).propose(
      workspace,
      JSON.stringify({
        component,
        history: this.store.assignments(run.id).filter((a) => a.owner === owner),
      }),
      owner,
    );
    if (result.status === 'ready')
      new AssignmentDispatch(this.root, this.context, this.store).apply(run, result);
    seen[owner] = fingerprint;
    this.recordStewardship(run, owner, fingerprint, seen, result);
  }

  /** Retains each owner's considered inputs and architectural questions independently. */
  private recordStewardship(
    run: ExecutionRun,
    owner: string,
    fingerprint: string,
    seen: Record<string, string>,
    result: import('../architecture/initialization.js').InitializationResult,
  ): void {
    this.store.updateRun(run.id, this.store.run(run.id).status, {
      seen,
      lastSteward: owner,
      lastDispatch: 'stewardship',
      stewardshipReviews: {
        ...((run.data.stewardshipReviews ?? {}) as object),
        [owner]: {
          fingerprint,
          questions: result.questions,
          summary: result.summary,
          architectureProposal: result.architectureProposal,
        },
      },
    });
  }

  /** Requires all assignments and a separate goal-level assessment before task completion. */
  private async finishTask(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const assignments = this.store.assignments(run.id);
    if (assignments.some((a) => a.status !== 'completed'))
      return this.redirect(
        run,
        { error: 'Goal has undelivered assignments', assignments },
        true,
        signal,
      );
    const record = await this.workspaces(run).policy(run, signal);
    try {
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
      if (!signal.aborted) this.store.updateRun(run.id, 'completed', { goalEvidence: evidence });
    } catch (error) {
      if (!(error instanceof VerificationIssue)) throw error;
      await this.redirect(run, error.result, false, signal);
    }
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
