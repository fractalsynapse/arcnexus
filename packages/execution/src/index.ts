import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Context } from 'cordis';
import type { Agent, ActivationInput } from '../../agent/src/index.js';
import type { Capture, Architecture, TaskContext } from '../../architecture/src/index.js';
import type { Coordination, Journal } from '../../coordination/src/index.js';
import { checkpoint, reconcileCheckpoint, saveCheckpoint } from './checkpoint.js';
import type { Candidate } from '../../verification/src/index.js';
import type {
  ActivityCheckpoint,
  TaskEvent,
  TaskInput,
  TaskOutcome,
  TaskSession,
} from '../../workflow/src/index.js';
import { GitHub } from '../../collaboration/src/index.js';
import { activateActor } from './activation.js';
import { usedResearch } from './research.js';
import { formatterPreview } from './formatter.js';
import { recoverPrepared } from './prepared-recovery.js';
import { applyEdits, type CheckedEdit } from './edits.js';
import { candidateDiff, git } from './git.js';
import { applicationStorage, preflight, type HostConfig } from './host-config.js';
import { goalRound, observeGoal, recordAdmission, stagingCapture } from './goals.js';
import { check, type CheckResult } from './check.js';
import { pendingStewardCheck, type StewardScope } from './steward-check.js';
import {
  cleanCandidate,
  ownerEvidenceDigest,
  ownerReviewObservations,
  type OwnerObservation,
} from './review-observations.js';

export { type CheckedEdit, editFingerprint } from './edits.js';
export { Clarifications } from './clarifications.js';
export { reconcileCheckpoint, saveCheckpoint } from './checkpoint.js';
export { citesVerifiedRun, verifiedGoalRun, type VerifiedGoalRun } from './goal-evidence.js';
export { applicationStorage } from './host-config.js';
export { InvalidCodexResponse } from './codex.js';

declare module 'cordis' {
  interface Context {
    execution: Execution;
  }
}

/** Admit a clean project at its verified staging head before creating state. */
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

/** Carry the admitted authority and one worktree through the workflow. */
export class HostTask implements TaskSession {
  ask?: TaskSession['ask'];
  readonly capture: Capture;
  readonly evidence: string[] = [];
  worktree?: string;
  branch?: string;
  issue?: string;
  private sequence = 0;

  /** Bind the session to a captured project and its already claimed journal. */
  constructor(
    readonly config: HostConfig,
    readonly goal: string,
    readonly journal: Journal,
  ) {
    this.capture = config.capture;
    const prefix = this.evidenceDirectory() + '/';
    const closeEvidence = this.observations<{ outcome?: TaskOutcome; artifact?: string }>().flatMap(
      ({ artifact, outcome }) => [...(outcome?.evidence ?? []), ...(artifact ? [artifact] : [])],
    );
    this.evidence.push(
      ...new Set(closeEvidence.filter((path) => path.startsWith(prefix) && existsSync(path))),
    );
  }

  /** Read the prior attempt and its immutable worktree location. */
  retainedPublication() {
    const retained = this.journal.retained;
    return retained && { ...retained, worktree: join(this.location(retained.run), 'worktree') };
  }

  /** Record a delivery intent or provider observation through the task journal. */
  note(event: Record<string, unknown>) {
    this.journal.record(event);
  }

  /** Resolve a legacy publication's parent from the retained Git object. */
  publicationParent(head: string) {
    if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Invalid retained publication commit');
    return git(this.capture.source.root, 'rev-parse', `${head}^`);
  }

  /** Record Workflow observations through Coordination. */
  record(event: TaskEvent) {
    this.journal.record(event);
  }

  /** Read journaled Workflow checkpoints, including previously published activities. */
  history(): readonly TaskEvent[] {
    const events = this.observations<TaskEvent & { plannerRefresh?: string }>();
    return events.slice(events.findLastIndex((event) => event.plannerRefresh) + 1);
  }

  /** Retain the terminal outcome and verified native evidence. */
  finish(outcome: TaskOutcome) {
    this.journal.finish({
      ...outcome,
      evidence: [...new Set([...outcome.evidence, ...this.evidence])],
    });
  }

  /** Close the storage connection without removing retained source or evidence. */
  close() {
    this.journal.close();
  }

  /** Read the public task identity used for recoverable hosted issue creation. */
  get taskID() {
    return this.journal.taskID;
  }

  /** Identify the exact goal text for hosted issue history queries. */
  get goalID() {
    return this.journal.goalID;
  }

  /** Read one activity stream across previous attempts and the current writer. */
  observations<T>(): T[] {
    return [...(this.journal.retained?.events ?? []), ...this.journal.events()] as T[];
  }

  /** Materialize a read-only planning snapshot at the captured revision. */
  planningWorkspace(signal: AbortSignal) {
    signal.throwIfAborted();
    const { source } = this.capture;
    this.recoverMeasureWorkspace();
    const path = join(this.directory(), 'measure-worktree');
    this.note({ measureWorkspace: this.journal.run });
    git(source.root, 'worktree', 'add', '--detach', path, source.revision);
    this.worktree = path;
  }

  /** Remove a detached measurement workspace left by an interrupted attempt. */
  private recoverMeasureWorkspace() {
    const prior = this.observations<{ measureWorkspace?: number }>().findLast(
      ({ measureWorkspace }) => measureWorkspace !== undefined,
    )?.measureWorkspace;
    if (!prior) return;
    const path = join(this.location(prior), 'measure-worktree');
    if (existsSync(path)) {
      if (git(path, 'branch', '--show-current')) throw new Error('Goal measure workspace changed');
      this.worktree = path;
      this.removeWorktree();
    }
  }

  /** Recover the approved base and branch, then create the clean worktree for this attempt. */
  async setupWorkspace(issue: string, signal: AbortSignal) {
    if (this.branch && this.worktree) return;
    if (!/^\d+$/.test(issue)) throw new Error('Invalid workspace issue');
    const base = this.capture.source.revision;
    this.recoverMeasureWorkspace();
    this.branch = `${issue}-task`;
    this.issue = issue;
    if (await this.provider(signal).publication(this.branch))
      throw new Error('An existing pull request must match a retained accepting publication');
    const ref = `refs/heads/${this.branch}`;
    await reconcileCheckpoint(this, signal);
    if (this.recoverWorkspace()) await reconcileCheckpoint(this, signal);
    await recoverPrepared(this, signal);
    await reconcileCheckpoint(this, signal);
    const { root } = this.capture.source;
    if (!git(root, 'for-each-ref', '--format=%(objectname)', ref))
      git(root, 'update-ref', ref, base, '0'.repeat(40));
    this.validateWorkspaceHead(base);
    this.note({ branch: this.branch, issue, workspace: this.journal.run, baseRevision: base });
    this.removeWorktree();
    const worktree = join(this.directory(), 'worktree');
    git(root, 'worktree', 'add', worktree, this.branch);
    this.worktree = worktree;
  }

  /** Preserve and remove an abandoned task-owned workspace before reconstructing it. */
  private recoverWorkspace() {
    const previous = this.observations<{ workspace?: number; baseRevision?: string }>().findLast(
      ({ workspace }) => workspace !== undefined,
    );
    if (!previous?.workspace) return;
    const path = join(this.location(previous.workspace), 'worktree');
    if (!existsSync(path)) return;
    if (
      !previous.baseRevision ||
      git(path, 'merge-base', 'HEAD', previous.baseRevision) !== previous.baseRevision
    )
      throw new Error('The retained workspace base changed');
    if (git(path, 'branch', '--show-current') !== this.branch)
      throw new Error('The abandoned worktree belongs to a different branch');
    this.worktree = path;
    const saved = saveCheckpoint(this);
    this.removeWorktree();
    return saved;
  }

  /** Check the current branch tip against the last observed durable checkpoint. */
  private validateWorkspaceHead(base: string) {
    const expected = this.observations<{ confirmed?: string }>().findLast(
      ({ confirmed }) => confirmed,
    )?.confirmed;
    const local = git(this.capture.source.root, 'rev-parse', `refs/heads/${this.branch}`);
    if (local !== (expected ?? base))
      throw new Error('The task branch diverged from its recorded checkpoint');
  }

  /** Protect uncommitted authorized edits, then remove only this attempt's worktree. */
  cleanup() {
    if (!this.worktree) this.removeRetainedPublicationWorkspace();
    saveCheckpoint(this);
    this.removeWorktree();
  }

  /** Clean the original task workspace after resuming its already committed publication. */
  private removeRetainedPublicationWorkspace() {
    const events = this.observations<{
      workspace?: number;
      branch?: string;
      publication?: { branch: string; head: string };
    }>();
    const publication = events.findLast(({ publication }) => publication)?.publication;
    const previous = events.findLast(({ workspace }) => workspace !== undefined);
    if (!publication || !previous?.workspace || previous.branch !== publication.branch) return;
    const path = join(this.location(previous.workspace), 'worktree');
    if (!existsSync(path)) return;
    if (
      git(path, 'branch', '--show-current') !== publication.branch ||
      git(path, 'rev-parse', 'HEAD') !== publication.head
    )
      throw new Error('Retained publication worktree changed');
    this.worktree = path;
  }

  /** Remove a clean workspace only after checking that it belongs to application storage. */
  private removeWorktree() {
    if (!this.worktree) return;
    if (!this.worktree.startsWith(this.config.storage + '/'))
      throw new Error('Task worktree lies outside application storage');
    git(this.capture.source.root, 'worktree', 'remove', this.worktree);
    this.worktree = undefined;
  }

  /** Select the captured GitHub provider for this task. */
  provider(signal: AbortSignal) {
    return new GitHub(this.capture.source.remote, signal);
  }

  /** Verify the local commit and retained worktree before any new push. */
  validatePublication(branch: string, head: string, parent: string, candidate: string) {
    const { root } = this.capture.source;
    if (
      git(root, 'rev-parse', `refs/heads/${branch}`) !== head ||
      git(root, 'merge-base', head, parent) !== parent ||
      git(root, 'rev-parse', `${head}^{tree}`) !== candidate
    )
      throw new Error('The retained publication branch, parent or tree changed');
  }

  /** Resolve the already-checkpointed head that exactly matches the accepted tree. */
  commit(candidate: Candidate) {
    const worktree = this.worktree;
    if (!worktree || !this.branch || !this.issue) throw new Error('No publication worktree');
    if (
      git(worktree, 'branch', '--show-current') !== this.branch ||
      git(worktree, 'rev-parse', 'HEAD^{tree}') !== candidate.digest ||
      git(worktree, 'status', '--porcelain')
    )
      throw new Error('The candidate or its publication branch changed');
    return {
      worktree,
      branch: this.branch,
      issue: this.issue,
      head: git(worktree, 'rev-parse', 'HEAD'),
    };
  }

  /** Expose a verified formatter path only while a steward worktree is active. */
  get formatPreview() {
    return this.branch ? formatterPreview(this.capture.source.root) : undefined;
  }

  /** Run an actor through the same prepared envelope used by inspection. */
  activate(
    agent: Agent,
    selection: ActivationInput['selection'],
    data: Omit<TaskContext, 'goal' | 'worktree'>,
    signal: AbortSignal,
  ) {
    return activateActor(this, agent, selection, data, signal);
  }

  /** Return the research evidence used by this captured actor activation. */
  researchEvidence(
    selection: ActivationInput['selection'],
    data: Omit<TaskContext, 'goal' | 'worktree'>,
  ) {
    return usedResearch(this, selection, data);
  }

  /** Apply structured edits only in the admitted steward's editable activities. */
  edits(owner: string, activity: string, edits: readonly CheckedEdit[]) {
    if (!this.worktree || !['documentation', 'testing', 'implementation'].includes(activity))
      throw new Error(`Checked edits are unavailable in ${owner}/${activity}`);
    const observed = applyEdits(this.worktree, this.capture, owner, edits, (editIntent) =>
      this.note({ owner, activity, editIntent }),
    );
    this.journal.record({ owner, activity, edits: observed });
    return observed;
  }

  /** Resolve an unresolved check from the task's retained steward observations. */
  pendingCheck(scope: StewardScope) {
    return pendingStewardCheck(this.observations(), scope);
  }

  /** Bind exact owner observations to the clean checkpoint when the edit history permits it. */
  ownerReviewChecks(): OwnerObservation[] {
    const events = this.observations<Parameters<typeof ownerReviewObservations>[0][number]>();
    return ownerReviewObservations(events, cleanCandidate(this), this.capture.operations);
  }

  /** Read reusable research observations from the same project journal. */
  researchReports(owner: string, id?: string) {
    return this.journal.researchReports(owner, id);
  }

  /** Run a declared check and record its real exit, duration and transcript. */
  async check(id: string, signal: AbortSignal, scope?: StewardScope) {
    if (!this.worktree) throw new Error('No task worktree is available for checks');
    const events = this.observations<{
      check?: CheckResult;
      scope?: StewardScope;
      edits?: readonly { before: string | null; after: string | null }[];
    }>();
    const priorIndex = events.findLastIndex(
      ({ check, scope: observed }) =>
        check?.id === id &&
        observed?.owner === scope?.owner &&
        observed?.activity === scope?.activity &&
        observed?.expected === scope?.expected,
    );
    const prior = events[priorIndex]?.check;
    const changed = events
      .slice(priorIndex + 1)
      .some(({ edits }) => edits?.some(({ before, after }) => before !== after));
    const operation = this.capture.operations[id];
    const args = operation?.args?.map((arg) =>
      typeof arg === 'string' ? arg : scope?.owner,
    );
    const sameOperation =
      operation?.command === prior?.command &&
      JSON.stringify(args ?? []) === JSON.stringify(prior?.args ?? []);
    const checkpointChanged = events.slice(priorIndex + 1).some(
      (event) => event.checkpoint !== undefined || event.baseRevision !== undefined,
    );
    if (
      prior &&
      sameOperation &&
      !changed &&
      !checkpointChanged &&
      existsSync(prior.log) &&
      (typeof prior.status === 'number' || prior.status === 'not-applicable')
    )
      return prior;
    const log = this.artifact(`${id}.log`);
    const result = await check(
      this.capture,
      this.worktree,
      this.config.common,
      id,
      scope?.owner,
      log,
      signal,
    );
    this.journal.record({ check: result, scope });
    return result;
  }

  /** Store an immutable artifact outside maintained source. */
  store(name: string, contents: string) {
    const path = this.artifact(name);
    writeFileSync(path, contents, { mode: 0o600, flag: 'wx' });
    return path;
  }

  /** Allocate a recorded evidence name before starting a native operation. */
  artifact(name: string) {
    const directory = this.evidenceDirectory();
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (realpathSync(directory) !== directory) throw new Error('Evidence directory is an alias');
    const file = name.replaceAll(/[^a-zA-Z0-9_.-]/g, '-');
    const path = join(directory, `${this.journal.run}-${++this.sequence}-${file}`);
    this.evidence.push(path);
    this.note({ artifact: path });
    return path;
  }

  /** Keep evidence mounts stable across attempts and isolated from the worktrees. */
  private evidenceDirectory() {
    return join(this.location(this.journal.run), '..', '..', 'evidence', this.taskID);
  }

  /** Use a run-local directory under trusted application storage. */
  private directory() {
    const path = this.location(this.journal.run);
    mkdirSync(path, { recursive: true, mode: 0o700 });
    return path;
  }

  /** Derive artifact locations from the verified project and journal identities. */
  private location(run: number) {
    const project = createHash('sha256').update(this.capture.source.remote).digest('hex');
    return join(this.config.storage, project, 'runs', String(run));
  }
}

/** Require the execution-owned session at a native service boundary. */
export function hostTask(session: TaskSession): HostTask {
  if (!(session instanceof HostTask)) throw new Error('Task is not admitted by native execution');
  return session;
}

/** Map unavailable project input to an SDK error without admitting a run. */
function invalid(reason: string): Extract<TaskOutcome, { reason: string }> {
  return { kind: 'invalid', reason, evidence: [] };
}

/** Mount the native host execution boundary with trusted storage. */
export const executionPlugin = {
  inject: ['architecture', 'coordination'],
  /** Register the production implementation used by Workflow's host calls. */
  apply(context: Context) {
    context.provide(
      'execution',
      new Execution(context.architecture, context.coordination, applicationStorage()),
    );
  },
};

export { steward } from './steward.js';
