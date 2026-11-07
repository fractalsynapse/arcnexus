import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type {
  ActivationResult,
  ExecutionAssignment,
} from '../coordination-store/execution-types.js';

/** Dispatches one durable activation at a time without recursively invoking dependency owners. */
export class Scheduler {
  private active = false;

  /** Receives the authoritative store and the production or controlled activation executor. */
  constructor(
    private readonly store: ExecutionStore,
    private readonly execute: (assignment: ExecutionAssignment) => Promise<ActivationResult>,
  ) {}

  /** Runs the oldest ready assignment and persists its outcome; concurrent calls are rejected. */
  async step(runId: string, signal?: AbortSignal): Promise<boolean> {
    if (this.active) throw new Error('An activation is already running');
    if (this.store.run(runId).status !== 'running') return false;
    const assignment = this.store.ready(runId)[0];
    if (!assignment) return false;
    this.active = true;
    this.store.updateAssignment(assignment.id, 'running');
    try {
      const result = assignment.data.pendingOutcome as ActivationResult | undefined;
      this.commit(assignment.id, result ?? (await this.execute(assignment)));
    } catch (error) {
      this.failure(assignment.id, error, signal?.aborted === true);
      if (error instanceof Error && error.name === 'CandidateIntegrityError') throw error;
    } finally {
      this.active = false;
    }
    return true;
  }

  /** Distinguishes interrupted execution from rejected work so cancellation cannot fabricate failed dependencies. */
  private failure(id: string, error: unknown, interrupted: boolean): void {
    const pendingOutcome = this.store.assignment(id).data.pendingOutcome;
    const status = interrupted
      ? 'interrupted'
      : error instanceof Error && error.name === 'DependencyBlocked'
        ? 'blocked'
        : 'failed';
    if (status === 'blocked' || status === 'failed') this.store.fail(id, status, String(error));
    this.store.updateAssignment(id, status, {
      lastFailedOutcome: pendingOutcome ?? null,
      pendingOutcome: null,
      ...(interrupted ? { reason: String(error) } : {}),
    });
  }

  /** Journals an observed outcome before applying idempotent scheduling transitions. */
  commit(id: string, result: ActivationResult): void {
    this.store.updateAssignment(id, this.store.assignment(id).status, { pendingOutcome: result });
    this.apply(id, result);
    this.store.updateAssignment(id, this.store.assignment(id).status, {
      pendingOutcome: null,
      lastFailedOutcome: null,
      lastReceipt: result.receipt ?? null,
    });
  }

  /** Translates structured results into durable transitions; completion requires verification evidence. */
  private apply(id: string, result: ActivationResult): void {
    if (result.kind === 'completed') this.store.complete(id, result.evidence, result.candidate);
    else if (result.kind === 'prepared') this.store.prepareContribution(id, result.contribution);
    else if (result.kind === 'blocked') this.store.fail(id, 'blocked', result.reason);
    else if (result.kind === 'inbox') this.store.exchange(id, result.requests, result.actions);
    else if (result.kind === 'responses') this.store.respond(id, result.actions);
    else if (result.kind === 'continue') this.store.updateAssignment(id, 'ready');
    else {
      if (!result.requests.length) throw new Error('Yield requires at least one request');
      this.store.requests(id, result.requests);
    }
  }
}
