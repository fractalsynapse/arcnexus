import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { checkInput } from '../../src/check-cache.js';
import { git } from '../../src/git.js';
import { HostTask } from '../../src/index.js';

type Operation = Capture['operations'][string];

export const fixtureOperation: Operation = {
  id: 'fixture-check',
  category: 'build',
  command: '/usr/bin/true',
  args: [],
  cwd: '.',
  network: false,
};

/** Model actual clean task worktrees and durable, controlled check observations across admission. */
export class CheckCacheFixture {
  readonly base = mkdtempSync(join(tmpdir(), 'arcnexus-check-input-'));
  readonly source = join(this.base, 'source');
  readonly scope = { owner: 'owner', activity: 'implementation', expected: 'pass' } as const;
  task: HostTask;
  private generation = 0;

  /** Keep source, worktree and journal storage separate, as production does. */
  constructor(t: TestContext) {
    mkdirSync(join(this.source, '.arc/architecture/components'), { recursive: true });
    git(this.source, 'init', '-q');
    mkdirSync(join(this.source, 'packages/execution/src'), { recursive: true });
    writeFileSync(join(this.source, 'packages/execution/src/fixture.ts'), 'export const fixture = true;\n');
    writeFileSync(join(this.source, 'eslint.config.js'), 'export default [];\n');
    writeFileSync(join(this.source, '.arc/architecture/components/owner.yaml'), 'id: owner\nowns:\n  - packages/execution/src/fixture.ts\n  - eslint.config.js\n  - lint-rules.ts\n');
    writeFileSync(join(this.source, '.gitignore'), 'node_modules/\n');
    this.commit(this.source);
    this.task = this.open(fixtureOperation, git(this.source, 'rev-parse', 'HEAD'));
    t.after(() => {
      this.task.close();
      rmSync(this.base, { recursive: true, force: true });
    });
  }

  /** Record known input provenance; this is controlled evidence, not a claim of native execution. */
  async observe(input?: string) {
    input ??= await this.input();
    assert(input);
    const log = this.task.store('controlled-check.log', 'controlled successful observation');
    const check = {
      id: 'fixture-check',
      status: 0,
      command: '/usr/bin/true',
      args: [],
      cwd: this.task.worktree!,
      durationMs: 1,
      log,
    };
    this.task.note({ check, scope: this.scope, checkInput: input });
    return check;
  }

  /** Identify validated inputs through the production fingerprint function. */
  input() {
    return checkInput(this.task, 'fixture-check', this.scope);
  }

  /** Reconstruct the same checkpoint at a different path through a new journal admission. */
  restart(operation: Operation = fixtureOperation) {
    const head = git(this.task.worktree!, 'rev-parse', 'HEAD');
    this.task.finish({ kind: 'blocked', reason: 'Controlled restart', evidence: [] });
    this.task.close();
    git(this.source, 'worktree', 'remove', '--force', this.task.worktree!);
    this.task = this.open(operation, head);
  }

  /** Change a real checkpoint instead of pretending a journal label changes its inputs. */
  change() {
    writeFileSync(join(this.task.worktree!, 'packages/execution/src/fixture.ts'), 'changed');
    this.commit(this.task.worktree!);
  }

  /** Create a new execution session with explicit generic fixture authority. */
  private open(operation: Operation, head: string) {
    const worktree = join(this.base, `worktree-${this.generation++}`);
    git(this.source, 'worktree', 'add', '--detach', worktree, head);
    const capture = this.capture(operation);
    const storage = join(this.base, 'state');
    const journal = new Coordination(storage).admit(capture.source.remote, 'Verify check inputs');
    assert('close' in journal);
    const task = new HostTask(
      {
        capture,
        storage,
        common: join(this.source, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
      },
      'Verify check inputs',
      journal,
    );
    task.worktree = worktree;
    return task;
  }

  /** Capture explicit fixture authority separately from writer and worktree lifecycle. */
  private capture(operation: Operation) {
    const capture = {
      source: {
        root: this.source,
        paths: ['.arc/architecture/components/owner.yaml'],
        remote: 'https://example.com/fixture.git',
        revision: git(this.source, 'rev-parse', 'HEAD'),
        read: (path: string) => readFileSync(join(this.source, path), 'utf8'),
      },
      project: { contractRegistry: 'registry.yaml' },
      contracts: [],
      components: { owner: { id: 'owner', owns: ['packages/execution/src/fixture.ts', 'eslint.config.js'], activities: {} } },
      operations: { 'fixture-check': operation },
    } as unknown as Capture;
    return capture;
  }

  /** Commit fixture inputs with a fixed local identity and no global Git configuration. */
  private commit(directory: string) {
    git(directory, 'add', '-A');
    git(
      directory,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'Fixture checkpoint',
    );
  }
}
