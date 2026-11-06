import {
  existsSync,
  lstatSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { relativePath } from '../architecture/config.js';
import { ExecutionStore } from '../coordination-store/execution-store.js';
import { DeliveryStore } from '../coordination-store/delivery-store.js';
import { terminalRunStatuses } from '../coordination-store/execution-types.js';
import { deliveryRetainsEvidence } from './retention-catalog.js';
import { git } from '../operations/process.js';
import type { RecordData } from './state.js';

/** Reclaims prepared dependency copies while retaining completed source and original evidence. */
export class DependencyCleanup {
  /** Binds disposal to the existing workspace service's repository execution lease. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
  ) {}

  /** Validates the complete removal set before deleting any recorded, rebuildable output. */
  run(): RecordData {
    this.terminal();
    const outputs = this.outputs();
    const paths = outputs.map((output) => this.path(output));
    const receipt = join(this.root, 'runs', this.record.id, 'dependency-cleanup.json');
    const evidence = { id: this.record.id, outputs, workspace: this.record.workspace };
    this.save(receipt, { ...evidence, status: 'removing' });
    for (const path of paths) rmSync(path, { recursive: true, force: true });
    this.save(receipt, { ...evidence, status: 'reclaimed', finishedAt: new Date().toISOString() });
    return { ...this.record, cleanupStatus: 'dependencies_reclaimed' };
  }

  /** Requires an authoritative terminal run and settled workspace operations, not a timestamp alone. */
  private terminal(): void {
    if (
      !['completed', 'prepared'].includes(this.record.status) ||
      typeof this.record.executionRunId !== 'string'
    )
      throw new Error('Workspace is retained by execution; completed run evidence is required');
    const runs = this.runs();
    if (runs.length !== 1 || !terminalRunStatuses.includes(runs[0]!.status))
      throw new Error('Workspace is retained by execution; its run is not unambiguously terminal');
    const invocations = this.record.operationInvocations as { status: string }[] | undefined;
    if (!invocations || invocations.some((operation) => operation.status !== 'completed'))
      throw new Error('Workspace operation completion is unresolved');
  }

  /** Reads existing run stores without starting a host or migrating historical databases. */
  private runs() {
    const directory = join(this.root, 'projects');
    if (!existsSync(directory)) return [];
    return readdirSync(directory).flatMap((project) => {
      const path = join(directory, project, 'execution.sqlite');
      if (!existsSync(path)) return [];
      const store = new ExecutionStore(path, true);
      try {
        const runs = store.runs().filter((run) => run.id === this.record.executionRunId);
        if (
          runs.some((run) => run.data.pendingPublication) ||
          (runs.length && this.pendingDelivery(join(directory, project)))
        )
          throw new Error('Pending publication retains dependency outputs');
        return runs;
      } finally {
        store.close();
      }
    });
  }

  /** Keeps dependencies needed by a retained publication or promotion until integration completes. */
  private pendingDelivery(project: string): boolean {
    const path = join(project, 'deliveries.sqlite');
    if (!existsSync(path)) return false;
    const store = new DeliveryStore(path, true);
    try {
      return store
        .list()
        .some(
          (delivery) =>
            delivery.runId === this.record.executionRunId && deliveryRetainsEvidence(delivery),
        );
    } finally {
      store.close();
    }
  }

  /** Uses successful preparation receipts rather than interpreting directory names as disposable. */
  private outputs(): string[] {
    const entries = this.record.preparedDependencies as
      { key: string; outputs: string[]; result: { exitCode: number } }[] | undefined;
    if (!entries?.length || entries.some((entry) => entry.result.exitCode !== 0))
      throw new Error('No settled dependency preparation receipts; preserve historical outputs');
    const outputs = [...new Set(entries.flatMap((entry) => entry.outputs))];
    if (!outputs.length) throw new Error('No dependency outputs were recorded');
    for (const output of outputs) {
      relativePath(output);
      if (!this.record.environment.generatedDirectories.includes(output))
        throw new Error('Dependency output is not a declared generated directory: ' + output);
      if (git(this.record.workspace, 'ls-files', '--', output).trim())
        throw new Error('Dependency output overlaps maintained source: ' + output);
    }
    return outputs;
  }

  /** Rejects relocated roots and symlink ancestors before recursive removal can begin. */
  private path(output: string): string {
    let path = this.record.workspace;
    if (realpathSync(path) !== path) throw new Error('Workspace path is aliased');
    for (const segment of output.split('/')) {
      path = join(path, segment);
      const stat = lstatSync(path, { throwIfNoEntry: false });
      if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
        throw new Error('Dependency output path is unsafe: ' + output);
    }
    return path;
  }

  /** Keeps reclamation progress separate from the immutable original execution report. */
  private save(path: string, value: object): void {
    if (existsSync(path) && !lstatSync(path).isFile())
      throw new Error('Unsafe dependency cleanup receipt');
    const temporary = path + '.' + randomUUID() + '.tmp';
    writeFileSync(temporary, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(temporary, path);
  }
}
