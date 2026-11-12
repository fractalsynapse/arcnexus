import { StewardshipRefusal, type DirectorResult } from '../task-intake/direction.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionRun, RunStance } from '../coordination-store/execution-types.js';
import { AssignmentDispatch } from './assignment-dispatch.js';
import { RunWorkspace } from './run-workspace.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import { InputError } from '../architecture/config.js';

/** What the addressed component produced: a plan to admit, a refusal, or a plan that was not ready. */
interface Proposal {
  plan?: DirectorResult;
  refusal?: StewardshipRefusal;
  notReady?: DirectorResult;
}

/**
 * Activates the component the operator addressed, without the director or the verifier.
 *
 * `task run --component c [--activity a]` states who does the work and, optionally, which activity it
 * starts from. That leaves nothing for the director to plan and nothing for a verifier to review: the
 * addressed component proposes its own work through the same owner-scoped path stewardship already
 * uses, and the same admission applies it. What is absent matters more than what is present —
 * `collaboration.initialize` is never called, because that is the step opening tracking issues,
 * branches and pull requests upstream, and the delivery route is never entered, because there is no
 * candidate to integrate: the edits land in the operator's checkout for them to judge.
 */
export class InPlaceActivation {
  /** Binds the activation to the captured project authority and the shared run store. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
  ) {}

  /** Plans as the addressed component, admits its plan, and records anything that stopped it. */
  async run(
    run: ExecutionRun,
    stance: Extract<RunStance, { kind: 'component' }>,
    signal: AbortSignal,
  ): Promise<void> {
    if (!stance.component)
      throw new InputError('In-place fan-out needs one addressed component per activation');
    const outcome = await this.propose(run, stance, signal);
    if (signal.aborted) return;
    if (outcome.refusal) return this.record(run, this.refusalFields(outcome.refusal));
    if (!outcome.plan)
      return this.record(run, {
        inPlacePlanNotReady: outcome.notReady?.summary ?? null,
        inPlaceQuestions: outcome.notReady?.questions ?? [],
      });
    new AssignmentDispatch(this.root, this.context, this.store).apply(run, outcome.plan);
    // Direction is complete once the component has planned. The goal path records this inside
    // collaboration initialization, which an in-place run never enters: without the marker the
    // scheduler re-runs direction every loop, which is the re-proposal loop that made the first live
    // run admit twelve plans and execute none. The admitted count is recorded beside it because a
    // component that answers "this is already satisfied" legitimately admits zero assignments, and an
    // empty run must never be reported the same way as one that did the work.
    this.store.updateRun(run.id, this.store.run(run.id).status, {
      initialized: true,
      inPlaceAdmitted: this.store.assignments(run.id).length,
    });
  }

  /**
   * Plans through the component's own authority, keeping a refusal a refusal.
   *
   * A component declining on captured authority is neither a failed run nor a question for the
   * operator, so the refusal is returned for the caller to record instead of thrown or swallowed.
   */
  private async propose(
    run: ExecutionRun,
    stance: Extract<RunStance, { kind: 'component' }>,
    signal: AbortSignal,
  ): Promise<Proposal> {
    const workspaces = new RunWorkspace(this.root, this.context, this.store);
    const result = await workspaces
      .direction(run, signal)
      .propose(
        await workspaces.policy(run, signal),
        this.objective(run, stance),
        stance.component,
        undefined,
      )
      .catch(StewardshipRefusal.retain);
    if (result instanceof StewardshipRefusal) return { refusal: result };
    return result.status === 'ready' ? { plan: result } : { notReady: result };
  }

  /** Records an observation that stops the run without changing its authority. */
  private record(run: ExecutionRun, fields: Record<string, unknown>): void {
    this.store.updateRun(run.id, 'needs_attention', fields);
  }

  /** Fields naming who refused, so a report explains the refusal without re-reading records. */
  private refusalFields(refusal: StewardshipRefusal): Record<string, unknown> {
    return {
      inPlaceRefusal: refusal.message,
      refusedBy: refusal.owner,
      directionRecord: refusal.recordId,
    };
  }

  /** The objective given to the component, narrowed to one activity when the caller named it. */
  private objective(run: ExecutionRun, stance: Extract<RunStance, { kind: 'component' }>): string {
    if (!stance.activity) return run.objective;
    return (
      `${run.objective}\n\n` +
      `Perform the ${stance.activity} activity of this component first; other activities follow only ` +
      'if that work requires them.'
    );
  }
}
