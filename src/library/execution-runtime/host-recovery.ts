import { AssignmentRecovery } from './assignment-recovery.js';
import { PolicyRecovery } from './policy-recovery.js';
import { Scheduler } from './scheduler.js';
import type { RunAuthority } from './run-authority.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ActivationResult } from '../coordination-store/execution-types.js';

/** Reconciles durable outcomes and interruptions before a replacement host may dispatch any work. */
export class HostRecovery {
  /** Retains the original evidence store and authority; recovery cannot invoke engineering. */
  constructor(
    private readonly root: string,
    private readonly store: ExecutionStore,
    private readonly authority: RunAuthority,
  ) {}

  /** Marks abandoned activations without replaying possibly completed operations. */
  recover(): void {
    new PolicyRecovery(this.root, this.store).recover();
    new AssignmentRecovery(this.root, this.store).recover();
    for (const run of this.store.runs()) {
      for (const assignment of this.store.assignments(run.id)) {
        if (assignment.data.pendingOutcome) {
          const scheduler = new Scheduler(this.store, async () => {
            throw new Error('Recovery cannot execute');
          });
          scheduler.commit(assignment.id, assignment.data.pendingOutcome as ActivationResult);
        } else if (assignment.status === 'running')
          this.store.updateAssignment(assignment.id, 'interrupted', {
            reason: 'Host exited during activation; inspect retained operation evidence',
          });
      }
      if (['running', 'pausing', 'stopping'].includes(run.status))
        this.store.updateRun(run.id, 'interrupted');
    }
    this.authority.recover();
  }
}
