import { architectInbox } from './architect-inbox.js';
import { hostTask } from '../../execution/src/index.js';
import type { DocumentationSettings } from '../../architecture/src/index.js';
import type {
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';

/** Keep architecture assessment and prerequisite delivery inside one admitted foreground lifecycle. */
export class ArchitectRun {
  /** Use normal task execution for implementation instead of creating another agent loop. */
  constructor(
    private readonly services: WorkflowServices,
    private readonly session: TaskSession,
    private readonly observer: TaskObserver,
    private readonly signal: AbortSignal,
    private readonly run: (input: TaskInput) => Promise<TaskOutcome>,
  ) {}

  /** Reconcile interrupted delivery first, otherwise assess and retain one exact human-reviewed batch. */
  async execute(feedback?: string, documentation?: DocumentationSettings): Promise<TaskOutcome> {
    const task = hostTask(this.session);
    const pending = task
      .observations<{ architectureDelivery?: string }>()
      .findLast(({ architectureDelivery }) => architectureDelivery)?.architectureDelivery;
    if (pending) return this.deliver(pending);
    if (!this.services.architecture) throw new Error('Architecture assessment is unavailable');
    this.observer.progress({
      phase: 'planning',
      message: documentation
        ? 'Preparing project documentation settings for review'
        : 'Architect is assessing accepted direction and prior findings',
    });
    return this.assess(feedback, documentation);
  }

  /** Resume the same Architect with complete supplier answers before reaching a guide decision. */
  private async assess(
    feedback?: string,
    documentation?: DocumentationSettings,
  ): Promise<TaskOutcome> {
    const task = hostTask(this.session);
    while (true) {
      this.signal.throwIfAborted();
      const decision = await this.services.architecture!.propose(
        this.session,
        feedback,
        this.signal,
        documentation,
      );
      if (decision.kind === 'supplier') {
        const stopped = await architectInbox(this.session, decision, this.run);
        if (stopped) return stopped;
        continue;
      }
      if (decision.kind === 'no-change')
        return {
          kind: 'planned',
          commit: task.capture.source.revision,
          summary: decision.summary,
          evidence: decision.evidence,
        };
      task.note({ architectureDelivery: decision.proposal.id });
      return this.deliver(decision.proposal.id);
    }
  }

  /** Deliver the approved batch and prerequisites in one normal independently reviewed staging task. */
  private async deliver(id: string) {
    const task = hostTask(this.session);
    task.cleanup();
    return this.run({
      directory: task.capture.source.root,
      goal: task.goal,
      scope: 'architecture:delivery',
      guide: id,
    });
  }
}
