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
import { targetCommand, type Bindings } from '../architecture/bindings.js';
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
    this.release(op);
    if (existsSync(receipt))
      return this.restore(directory, JSON.parse(readFileSync(receipt, 'utf8')));
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    return this.attempt(directory, key, op, install);
  }

  /** Discards only a failed cache build; raw operation evidence remains in its run directory. */
  private async attempt(
    directory: string,
    key: string,
    op: Operation,
    install: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const before = ((this.record.operationInvocations ?? []) as unknown[]).length;
    try {
      return await this.install(directory, key, op, install);
    } catch (error) {
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

  /** Hashes the execution semantics used to identify reusable preparation. */
  private key(op: Operation): string {
    return createHash('sha256')
      .update(JSON.stringify(this.identity(op)))
      .digest('hex');
  }

  /** Retains dependency paths and exact bytes as execution inputs. */
  private inputIdentity(op: Operation): Array<[string, string]> {
    return op.dependencyInputs!.map((path) => [
      path,
      readFileSync(join(this.record.workspace, path)).toString('base64'),
    ]);
  }

  /** Resolves only command, authority, isolation and runtime inputs that affect installation. */
  private identity(op: Operation): Record<string, unknown> {
    if (op.kind !== 'command') throw new Error('Finite dependency command required');
    const bindings = this.record.bindings as Bindings | undefined;
    const tools = Object.values(bindings?.tools ?? {}).filter(
      (path): path is string => typeof path === 'string',
    );
    const environment = this.record.executionEnvironment as
      { id?: string; mode?: string } | undefined;
    const command = targetCommand(this.record, op);

    return {
      inputs: this.inputIdentity(op),
      command: { command: command.command, args: command.args },
      cwd: op.cwd,
      timeoutSeconds: op.timeoutSeconds,
      outputs: op.generatedDirectories,
      reads: operationReads(this.record, op),
      network: op.network,
      toolDirectories: [...new Set(tools.map(dirname))],
      confinementExecutable: bindings?.tools.codex ?? 'codex',
      environment: { id: environment?.id ?? this.record.id, mode: environment?.mode },
      repository: { id: op.repository, commonDir: this.record.commonDir },
      runtime: installedRuntime().hash,
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    };
  }

  /** Removes only previously declared disposable roots before replacement, never maintained source. */
  private release(op: Operation): void {
    for (const path of op.generatedDirectories)
      rmSync(join(this.record.workspace, path), { recursive: true, force: true });
    this.record.preparedDependencies = this.entries().filter(
      (entry) =>
        entry.operationId !== op.id &&
        !entry.outputs.some((output) =>
          op.generatedDirectories.some((path) => this.overlaps(output, path)),
        ),
    );
    save(this.root, this.record);
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
