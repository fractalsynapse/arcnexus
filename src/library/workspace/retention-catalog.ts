import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionStore } from '../coordination-store/execution-store.js';
import { DeliveryStore } from '../coordination-store/delivery-store.js';
import { terminalRunStatuses, type ExecutionRun } from '../coordination-store/execution-types.js';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';

/** Pending integration or simulated release still requires the original engineering evidence. */
export function deliveryRetainsEvidence(delivery: DeliveryRecord): boolean {
  return (
    delivery.integration !== 'merged' ||
    (delivery.environment.mode === 'simulation' && delivery.publication !== 'released')
  );
}

export interface RetainedEvidence {
  id: string;
  runId: string;
  createdAt: string;
}

/** Derives expiration candidates from authoritative run state, protecting unfinished and publication references. */
export class RetentionCatalog {
  /** Limits inventory to existing application state without starting hosts or migrating stores. */
  constructor(private readonly root: string) {}

  /** Returns oldest eligible evidence first; unidentified historical directories remain protected. */
  eligible(): RetainedEvidence[] {
    const protectedIds = new Set<string>();
    const candidates: RetainedEvidence[] = [];
    const directory = join(this.root, 'projects');
    if (!existsSync(directory)) return [];
    for (const project of readdirSync(directory))
      this.project(join(directory, project), protectedIds, candidates);
    return candidates
      .filter((entry) => !protectedIds.has(entry.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  /** Protects all references from active runs and deliveries before selecting terminal-run bundles. */
  private project(
    directory: string,
    protectedIds: Set<string>,
    candidates: RetainedEvidence[],
  ): void {
    const path = join(directory, 'execution.sqlite');
    if (!existsSync(path)) return;
    const store = new ExecutionStore(path, true);
    try {
      const pending = this.deliveries(directory, protectedIds);
      for (const run of store.runs()) {
        const assignments = store.assignments(run.id);
        if (
          !terminalRunStatuses.includes(run.status) ||
          run.data.pendingPublication ||
          pending.has(run.id)
        ) {
          this.references([run.data, assignments], protectedIds);
          continue;
        }
        const ids = this.records(
          run,
          assignments.map((a) => a.data.recordId),
        );
        for (const id of ids) candidates.push({ id, runId: run.id, createdAt: run.createdAt });
      }
    } finally {
      store.close();
    }
  }

  /** Keeps pending publication and its attributed engineering evidence regardless of age. */
  private deliveries(directory: string, protectedIds: Set<string>): Set<string> {
    const path = join(directory, 'deliveries.sqlite');
    if (!existsSync(path)) return new Set();
    const store = new DeliveryStore(path, true);
    try {
      const pending = store.list().filter(deliveryRetainsEvidence);
      this.references(pending, protectedIds);
      return new Set(pending.map((d) => d.runId));
    } finally {
      store.close();
    }
  }

  /** Collects existing workspace identities without inventing ownership from file timestamps. */
  private records(run: ExecutionRun, assignments: unknown[]): string[] {
    const workspace = run.data.workspace as { id?: string } | undefined;
    return [
      ...new Set(
        [
          workspace?.id,
          ...assignments,
          ...((run.data.previousPolicyWorkspaces ?? []) as unknown[]),
        ].filter((id): id is string => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id)),
      ),
    ];
  }

  /** Conservatively pins UUID references even when nested inside retained paths or checkpoint data. */
  private references(value: unknown, ids: Set<string>): void {
    if (typeof value === 'string')
      for (const id of value.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g) ?? [])
        ids.add(id);
    else if (value && typeof value === 'object')
      for (const child of Object.values(value)) this.references(child, ids);
  }
}
