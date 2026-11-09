import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { InputError } from '../architecture/config.js';
import { DeliveryStore } from '../coordination-store/delivery-store.js';
import { deliveryStatus } from '../coordination-store/delivery-types.js';
import { ResourceQuery, type ResourceQueryInput } from '../report/resource-query.js';
import { statePath } from '../workspace/state.js';

/** Provides host-independent delivery inspection and exact-revision local authorization. */
export class DeliveryResources {
  private readonly query = new ResourceQuery();

  /** Resolves application storage without creating directories or starting an execution host. */
  constructor(private readonly root = statePath()) {}

  /** Projects all retained delivery states through the shared typed filtering and pagination contract. */
  list(input: ResourceQueryInput = {}, target?: { projectId: string; packageId: string }) {
    const entries = this.entries().filter(
      (entry) =>
        !target || (entry.projectId === target.projectId && entry.packageId === target.packageId),
    );
    return this.query.page(
      entries,
      {
        id: null,
        projectId: null,
        packageId: null,
        runId: null,
        mode: ['live', 'simulation'],
        delivery: ['retained', 'committed', 'pushed'],
        integration: ['not_requested', 'pending', 'merged'],
        publication: ['not_requested', 'released'],
      },
      input,
    );
  }

  /** Returns a coherent immutable delivery projection with its current mutation revision. */
  get(id: string) {
    const entries = this.entries().filter((entry) => entry.id === id);
    if (entries.length !== 1) throw new InputError('Unknown or ambiguous delivery: ' + id);
    return entries[0]!;
  }

  /** Authorizes exactly the observed candidate revision without submitting or replacing a provider review. */
  approve(id: string, expectedRevision: string) {
    const captured = this.get(id);
    if (captured.revision !== expectedRevision) throw new InputError('Stale delivery revision');
    const store = new DeliveryStore(this.path(captured.projectId));
    try {
      store.approve(id, captured.version, captured.candidate);
    } finally {
      store.close();
    }
    return this.get(id);
  }

  /** Reads stores in deterministic project order; source and execution hosts are not consulted. */
  private entries() {
    const projects = join(this.root, 'projects');
    if (!existsSync(projects)) return [];
    return readdirSync(projects, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .filter((key) => existsSync(this.path(key)))
      .flatMap((key) => this.read(key));
  }

  /** Projects receipt metadata and revision tokens while always releasing read-only SQLite handles. */
  private read(key: string) {
    const store = new DeliveryStore(this.path(key), true);
    try {
      return store.list().map((delivery) => {
        if (delivery.projectId !== key) throw new Error('Delivery project identity mismatch');
        return {
          ...delivery,
          ...deliveryStatus(delivery),
          mode: delivery.environment.mode,
          revision: this.query.revision(delivery),
        };
      });
    } finally {
      store.close();
    }
  }

  /** Resolves only project keys obtained from retained state, never a caller-provided filesystem path. */
  private path(key: string): string {
    return join(this.root, 'projects', key, 'deliveries.sqlite');
  }
}
