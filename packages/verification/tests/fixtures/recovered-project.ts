import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { stringify } from 'yaml';
import { Architecture, type Capture } from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { Execution, HostTask } from '../../../execution/src/index.js';

const remote = 'https://github.com/example/recovered-verification.git';
export const goal = 'Recover checked bytes while preserving the original requirements';
export const answer = '  Keep café and the original boundary.\n\nDo not reinterpret approval.  \n';
export const originalRequirement = 'Preserve checked bytes and the exact human answer';
export const signal = new AbortController().signal;

/** Supply real committed captures, assembled records and durable history without hosted effects. */
export class RecoveredProject {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-recovered-verification-'));
  readonly root = join(this.directory, 'source');
  readonly storage = join(this.directory, 'state');
  readonly architecture = new Architecture();
  readonly execution = new Execution(this.architecture, new Coordination(this.storage), this.storage);
  readonly original: Capture;
  readonly checkpoint: string;
  task: HostTask;
  private generation = 0;

  /** Commit explicit authority and checked source separately before opening the first assessment. */
  constructor(context: TestContext) {
    mkdirSync(this.root);
    this.git(this.root, 'init', '-b', 'staging');
    this.git(this.root, 'config', 'user.name', 'Verification fixture');
    this.git(this.root, 'config', 'user.email', 'fixture@example.invalid');
    this.git(this.root, 'remote', 'add', 'origin', remote);
    this.configure();
    this.commit(this.root, 'Original staging');
    this.original = this.architecture.capture(this.root);
    const worktree = join(this.directory, 'initial-checkpoint');
    this.git(this.root, 'worktree', 'add', '-b', '7-task', worktree);
    writeFileSync(join(worktree, 'checked.txt'), 'secured checked bytes café\nsecond line\n');
    this.checkpoint = this.commit(worktree, 'Issue #7 checked checkpoint');
    this.task = this.open(this.original, this.original, this.checkpoint);
    context.after(() => {
      this.task.close();
      rmSync(this.directory, { recursive: true, force: true });
    });
  }

  /** Capture a new staging parent, optionally changing approved bindings or instructions. */
  advance(change: 'base' | 'capture' | 'mapping' | 'required' = 'base') {
    if (change === 'capture')
      this.write('.arc/architecture/roles/auditor.yaml', {
        id: 'auditor', instructions: ['Assess recovered ownership and preserve historical authority'],
      });
    if (change === 'mapping') this.operation('required', 'current-tag');
    if (change === 'required') {
      this.project(['required', 'newly-required']);
      this.operation('newly-required', 'new-tag');
    }
    this.commit(this.root, 'New approved staging capture');
    return this.architecture.capture(this.root);
  }

  /** Reopen the same logical task at another physical path with its actual retained journal. */
  reopen(base = this.original, capture = base, head = this.checkpoint) {
    this.task.finish({ kind: 'blocked', reason: 'Controlled assessment interruption', evidence: [] });
    this.task.close();
    this.task = this.open(base, capture, head);
    return this.task;
  }

  /** Obtain the production Candidate rather than an assignment-shaped approximation. */
  assemble() {
    return this.execution.assemble(this.task, signal);
  }

  /** Make a changed tree while leaving engineering base and approved capture fixed. */
  changeCandidate() {
    writeFileSync(join(this.task.worktree!, 'checked.txt'), 'corrected checked bytes\n');
    return this.commit(this.task.worktree!, 'Issue #7 corrected candidate');
  }

  /** Commit fixture data without depending on global Git identity or a remote network. */
  commit(directory: string, message: string) {
    this.git(directory, 'add', '-A');
    this.git(directory, 'commit', '--allow-empty', '-qm', message);
    return this.git(directory, 'rev-parse', 'HEAD');
  }

  /** Execute local Git as setup and retain complete command output on failure. */
  git(directory: string, ...args: string[]) {
    return execFileSync('git', args, {
      cwd: directory, encoding: 'utf8', maxBuffer: Infinity, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }

  /** Write a complete authored declaration before its immutable capture. */
  private write(path: string, value: unknown) {
    const target = join(this.root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof value === 'string' ? value : stringify(value));
  }

  /** Resolve source, owner, profile, role and operations through Architecture.capture. */
  private configure() {
    this.project(['required']);
    this.write('registry.yaml', { contracts: [] });
    this.write('plan.md', '# Fixture ordered plan\n');
    this.write('baseline.txt', 'Original staging bytes\n');
    this.write('.arc/architecture/components/work.yaml', {
      id: 'work', purpose: 'Own the checked contribution', owns: ['checked.txt', 'baseline.txt'],
      activities: {},
    });
    this.write('.arc/architecture/components/auditor.yaml', {
      id: 'auditor', purpose: 'Independently assess', owns: [],
      activities: { assessment: {
        role: 'auditor', profile: 'reviewer', instructions: ['Preserve original requirements'],
        operations: [], standards: [],
      } },
    });
    this.write('.arc/architecture/roles/auditor.yaml', { id: 'auditor', instructions: ['Read evidence'] });
    this.write('.arc/architecture/execution-profiles/reviewer.yaml', {
      id: 'reviewer', model: 'controlled', reasoning: 'high', webSearch: 'disabled',
      operationCategories: ['read'],
    });
    this.operation('required', 'original-tag');
  }

  /** Declare assembled operations independently of optional owner test suites. */
  private project(acceptance: string[]) {
    this.write('.arc/architecture/project.yaml', {
      id: 'fixture', remote, contractRegistry: 'registry.yaml', planTemplate: 'plan.md',
      director: { component: 'work', activity: 'planning' },
      verifier: { component: 'auditor', activity: 'assessment' },
      checks: { acceptance },
    });
  }

  /** Model effective typed argv through the actual operation resolver. */
  private operation(id: string, tag: string) {
    this.write('.arc/architecture/operations/' + id + '.yaml', {
      id, category: 'test', command: '/usr/bin/printf', network: false,
      args: ['%s', { parameter: 'tag' }], cwd: '.',
      parameters: { tag: { type: 'string', default: tag } },
    });
  }

  /** Bind each attempt to a real session with base and active authority retained separately. */
  private open(base: Capture, capture: Capture, head: string) {
    const journal = new Coordination(this.storage).admit(remote, goal);
    assert(journal instanceof Journal);
    const task = new HostTask({
      capture: base, common: join(this.root, '.git'), executable: '',
      base: 'staging', fresh: true, storage: this.storage,
    }, goal, journal);
    task.capture = capture;
    task.worktree = join(this.directory, 'assessment-' + this.generation++);
    this.git(this.root, 'worktree', 'add', '--detach', task.worktree, head);
    task.branch = '7-task';
    task.issue = '7';
    task.note({ workspace: journal.run, baseRevision: base.source.revision, branch: task.branch, issue: '7' });
    return task;
  }
}
