import { WorkdaySelection } from './workday-selection.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { git } from '../operations/process.js';
import { ExecutionStore } from '../coordination-store/execution-store.js';
import { runStatuses, type RunMode } from '../coordination-store/execution-types.js';
import { ExecutionReports } from '../report/report.js';
import { ResourceQuery, type ResourceQueryInput } from '../report/resource-query.js';
import { InputError } from '../architecture/config.js';
import { statePath } from '../workspace/state.js';

/** Discovers and projects durable runs without launching hosts or mutating captured execution state. */
export class ExecutionResources {
  /** Resolves only the configured state path; missing storage remains absent. */
  constructor(private readonly root = statePath()) {}

  /** Lists one run mode through the common typed query and pagination contract. */
  list(mode: RunMode, query: ResourceQueryInput = {}) {
    return new ResourceQuery().page(
      this.entries().filter((entry) => entry.mode === mode),
      {
        id: null,
        status: runStatuses,
        packageId: null,
      },
      query,
      ['id', 'status', 'packageId', 'objective'],
    );
  }

  /** Returns a coherent run projection and correlated ordered events after an exclusive cursor. */
  get(mode: RunMode, id: string, after = 0) {
    if (!Number.isSafeInteger(after) || after < 0) throw new InputError('Invalid event cursor');
    const matches = this.entries().filter((entry) => entry.mode === mode && entry.id === id);
    if (matches.length !== 1) throw new InputError('Unknown or ambiguous ' + mode + ': ' + id);
    return this.read(matches[0]!.project, (store, reports) => {
      const view = reports.view(id);
      const identifiers = new Set([id, ...view.assignments.map((a) => a.id)]);
      const events = store.events(after);
      return {
        ...view,
        project: matches[0]!.project,
        revision: new ResourceQuery().revision(view),
        events: events.filter((event) =>
          ['id', 'runId', 'from', 'to'].some(
            (key) => typeof event.data[key] === 'string' && identifiers.has(event.data[key]),
          ),
        ),
        cursor: Number(events.at(-1)?.sequence ?? after),
      };
    });
  }

  /** Selects an explicit or unambiguous workday without querying a host for mutable global context. */
  workday(id?: string, cwd = process.cwd()) {
    const selected = new WorkdaySelection().select(this.entries(), id, cwd);
    return this.read(selected.project, (store, reports) => {
      const view = reports.view(selected.id);
      const capturedRevision = (view.run.data as Record<string, unknown>).authorityBase;
      const sourceRevision = this.sourceRevision(selected.project);
      const tasks = store
        .runs()
        .filter((run) => run.mode === 'task')
        .map((run) => reports.view(run.id).run);
      return {
        workday: view.run,
        assignments: view.assignments,
        counts: view.counts,
        tasks,
        active: view.assignments.some((assignment) => assignment.status === 'running')
          ? selected.id
          : null,
        observation: 'retained',
        capturedRevision,
        sourceRevision,
        sourceChanged: sourceRevision ? sourceRevision !== capturedRevision : null,
        project: selected.project,
        revision: new ResourceQuery().revision(view),
        candidate: (view.run.data as Record<string, unknown>).candidateRevision,
        report: view.report,
      };
    });
  }

  /** Observes source drift when retained host metadata is available; absent source is explicitly unknown. */
  private sourceRevision(project: string): string | null {
    try {
      const directory = join(this.root, 'projects', project);
      const metadata = JSON.parse(readFileSync(join(directory, 'host.json'), 'utf8'));
      if (
        typeof metadata.contextFile !== 'string' ||
        basename(metadata.contextFile) !== metadata.contextFile
      )
        return null;
      const context = JSON.parse(readFileSync(join(directory, metadata.contextFile), 'utf8'));
      return git(context.source, 'rev-parse', 'HEAD').trim();
    } catch {
      return null;
    }
  }

  /** Enumerates project stores in deterministic order and preserves submission order within a project. */
  private entries() {
    const directory = join(this.root, 'projects');
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .filter((key) => existsSync(join(directory, key, 'execution.sqlite')))
      .flatMap((key) =>
        this.read(key, (store, reports) =>
          store.runs().map((run) => {
            const view = reports.view(run.id);
            return {
              ...view.run,
              project: key,
              packageId: run.data.packageId ?? null,
              revision: new ResourceQuery().revision(view),
            };
          }),
        ),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Opens one read-only SQLite snapshot and always releases it before returning to a caller. */
  private read<T>(key: string, read: (store: ExecutionStore, reports: ExecutionReports) => T): T {
    const directory = join(this.root, 'projects', key);
    const store = new ExecutionStore(join(directory, 'execution.sqlite'), true);
    try {
      return store.snapshot(() => read(store, new ExecutionReports(directory, store)));
    } finally {
      store.close();
    }
  }
}
