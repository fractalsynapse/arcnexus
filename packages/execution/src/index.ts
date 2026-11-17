import {
  constants,
  accessSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import type { Context } from 'cordis';
import type { Agent, ActivationInput } from '../../agent/src/index.js';
import type { Capture, Architecture, TaskContext } from '../../architecture/src/index.js';
import type { Coordination, Journal } from '../../coordination/src/index.js';
import type { Candidate } from '../../verification/src/index.js';
import type { TaskEvent, TaskInput, TaskOutcome, TaskSession } from '../../workflow/src/index.js';
import { GitHub } from '../../collaboration/src/index.js';
import { codex } from './codex.js';
import { applyEdits, type CheckedEdit } from './edits.js';
import { git } from './git.js';
import { check } from './check.js';

export type { CheckedEdit } from './edits.js';
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
      config = preflight(this.architecture.capture(input.directory), this.storage);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return invalid(error instanceof Error ? error.message : String(error));
    }
    const journal = this.coordination.admit(config.capture.source.remote, input.goal, config.fresh);
    if (!journal)
      return invalid(`Task admission requires the current verified ${config.base} head`);
    if ('activeGoal' in journal)
      return invalid(`Active goal: ${journal.activeGoal} (run ${journal.run})`);
    return new HostTask(config, input.goal, journal);
  }

  /** Index the approved working changes and bind the candidate to its Git tree. */
  async assemble(session: TaskSession, signal: AbortSignal): Promise<Candidate> {
    signal.throwIfAborted();
    const task = hostTask(session);
    if (!task.worktree) throw new Error('The plan produced no candidate worktree');
    git(task.worktree, 'add', '-A', '--', '.');
    const digest = git(task.worktree, 'write-tree');
    if (digest === git(task.worktree, 'rev-parse', 'HEAD^{tree}'))
      throw new Error('The plan produced no candidate changes');
    const diff = git(
      task.worktree,
      'diff',
      '--cached',
      '--no-ext-diff',
      '--no-textconv',
      '--binary',
    );
    const log = task.store('candidate.diff', diff);
    return { digest, evidence: [log] };
  }
}

interface HostConfig {
  capture: Capture;
  common: string;
  executable: string;
  base: string;
  fresh: boolean;
  storage: string;
}

/** Carry the admitted authority and one worktree through the workflow. */
export class HostTask implements TaskSession {
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
    private readonly journal: Journal,
  ) {
    this.capture = config.capture;
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

  /** Start the one private issue-linked worktree after Direction has planned. */
  async workspace(signal: AbortSignal) {
    if (this.worktree) return this.worktree;
    const provider = this.provider(signal);
    const issue = await provider.issue(this.goal);
    const branch = `${issue}-task`;
    this.journal.record({ issue, branch });
    const worktree = join(this.directory(), 'worktree');
    git(
      this.capture.source.root,
      'worktree',
      'add',
      '-b',
      branch,
      worktree,
      this.capture.source.revision,
    );
    this.issue = issue;
    this.branch = branch;
    this.worktree = worktree;
    return worktree;
  }

  /** Select the captured GitHub provider for this task. */
  provider(signal: AbortSignal) {
    return new GitHub(this.capture.source.remote, signal);
  }

  /** Verify the local commit and retained worktree before any new push. */
  validatePublication(
    worktree: string,
    branch: string,
    head: string,
    parent: string,
    candidate: string,
  ) {
    if (
      git(worktree, 'branch', '--show-current') !== branch ||
      git(worktree, 'rev-parse', 'HEAD') !== head ||
      git(worktree, 'rev-parse', 'HEAD^') !== parent ||
      git(worktree, 'rev-parse', 'HEAD^{tree}') !== candidate
    )
      throw new Error('The retained publication branch, parent or tree changed');
  }

  /** Commit exactly the reviewed tree on the task branch and report its identity. */
  commit(candidate: Candidate) {
    const worktree = this.worktree;
    if (!worktree || !this.branch || !this.issue) throw new Error('No publication worktree');
    if (
      git(worktree, 'branch', '--show-current') !== this.branch ||
      git(worktree, 'rev-parse', 'HEAD') !== this.capture.source.revision ||
      git(worktree, 'write-tree') !== candidate.digest
    )
      throw new Error('The candidate or its publication base changed');
    git(worktree, 'diff', '--quiet', '--');
    const message = `chore: ${this.goal.trim().split('\n')[0]!.slice(0, 90)} (#${this.issue})`;
    git(worktree, 'commit', '-m', message);
    return {
      worktree,
      branch: this.branch,
      issue: this.issue,
      head: git(worktree, 'rev-parse', 'HEAD'),
    };
  }

  /** Run an actor through the same prepared envelope used by inspection. */
  activate(
    agent: Agent,
    selection: ActivationInput['selection'],
    data: Omit<TaskContext, 'goal' | 'worktree'>,
    signal: AbortSignal,
  ) {
    const worktree = this.worktree ?? this.capture.source.root;
    verifyNativeGuidance(this.capture, worktree);
    const log = this.artifact('codex.jsonl');
    return agent.activate(
      { capture: this.capture, selection, task: { ...data, goal: this.goal, worktree } },
      (view, cancellation) => codex(this.config.executable, view, log, cancellation),
      signal,
    );
  }

  /** Apply structured edits only in the admitted steward's editable activities. */
  edits(owner: string, activity: string, edits: readonly CheckedEdit[]) {
    if (!this.worktree || !['documentation', 'testing', 'implementation'].includes(activity))
      throw new Error(`Checked edits are unavailable in ${owner}/${activity}`);
    const observed = applyEdits(this.worktree, this.capture, owner, edits);
    this.journal.record({ owner, activity, edits: observed });
  }

  /** Run a declared check and record its real exit, duration and transcript. */
  async check(id: string, signal: AbortSignal, owner?: string) {
    if (!this.worktree) throw new Error('No task worktree is available for checks');
    const log = this.artifact(`${id}.log`);
    const result = await check(
      this.capture,
      this.worktree,
      this.config.common,
      id,
      owner,
      log,
      signal,
    );
    this.journal.record({ check: result });
    return result;
  }

  /** Store an immutable artifact outside maintained source. */
  store(name: string, contents: string) {
    const path = this.artifact(name);
    writeFileSync(path, contents, { mode: 0o600, flag: 'wx' });
    return path;
  }

  /** Allocate a recorded evidence name before starting a native operation. */
  private artifact(name: string) {
    const path = join(
      this.directory(),
      `${++this.sequence}-${name.replaceAll(/[^a-zA-Z0-9_.-]/g, '-')}`,
    );
    this.evidence.push(path);
    return path;
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

/** Choose the default external application state directory. */
export function applicationStorage() {
  return resolve(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'arcnexus');
}

/** Refuse dirty or unverified source and executable settings before writing a lane row. */
function preflight(capture: Capture, storage: string): HostConfig {
  const { project, source } = capture;
  const base = project.delivery?.baseBranch;
  if (
    !base ||
    !/^[\w/-]+$/.test(base) ||
    base === project.delivery?.protectedBranch ||
    base === 'main'
  )
    throw new Error('Missing or unsafe captured staging branch');
  if (storage === source.root || storage.startsWith(source.root + '/'))
    throw new Error('Application storage must be outside the project');
  const common = realpathSync(
    git(source.root, 'rev-parse', '--path-format=absolute', '--git-common-dir'),
  );
  if (git(source.root, 'status', '--porcelain', '--untracked-files=normal'))
    throw new Error('Task admission requires a clean working tree');
  if (git(source.root, 'rev-parse', 'HEAD') !== source.revision)
    throw new Error('The source revision changed during admission');
  const fresh =
    git(source.root, 'ls-remote', '--exit-code', 'origin', `refs/heads/${base}`).split('\t')[0] ===
    source.revision;
  if (!project.checks?.acceptance?.length) throw new Error('Missing captured acceptance checks');
  new GitHub(source.remote, new AbortController().signal);
  verifyNativeGuidance(capture, source.root);
  return { capture, common, executable: binding(project.bindings, common), base, fresh, storage };
}

/** Resolve only the configured local executable, with no PATH fallback. */
function binding(file: string | undefined, common: string) {
  if (!file || !/^\.git\/(?:[\w.-]+\/)*[\w.-]+$/.test(file) || file.split('/').includes('..'))
    throw new Error('Missing or unsafe project bindings path');
  const path = join(common, file.slice('.git/'.length));
  if (realpathSync(path) !== path) throw new Error('Project bindings must not use an alias');
  const data = parse(readFileSync(path, 'utf8'));
  const executable = data?.tools?.codex;
  if (data?.schemaVersion !== 1 || typeof executable !== 'string' || !isAbsolute(executable))
    throw new Error('Missing supported executable binding: tools.codex');
  accessSync(executable, constants.X_OK);
  return executable;
}

/** Keep native Codex discovery pinned to the approved input files during activation. */
function verifyNativeGuidance(capture: Capture, worktree: string) {
  const isGuidance = (path: string) =>
    /(?:^|\/)(?:AGENTS(?:\.override)?\.md|\.agents\/skills\/)/.test(path);
  const listed = git(
    worktree,
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ).split('\0');
  if (listed.some((path) => /(?:^|\/)\.codex\/config\.toml$/.test(path)))
    throw new Error('Target Codex configuration is outside the captured harness binding');
  const approved = new Set(capture.source.paths.filter(isGuidance));
  for (const path of new Set([...listed.filter(isGuidance), ...approved])) {
    const absolute = join(worktree, path);
    if (
      !approved.has(path) ||
      !lstatSync(absolute).isFile() ||
      readFileSync(absolute, 'utf8') !== capture.source.read(path)
    )
      throw new Error(`Captured project guidance differs from the native discovery view: ${path}`);
  }
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
