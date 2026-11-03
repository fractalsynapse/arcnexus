import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { InputError } from '../architecture/config.js';
import { ResourceQuery, type ResourceQueryInput } from '../report/resource-query.js';
import { readTimeline } from '../report/timeline.js';
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
    return {
      workspace: this.project(record),
      revision: this.query.revision(record),
      events,
      cursor: Math.max(after, timeline.events.at(-1)?.sequence ?? 0),
      timeline: { complete: timeline.complete, problem: timeline.problem },
      finalized: !!record.finishedAt || record.status === 'removed',
    };
  }

  /** Rejects unsafe identities and aliased receipts rather than following private execution paths. */
  private read(id: string): RecordData {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new InputError('Invalid workspace identity');
    const directory = join(this.root, 'runs', id),
      path = join(directory, 'report.json');
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
  private project(record: RecordData) {
    return {
      id: record.id,
      source: record.source,
      location: record.workspace,
      packageId: this.packageId(record),
      branch: record.branch,
      base: record.base,
      status: record.status,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      executionRunId: record.executionRunId,
      assignmentId: record.assignmentId,
      retained: record.executionRunId !== undefined || record.assignmentId !== undefined,
      revision: this.query.revision(record),
    };
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
