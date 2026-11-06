import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { InputError } from '../architecture/config.js';
import { ResourceQuery, type ResourceQueryInput } from '../report/resource-query.js';
import { progressView, readTimeline } from '../report/timeline.js';
import { statePath, type RecordData } from './state.js';

export interface WorkspaceTarget {
  source: string;
  packageId: string;
}

/** Projects retained managed workspaces without creating state, recovering hosts or exposing raw evidence. */
export class WorkspaceResources {
  private readonly root: string;

  private readonly query = new ResourceQuery();

  /** Resolves existing storage aliases without creating missing application directories. */
  constructor(root = statePath()) {
    this.root = existsSync(root) ? realpathSync(root) : root;
  }

  /** Lists managed receipts; unknown historical package membership is never guessed from current source. */
  list(target?: WorkspaceTarget, input: ResourceQueryInput = {}) {
    const directory = join(this.root, 'runs');
    const items = existsSync(directory)
      ? readdirSync(directory)
          .sort()
          .flatMap((id) => {
            if (!existsSync(join(directory, id, 'report.json'))) return [];
            const record = this.read(id);
            return record.workspace === join(this.root, 'workspaces', id)
              ? [this.project(record)]
              : [];
          })
      : [];
    const selected = target
      ? items.filter((item) => item.source === target.source && item.packageId === target.packageId)
      : items;
    return this.query.page(selected, { id: null, status: null, packageId: null }, input, [
      'id',
      'status',
      'packageId',
      'source',
      'branch',
    ]);
  }

  /** Returns stable resource revision and ordered event metadata with an exclusive resume cursor. */
  get(id: string, after = 0) {
    if (!Number.isSafeInteger(after) || after < 0) throw new InputError('Invalid event cursor');
    const record = this.read(id);
    if (record.workspace !== join(this.root, 'workspaces', id))
      throw new InputError('Record is not a managed workspace');
    const timeline = readTimeline(join(this.root, 'runs', id));
    const events = timeline.events
      .filter((event) => event.sequence > after)
      .map((event) => ({
        sequence: event.sequence,
        observedAt: event.observedAt,
        type: event.type,
        runId: event.runId,
        componentId: event.componentId,
      }));
    const workspace = this.project(record, timeline);
    return {
      workspace,
      progress: progressView(record, timeline.events),
      revision: workspace.revision,
      events,
      cursor: Math.max(after, timeline.events.at(-1)?.sequence ?? 0),
      timeline: { complete: timeline.complete, problem: timeline.problem },
      finalized: !!record.finishedAt || workspace.status === 'removed',
    };
  }

  /** Rejects unsafe identities and aliased receipts rather than following private execution paths. */
  private read(id: string): RecordData {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new InputError('Invalid workspace identity');
    const directory = join(this.root, 'runs', id),
      path = join(directory, 'report.json');
    const expiration = join(this.root, 'expired-evidence', id + '.json');
    if (!existsSync(path) && existsSync(expiration))
      throw new InputError(
        'Workspace evidence expired under retention policy; receipt: ' + expiration,
      );
    try {
      if (lstatSync(directory).isSymbolicLink() || !lstatSync(path).isFile())
        throw new Error('Unsafe workspace receipt');
      const record = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
      if (
        record.id !== id ||
        typeof record.workspace !== 'string' ||
        typeof record.source !== 'string'
      )
        throw new Error('Invalid workspace receipt');
      return record;
    } catch {
      throw new InputError('Workspace report unavailable or unsafe: ' + id);
    }
  }

  /** Exposes lifecycle and location fields, keeping model turns, operation output and bindings private. */
  private project(record: RecordData, timeline = readTimeline(join(this.root, 'runs', record.id))) {
    const cleanup = this.cleanup(record.id);
    const dependencies = this.dependencies(record.id);
    return {
      id: record.id,
      source: record.source,
      location: record.workspace,
      packageId: this.packageId(record),
      branch: record.branch,
      base: record.base,
      status: cleanup?.cleanupStatus ?? record.status,
      executionStatus: record.status,
      removedAt: cleanup?.removedAt,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      executionRunId: record.executionRunId,
      assignmentId: record.assignmentId,
      retained: record.executionRunId !== undefined || record.assignmentId !== undefined,
      dependencyCleanup: dependencies,
      revision: this.query.revision({ record, cleanup, dependencies, timeline }),
    };
  }

  /** Includes dependency reclamation in resource revisions without changing original run status. */
  private dependencies(id: string) {
    const path = join(this.root, 'runs', id, 'dependency-cleanup.json');
    if (!existsSync(path)) return undefined;
    if (!lstatSync(path).isFile()) throw new InputError('Unsafe dependency cleanup receipt');
    const receipt = JSON.parse(readFileSync(path, 'utf8'));
    if (receipt.id !== id || !['removing', 'reclaimed'].includes(receipt.status))
      throw new InputError('Invalid dependency cleanup receipt');
    return { status: receipt.status, outputs: receipt.outputs, finishedAt: receipt.finishedAt };
  }

  /** Reads the separate durable removal receipt without changing original execution evidence. */
  private cleanup(id: string): { cleanupStatus: 'removed'; removedAt: string } | undefined {
    const path = join(this.root, 'runs', id, 'cleanup.json');
    if (!existsSync(path)) return undefined;
    try {
      if (!lstatSync(path).isFile()) throw new Error('Unsafe cleanup receipt');
      const receipt = JSON.parse(readFileSync(path, 'utf8'));
      if (receipt.cleanupStatus !== 'removed' || typeof receipt.removedAt !== 'string')
        throw new Error('Invalid cleanup receipt');
      return { cleanupStatus: 'removed', removedAt: receipt.removedAt };
    } catch {
      throw new InputError('Workspace cleanup receipt unavailable or unsafe: ' + id);
    }
  }

  /** Uses captured package selection or its preparation subtree without loading mutable architecture. */
  private packageId(record: RecordData): string | null {
    if (typeof record.packageId === 'string') return record.packageId;
    const catalog = record.operationCatalog as
      Array<{ id: string; type: string; parentId?: string }> | undefined;
    const owners = record.preparationOwners as string[] | undefined;
    if (!Array.isArray(catalog) || !Array.isArray(owners)) return null;
    const packages = catalog.filter(
      (component) => component.type === 'package' && owners.includes(component.id),
    );
    const roots = packages.filter(
      (component) => !packages.some((parent) => parent.id === component.parentId),
    );
    return roots.length === 1 ? roots[0]!.id : null;
  }
}
