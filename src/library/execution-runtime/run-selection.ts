import type { ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun, RunEnvironment } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';

/** Selects persisted run ownership and coordinates automatic workday handoffs without replacing user intent. */
export class RunSelection {
  /** Retains the repository's captured authority and sole transactional execution store. */
  constructor(
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
  ) {}

  /** Selects queued tasks first and tracks automatic pauses independently of user intent. */
  next(): ExecutionRun | undefined {
    const task = this.selectTask();
    const workday = this.workday();
    if (task) {
      if (workday && ['running', 'idle'].includes(workday.status))
        this.store.updateRun(workday.id, 'paused', { pauseReason: 'task' });
      return task;
    }
    if (workday?.status === 'paused' && workday.data.pauseReason === 'task')
      this.store.updateRun(workday.id, 'running', {
        candidateRevision: String(
          this.delivery(workday.environment)?.data.candidateRevision ?? this.context.base,
        ),
        candidateRecord:
          this.delivery(workday.environment)?.data.candidateRecord ?? workday.data.candidateRecord,
        pauseReason: null,
      });
    const latest = this.workday();
    return latest?.status === 'running' ? latest : undefined;
  }

  /** Keeps a task's project ownership across activations; answered clarifications rejoin the FIFO queue. */
  private selectTask(): ExecutionRun | undefined {
    const tasks = this.store.runs().filter((r) => r.mode === 'task' && r.status === 'running');
    const task = tasks.find((r) => r.data.executionOwner === true) ?? tasks[0];
    if (task && task.data.executionOwner !== true)
      this.store.updateRun(task.id, 'running', { executionOwner: true });
    return task;
  }

  /** Finds the latest workday without confusing queued external tasks with its lifecycle. */
  workday(): ExecutionRun | undefined {
    return this.store
      .runs()
      .filter((r) => r.mode === 'workday')
      .at(-1);
  }

  /** Keeps the candidate revision and its verified workspace evidence paired across run handoffs. */
  delivery(environment?: RunEnvironment): ExecutionRun | undefined {
    return this.store.latestDelivery(this.context.base, this.context.packageId, environment);
  }
}
