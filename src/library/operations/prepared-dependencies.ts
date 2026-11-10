import { installedRuntime } from './installed-runtime.js';
import { createHash } from 'node:crypto';
import {
  constants,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { relativePath } from '../architecture/config.js';
import type { Component } from '../architecture/components.js';
import type { ResolvedAssignment } from '../architecture/assignment.js';
import { operationReads } from './operation-checkpoint.js';
import { targetCommand } from '../architecture/bindings.js';
import { observe } from '../report/timeline.js';
import { save, type RecordData } from '../workspace/state.js';
import type { Operation } from './operations.js';
import { git, type CommandResult } from './process.js';

interface Preparation {
  key: string;
  operationId: string;
  recordId: string;
  outputs: string[];
  result: CommandResult;
}

/** One workspace root moved aside so an interrupted rebuild can be undone. */
interface SetAside {
  live: string;
  stored: string;
}

/** Reuses settled installations within one environment without sharing writable filesystem aliases. */
export class PreparedDependencies {
  /** Binds preparation receipts to host storage and the current isolated worktree. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
  ) {}

  /** Protects materialized installations from all subsequent managed commands and services. */
  static outputs(record: RecordData): string[] {
    return ((record.preparedDependencies ?? []) as Preparation[]).flatMap((entry) => entry.outputs);
  }

  /** Executes the ordinary installer once, or materializes its observed successful result. */
  async run(op: Operation, install: () => Promise<CommandResult>): Promise<CommandResult> {
    if (!op.dependencyInputs) return install();
    this.validate(op);
    const key = this.key(op);
    const directory = join(this.root, 'prepared-dependencies', key);
    const receipt = join(directory, 'receipt.json');
    const previous = this.entries().find((entry) => entry.operationId === op.id);
    if (
      previous?.key === key &&
      previous.outputs.every((path) => existsSync(join(this.record.workspace, path)))
    )
      return previous.result;
    if (existsSync(directory) && !existsSync(receipt))
      throw new Error(
        'Dependency preparation is incomplete; inspect retained operation evidence: ' + directory,
      );
    const aside = this.release(op);
    if (existsSync(receipt)) {
      const result = this.restore(directory, JSON.parse(readFileSync(receipt, 'utf8')));
      this.discard();
      return result;
    }
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    return this.attempt(directory, key, op, install, aside);
  }

  /** Discards only a failed cache build; raw operation evidence remains in its run directory. */
  private async attempt(
    directory: string,
    key: string,
    op: Operation,
    install: () => Promise<CommandResult>,
    aside: SetAside[],
  ): Promise<CommandResult> {
    const before = ((this.record.operationInvocations ?? []) as unknown[]).length;
    try {
      const result = await this.install(directory, key, op, install);
      this.discard();
      return result;
    } catch (error) {
      this.replace(aside);
      const invocations = (this.record.operationInvocations ?? []) as Array<{
        operationId: string;
        status: string;
      }>;
      const current = invocations.slice(before).findLast((item) => item.operationId === op.id);
      if (current?.status === 'failed') rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }

  /** Publishes a receipt only after supervised installation and snapshot copying finish. */
  private async install(
    directory: string,
    key: string,
    op: Operation,
    install: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const receipt = join(directory, 'receipt.json');
    const result = await install();
    if (result.exitCode !== 0) throw new Error('Dependency preparation did not succeed');
    for (const output of op.generatedDirectories)
      this.copy(join(this.record.workspace, output), join(directory, 'outputs', output));
    const entry = {
      key,
      operationId: op.id,
      recordId: this.record.id,
      outputs: op.generatedDirectories,
      result,
    };
    writeFileSync(receipt + '.tmp', JSON.stringify(entry), { mode: 0o600 });
    renameSync(receipt + '.tmp', receipt);
    this.retain(entry);
    return result;
  }

  /** Requires explicit finite installation inputs and disposable, non-overlapping outputs. */
  private validate(op: Operation): void {
    if (
      op.kind !== 'command' ||
      !op.dependencyInputs?.length ||
      !op.generatedDirectories.length ||
      op.artifacts.length
    )
      throw new Error(
        'Dependency preparation requires a finite command, inputs, outputs and no per-invocation artifacts',
      );
    const tracked = this.maintained();
    for (const path of [...op.dependencyInputs, ...op.generatedDirectories]) {
      relativePath(path);
      this.noAliases(path);
    }
    for (const output of op.generatedDirectories)
      if (
        tracked.some((path) => this.overlaps(path, output)) ||
        op.dependencyInputs.some((path) => this.overlaps(path, output))
      )
        throw new Error('Dependency output overlaps maintained inputs: ' + output);
    if (
      op.generatedDirectories.some((path, index, all) =>
        all.some((other, n) => n !== index && this.overlaps(path, other)),
      )
    )
      throw new Error('Dependency outputs overlap');
  }

  /** Includes captured ownership roots so untracked maintained edits are never disposable. */
  private maintained(): string[] {
    const resolved = this.record.resolvedAssignment as ResolvedAssignment | undefined;
    const catalog =
      resolved?.initialization.catalog ?? (this.record.operationCatalog as Component[]);
    return [
      ...git(this.record.workspace, 'ls-files', '-z').split('\0').filter(Boolean),
      ...catalog.flatMap((component) => component.allowedWritePaths ?? []),
    ];
  }

  /** Anchors identity to input bytes, actual command, read authority, environment and installed runtime. */
  private key(op: Operation): string {
    if (op.kind !== 'command') throw new Error('Finite dependency command required');
    const inputs = op.dependencyInputs!.map((path) => [
      path,
      readFileSync(join(this.record.workspace, path)).toString('base64'),
    ]);
    return createHash('sha256')
      .update(
        JSON.stringify({
          inputs,
          definition: op.definitionDigest,
          command: targetCommand(this.record, op),
          cwd: op.cwd,
          outputs: op.generatedDirectories,
          reads: operationReads(this.record, op),
          bindings: this.record.bindings,
          environment: this.record.executionEnvironment ?? this.record.id,
          repository: this.record.commonDir,
          runtime: installedRuntime().hash,
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
        }),
      )
      .digest('hex');
  }

  /** Sets aside previously declared disposable roots before replacement, never maintained source. */
  private release(op: Operation): SetAside[] {
    const aside: SetAside[] = [];
    for (const path of op.generatedDirectories) {
      const live = join(this.record.workspace, path);
      if (!existsSync(live)) continue;
      const stored = join(this.quarantine, this.stamp(), path);
      mkdirSync(dirname(stored), { recursive: true });
      renameSync(live, stored);
      aside.push({ live, stored });
    }
    this.record.preparedDependencies = this.entries().filter(
      (entry) => entry.operationId !== op.id,
    );
    save(this.root, this.record);
    return aside;
  }

  /**
   * Returns every set-aside root after an interrupted rebuild.
   *
   * Outputs left by a failed preparation are not evidence of anything, so they are discarded and
   * the previously held tree is put back rather than merged with them.
   */
  private replace(aside: SetAside[]): void {
    for (const item of aside) {
      if (!existsSync(item.stored)) continue;
      rmSync(item.live, { recursive: true, force: true });
      mkdirSync(dirname(item.live), { recursive: true });
      renameSync(item.stored, item.live);
    }
    this.discard();
  }

  /** Drops set-aside copies once the replacement they were guarding is in place. */
  private discard(): void {
    rmSync(this.quarantine, { recursive: true, force: true });
  }

  /** One ignored holding area per workspace, so no stale tree is ever the only copy. */
  private get quarantine(): string {
    return join(this.record.workspace, '.prepared-stale');
  }

  /** Names a set-aside batch uniquely enough that concurrent runs cannot share a slot. */
  private stamp(): string {
    return [this.record.id, process.pid, Date.now()].join('-');
  }

  /** Materializes private copies so existing source confinement needs no symlink exceptions. */
  private restore(directory: string, entry: Preparation): CommandResult {
    for (const output of entry.outputs)
      this.copy(join(directory, 'outputs', output), join(this.record.workspace, output));
    this.retain(entry);
    observe(this.root, this.record, 'operation.preparation-reused', {
      operationId: entry.operationId,
      preparationKey: entry.key,
      sourceRecordId: entry.recordId,
      result: entry.result,
    });
    return entry.result;
  }

  /** Records installation identity without claiming a new command invocation or verification pass. */
  private retain(entry: Preparation): void {
    this.record.preparedDependencies = [
      ...this.entries().filter((item) => item.operationId !== entry.operationId),
      entry,
    ];
    save(this.root, this.record);
  }

  /** Reads host-owned preparation evidence; candidates cannot supply these receipts. */
  private entries(): Preparation[] {
    return (this.record.preparedDependencies ?? []) as Preparation[];
  }

  /** Copies directories with reflinks when supported, preserving package-local executable links. */
  private copy(source: string, destination: string): void {
    if (!lstatSync(source).isDirectory())
      throw new Error('Dependency output must be a real directory: ' + source);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    cpSync(source, destination, {
      recursive: true,
      verbatimSymlinks: true,
      mode: constants.COPYFILE_FICLONE,
    });
  }

  /** Rejects aliases in declared input/output ancestors before copying or removing anything. */
  private noAliases(path: string): void {
    let current = this.record.workspace;
    for (const segment of path.split('/')) {
      current = join(current, segment);
      try {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1))
          throw new Error('Unsafe dependency path: ' + path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  /** Distinguishes directory containment from similarly named siblings. */
  private overlaps(first: string, second: string): boolean {
    return first === second || first.startsWith(second + '/') || second.startsWith(first + '/');
  }
}
