import { createHash } from 'node:crypto';
import ts from 'typescript';
import type { Component } from './components.js';
import type { RepositoryRevision } from './repository-revisions.js';

type Facts = Pick<Component, 'id' | 'publicApi' | 'observedImports' | 'observedConsumers'>;

/** Reuses only derived facts from matching captured inputs, retaining the latest snapshot per repository. */
export class DerivedApiCache {
  private static readonly snapshots = new Map<string, { key: string; facts: Facts[] }>();

  private readonly key: string;

  /** Includes source authority, compiler version, exact ownership and API declarations in cache identity. */
  constructor(
    private readonly revision: RepositoryRevision,
    owners: Component[],
  ) {
    const inputs = owners
      .map((owner) => ({
        id: owner.id,
        schemaVersion: owner.schemaVersion,
        root: owner.repositoryRoot,
        owns: owner.allowedWritePaths,
        api: owner.api,
        publicModules: owner.ownership?.publicModules,
        files: owner.inventory,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    this.key = createHash('sha256')
      .update(
        JSON.stringify({
          analyzer: 1,
          compiler: ts.version,
          revision: revision.base,
          inputs,
        }),
      )
      .digest('hex');
  }

  /** Copies matching facts into the new catalog without sharing mutable arrays with prior runs. */
  restore(owners: Component[]): boolean {
    const snapshot = DerivedApiCache.snapshots.get(this.revision.source);
    if (!snapshot || snapshot.key !== this.key) return false;
    for (const owner of owners) {
      const facts = snapshot.facts.find((entry) => entry.id === owner.id);
      if (!facts) return false;
      Object.assign(owner, structuredClone(facts));
    }
    return true;
  }

  /** Keeps one private snapshot per repository; active callers retain their own captured copies. */
  retain(owners: Component[]): void {
    const facts = owners.map(({ id, publicApi, observedImports, observedConsumers }) => ({
      id,
      publicApi,
      observedImports,
      observedConsumers,
    }));
    DerivedApiCache.snapshots.set(this.revision.source, {
      key: this.key,
      facts: structuredClone(facts),
    });
  }
}
