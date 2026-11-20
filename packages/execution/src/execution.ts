import type { Architecture } from '../../architecture/src/index.js';
import type { Coordination } from '../../coordination/src/index.js';
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
import { refreshArchitecture } from './architecture-edits.js';

/** Admit a clean project at its verified staging head before creating state. */
export class Execution {
  /** Use only trusted architecture, coordination and application storage. */
  constructor(
    private readonly architecture: Architecture,
    private readonly coordination: Coordination,
    private readonly storage: string,
  ) {}

  /** Resolve the binding and capture the repository before claiming the project lane. */
  async admit(input: TaskInput, signal: AbortSignal, parent?: TaskSession) {
    let config: ReturnType<typeof preflight>;
    try {
      signal.throwIfAborted();
      config = this.configuration(input, parent);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return invalid(error instanceof Error ? error.message : String(error));
    }
    return this.claim(config, input, parent);
  }

  /** Claim a child from its verified project writer or admit one foreground invocation. */
  private claim(config: ReturnType<typeof preflight>, input: TaskInput, parent?: TaskSession) {
    const ancestor = parent && hostTask(parent);
    if (ancestor && !this.coordination.owns(config.capture.source.remote, ancestor.journal))
      return invalid('The parent writer belongs to a different project store');
    const scope =
      input.planning === 'exploration' && !parent
        ? `plan:exploration:${config.capture.source.revision}`
        : input.scope;
    const journal = ancestor
      ? ancestor.journal.child(input.goal, scope ?? input.goal, config.fresh)
      : this.coordination.admit(
          config.capture.source.remote,
          input.goal,
          config.fresh,
          scope,
          Boolean(input.architecture),
        );
    if (!journal)
      return invalid(`Task admission requires the current verified ${config.base} head`);
    if ('activeGoal' in journal)
      return invalid(`Active goal: ${journal.activeGoal} (run ${journal.run})`);
    recordAdmission(journal, config, input.planning);
    return new HostTask(config, input.goal, journal, ancestor, input.inbox);
  }

  /** Capture current staging for assessments while retaining ordinary task admission checks. */
  private configuration(input: TaskInput, parent?: TaskSession) {
    const capture = this.architecture.capture(input.directory);
    const fresh = Boolean(parent || input.standing || input.planning || input.architecture);
    const selected = fresh ? stagingCapture(this.architecture, capture) : capture;
    return preflight(selected, this.storage, fresh);
  }

  /** Adopt an approved guide at a safe activity boundary once its required handlers are available. */
  async applyGuide(session: TaskSession, id: string, signal: AbortSignal) {
    await refreshArchitecture(hostTask(session), id, signal);
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
  async prepare(session: TaskSession, issue: string, signal: AbortSignal) {
    const task = hostTask(session);
    await task.setupWorkspace(issue, signal);
    if (task.guide) await refreshArchitecture(task, task.guide.proposal.id, signal, false);
  }

  /** Publish checked bytes and record the cursor for the just-completed activation. */
  async checkpoint(session: TaskSession, activity: ActivityCheckpoint, signal: AbortSignal) {
    const task = hostTask(session);
    await checkpoint(task, activity, signal);
    if (task.guide) await refreshArchitecture(task, task.guide.proposal.id, signal, false);
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
      digest === git(task.worktree, 'rev-parse', `${task.config.capture.source.revision}^{tree}`);
    if (unchanged && !allowUnchanged) throw new Error('The plan produced no candidate changes');
    const log = task.store(
      'candidate.diff',
      candidateDiff(task.worktree, task.config.capture.source.revision),
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
