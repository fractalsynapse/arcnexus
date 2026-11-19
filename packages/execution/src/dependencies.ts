import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkMounts } from './check-sandbox.js';
import { execute } from './process.js';
import { git } from './git.js';
import { fileIdentity } from './check-cache.js';
import type { CheckResult } from './check.js';
import type { HostTask } from './index.js';

/** Bind a prepared installation to the actual candidate inputs and confined npm toolchain. */
export class CheckDependencies {
  private readonly worktree: string;
  private readonly key: string;
  readonly directory: string;
  private readonly receipt: string;

  /** Retain no mutable process-global state; the project writer serializes preparation. */
  constructor(private readonly task: HostTask) {
    this.worktree = task.worktree!;
    this.key = dependencyKey(this.worktree, task.capture.source.remote);
    const root = join(task.config.storage, 'dependencies', this.key);
    this.directory = join(root, 'node_modules');
    this.receipt = join(root, 'prepared.json');
  }

  /** Prepare once for matching inputs, retaining the exact process observation on every execution. */
  async prepare(signal: AbortSignal): Promise<CheckResult | undefined> {
    signal.throwIfAborted();
    if (this.ready()) return;
    mkdirSync(dirname(this.directory), { recursive: true, mode: 0o700 });
    if (realpathSync(dirname(this.directory)) !== dirname(this.directory))
      throw new Error('Dependency storage is an alias');
    rmSync(this.directory, { recursive: true, force: true });
    rmSync(this.receipt, { force: true });
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (realpathSync(this.directory) !== this.directory)
      throw new Error('Dependency directory is an alias');
    const result = await this.install(signal);
    this.task.note({ dependencyPreparation: result, dependencyInput: this.key });
    if (result.status !== 0) return result;
    writeFileSync(this.receipt, JSON.stringify({ input: this.key, result }), {
      mode: 0o600,
      flag: 'wx',
    });
  }

  /** Require both the successful host receipt and the installed lock before reusing a tree. */
  private ready() {
    if (!existsSync(this.receipt) || !existsSync(join(this.directory, '.package-lock.json')))
      return false;
    if (realpathSync(this.directory) !== this.directory)
      throw new Error('Dependency directory is an alias');
    const receipt = JSON.parse(readFileSync(this.receipt, 'utf8'));
    return (
      receipt.input === this.key && receipt.result.status === 0 && existsSync(receipt.result.log)
    );
  }

  /** Run the fixed, offline prerequisite inside the existing disposable project overlay. */
  private async install(signal: AbortSignal): Promise<CheckResult> {
    const log = this.task.artifact('dependencies.log');
    const args = installArgs;
    const sandbox = checkMounts(this.worktree, this.task.config.common, this.directory, true);
    const cache = join(homedir(), '.npm', '_cacache');
    if (existsSync(cache))
      sandbox.push('--overlay-src', cache, '--tmp-overlay', '/tmp/npm-cache/_cacache');
    const start = performance.now();
    const invocation = [...sandbox, '--chdir', this.worktree, '--', '/usr/bin/npm', ...args];
    const { status } = await execute('/usr/bin/bwrap', invocation, {
      cwd: this.worktree,
      log,
      signal,
    });
    return {
      id: 'dependencies',
      command: '/usr/bin/npm',
      args,
      cwd: this.worktree,
      status,
      log,
      durationMs: Math.round(performance.now() - start),
    };
  }
}

/** Include local source conservatively when npm can resolve workspace, file or git dependencies. */
function dependencyKey(worktree: string, remote: string) {
  const inputs = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', '.npmrc'].map(
    (name) => {
      const path = join(worktree, name);
      return [name, existsSync(path) ? readFileSync(path, 'utf8') : null];
    },
  );
  const local = registryDependencies(worktree) ? undefined : localInput(worktree);
  const tools = {
    node: process.versions,
    npm: fileIdentity('/usr/bin/npm'),
    nodeExecutable: fileIdentity('/usr/bin/node'),
  };
  return createHash('sha256')
    .update(JSON.stringify({ remote, inputs, local, tools }))
    .digest('hex');
}

/** Let npm diagnose malformed locks instead of aborting while computing cache metadata. */
function registryDependencies(worktree: string) {
  try {
    const lock = JSON.parse(readFileSync(join(worktree, 'package-lock.json'), 'utf8'));
    return Object.values(lock.packages ?? {}).every(
      (entry: any) => !entry.link && (!entry.resolved || /^https?:/.test(entry.resolved)),
    );
  } catch {
    return false;
  }
}

/** Reuse local dependencies only at clean checkpoints, including ignored and untracked inputs. */
function localInput(worktree: string) {
  if (git(worktree, 'status', '--porcelain', '--untracked-files=all', '--ignored'))
    return randomUUID();
  return git(worktree, 'rev-parse', 'HEAD');
}

const installArgs = [
  'ci',
  '--offline',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  '--progress=false',
  '--cache=/tmp/npm-cache',
];
