import { AssignmentDispatch } from './assignment-dispatch.js';
import type { DirectorResult } from '../task-intake/direction.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionRun } from '../coordination-store/execution-types.js';
import { RunCollaboration } from './run-collaboration.js';
import type { RunEnvironments } from './run-environments.js';
import { AssignmentExecution } from './assignment-execution.js';
import { Scheduler } from './scheduler.js';

/** Couples existing scheduler dispatch to tracking and assignment-bound collaboration tools. */
export class CollaborativeDispatch {
  /** Retains one repository's host-owned stores and environment resolver. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
    private readonly environments: RunEnvironments,
  ) {}

  /** Creates tracking before engineering, then yields through the unchanged sequential scheduler. */
  async step(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const collaboration = new RunCollaboration(
      this.context,
      this.store,
      this.environments,
      run,
      signal,
    );
    const executor = new AssignmentExecution(
      this.root,
      this.environments.contextFor(run),
      this.store,
      signal,
      (assignment) => collaboration.bridge(assignment),
    );
    try {
      await new Scheduler(this.store, async (assignment) => {
        await collaboration.tracking(run.mode === 'workday' ? assignment : undefined);
        return executor.activate(assignment);
      }).step(run.id, signal);
      await collaboration.progress();
    } finally {
      collaboration.close();
    }
  }

  /** Persists actionable direction before creating tracking and before any engineering activation. */
  async initialize(run: ExecutionRun, result: DirectorResult, signal: AbortSignal): Promise<void> {
    new AssignmentDispatch(this.root, this.context, this.store).apply(run, result, {
      initialized: true,
      initialDirection: run.data.initialDirection ?? result,
      direction: result,
    });
    if (run.mode === 'task') await this.tracking(this.store.run(run.id), signal);
  }

  /** Flushes retained milestone effects before dispatch or final assessment after a recovered checkpoint. */
  async progress(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const collaboration = new RunCollaboration(
      this.context,
      this.store,
      this.environments,
      run,
      signal,
    );
    try {
      await collaboration.progress();
    } finally {
      collaboration.close();
    }
  }

  /** Captures task tracking as soon as the director has accepted actionable work. */
  async tracking(run: ExecutionRun, signal: AbortSignal): Promise<void> {
    const collaboration = new RunCollaboration(
      this.context,
      this.store,
      this.environments,
      run,
      signal,
    );
    try {
      await collaboration.tracking();
    } finally {
      collaboration.close();
    }
  }
}
