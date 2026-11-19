import type { Architecture } from '../../architecture/src/index.js';
import type { Coordination, Journal } from '../../coordination/src/index.js';
import type { Candidate } from '../../verification/src/index.js';
import type {
  ActivityCheckpoint,
  TaskInput,
  TaskOutcome,
  TaskSession,
} from '../../workflow/src/index.js';
import { checkpoint } from './checkpoint.js';
import { candidateDiff, git } from './git.js';
import { goalRound, observeGoal, recordAdmission, stagingCapture } from './goals.js';
import { preflight } from './host-config.js';
import { ownerEvidenceDigest } from './review-observations.js';
import { HostTask, hostTask } from './index.js';

/** Admit ordinary tasks through either the project lane or a retained phase writer. */
export class Execution {
  /** Use only trusted architecture, coordination and application storage. */
  constructor(
    private readonly architecture: Architecture,
    private readonly coordination: Coordination,
    private readonly storage: string,
  ) {}

  /** Resolve the binding and capture the repository before claiming the project lane. */
  async admit(input: TaskInput, signal: AbortSignal) {
    let config: ReturnType<typeof preflight>;
    try {
      signal.throwIfAborted();
      const capture = this.architecture.capture(input.directory);
      const fresh = Boolean(input.standing || input.planning);
      const selected = fresh ? stagingCapture(this.architecture, capture) : capture;
      config = preflight(selected, this.storage, fresh);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return invalid(error instanceof Error ? error.message : String(error));
    }
    const journal = this.coordination.admit(
      config.capture.source.remote,
      input.goal,
      config.fresh,
      input.planning === 'exploration'
        ? `plan:exploration:${config.capture.source.revision}`
        : input.scope,
    );
    if (!journal)
      return invalid(`Task admission requires the current verified ${config.base} head`);
    if ('activeGoal' in journal)
      return invalid(`Active goal: ${journal.activeGoal} (run ${journal.run})`);
    recordAdmission(journal, config, input.planning);
    return new HostTask(config, input.goal, journal);
  }

  /** Admit one sequential ordinary task while the phase Journal keeps the project lane. */
  async admitChild(
    input: TaskInput,
    parent: Journal,
    scope: string,
    signal: AbortSignal,
  ) {
    let config: ReturnType<typeof preflight>;
    try {
      signal.throwIfAborted();
      const capture = this.architecture.capture(input.directory);
      const fresh = Boolean(input.standing || input.planning);
      const selected = fresh ? stagingCapture(this.architecture, capture) : capture;
      config = preflight(selected, this.storage, fresh);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return invalid(error instanceof Error ? error.message : String(error));
    }
    if (!this.coordination.owns(parent, config.capture.source.remote))
      return invalid('Child admission requires a Journal from this project Coordination store');
    const journal = parent.child(input.goal, scope, config.fresh);
    if (!journal)
      return invalid(`Task admission requires the current verified ${config.base} head`);
    if ('activeGoal' in journal)
      return invalid(`Active goal: ${journal.activeGoal} (run ${journal.run})`);
    recordAdmission(journal, config, input.planning);
    return new HostTask(config, input.goal, journal);
  }

  /** Read the standing goal inventory and recover an interrupted round or start a new one. */
  round(directory: string) {
    return goalRound(this.architecture, this.coordination, directory);
  }

  /** Prepare the exact read-only snapshot that the Director will assess. */
  observeGoal(session: TaskSession, signal: AbortSignal) {
    return observeGoal(hostTask(session), signal);
  }

  /** Materialize the task branch at its recovered checkpoint before any steward activation. */
  prepare(session: TaskSession, issue: string, signal: AbortSignal) {
    return hostTask(session).setupWorkspace(issue, signal);
  }

  /** Publish checked bytes and record the cursor for the just-completed activation. */
  checkpoint(session: TaskSession, activity: ActivityCheckpoint, signal: AbortSignal) {
    return checkpoint(hostTask(session), activity, signal);
  }

  /** Index the approved working changes and bind the candidate to its Git tree. */
  async assemble(
    session: TaskSession,
    signal: AbortSignal,
    allowUnchanged = false,
  ): Promise<Candidate> {
    signal.throwIfAborted();
    const task = hostTask(session);
    if (!task.worktree) throw new Error('The plan produced no candidate worktree');
    git(task.worktree, 'add', '-A', '--', '.');
    const digest = git(task.worktree, 'write-tree');
    const unchanged =
      digest === git(task.worktree, 'rev-parse', `${task.capture.source.revision}^{tree}`);
    if (unchanged && !allowUnchanged) throw new Error('The plan produced no candidate changes');
    const log = task.store(
      'candidate.diff',
      candidateDiff(task.worktree, task.capture.source.revision),
    );
    return {
      digest,
      ...(unchanged ? { unchanged } : {}),
      evidence: [log],
      ownerEvidenceDigest: ownerEvidenceDigest(task.ownerReviewChecks(), digest),
    };
  }
}

/** Map unavailable project input to an SDK error without admitting a run. */
function invalid(reason: string): Extract<TaskOutcome, { reason: string }> {
  return { kind: 'invalid', reason, evidence: [] };
}
