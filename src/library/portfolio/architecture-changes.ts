import { randomUUID } from 'node:crypto';
import type {
  PortfolioStore,
  ArchitectureMutation,
} from '../coordination-store/portfolio-store.js';
import { ConfigurationCommit } from './configuration-commit.js';
import { ancestry, loadCatalog } from '../architecture/components.js';
import { loadProjectBindings } from '../architecture/bindings.js';
import { InputError } from '../architecture/config.js';
import { git } from '../operations/process.js';

/** Journals local configuration branch transitions before atomically selecting shared repository authority. */
export class ArchitectureChanges {
  private readonly commits: ConfigurationCommit;

  /** Uses an already leased repository and caller-owned writable portfolio store. */
  constructor(
    private readonly store: PortfolioStore,
    private readonly source: string,
    private readonly repositoryId: string,
  ) {
    this.commits = new ConfigurationCommit(source);
  }

  /** Finishes only recorded, validated transitions; unexpected refs require explicit reconciliation. */
  recover(): void {
    for (const intent of this.store
      .mutations()
      .filter((entry) => entry.repositoryId === this.repositoryId && entry.status === 'pending'))
      this.finish(intent);
  }

  /** Validates a complete immutable proposal before recording any visible selection or branch change. */
  apply(
    base: string,
    change: { path: string; text: string },
    componentId: string,
    packageId?: string,
  ): void {
    const repository = this.store.repositories().find((entry) => entry.id === this.repositoryId)!;
    const next = this.commits.create(base, change);
    this.validate(next, componentId, packageId);
    const ref = repository.authority?.ref ?? 'refs/heads/arcnexus/configuration/' + repository.id;
    const previousRef = this.commits.ref(ref);
    if (previousRef !== (repository.authority?.base ?? ''))
      throw new Error('Configuration branch changed; reconcile retained authority');
    if (next === base) return;
    const intent: ArchitectureMutation = {
      id: randomUUID(),
      repositoryId: repository.id,
      sourceBase: git(this.source, 'rev-parse', 'HEAD').trim(),
      previousBase: base,
      previousRef,
      base: next,
      ref,
      status: 'pending',
    };
    this.store.transaction('architecture.intent', () => this.store.mutation(intent));
    this.finish(intent);
  }

  /** Keeps registered identities and package relationships intact while checking all captured architecture. */
  private validate(base: string, componentId?: string, packageId?: string): void {
    try {
      const catalog = loadCatalog(this.source, base, loadProjectBindings(this.source));
      for (const registration of this.store
        .registrations()
        .filter((entry) => entry.repositoryId === this.repositoryId)) {
        const component = catalog.components[registration.definitionId];
        if (
          !component ||
          component.type !== registration.kind ||
          (component.type === 'package' && component.parentId !== registration.id.split('/')[0])
        )
          throw new Error('Update changes registered identity or platform; use explicit migration');
      }
      if (
        componentId &&
        packageId &&
        !ancestry(catalog, componentId).some((entry) => entry.id === packageId)
      )
        throw new Error('Update moves the component outside its selected package');
    } catch (error) {
      throw new InputError(String(error));
    }
  }

  /** Reconciles the exact Git transition then commits selection and journal completion in one transaction. */
  private finish(intent: ArchitectureMutation): void {
    if (git(this.source, 'rev-parse', 'HEAD').trim() !== intent.sourceBase)
      throw new Error('Source changed during configuration transition; needs attention');
    const selected = this.store
      .repositories()
      .find((entry) => entry.id === this.repositoryId)!.authority;
    if ((selected?.base ?? intent.sourceBase) !== intent.previousBase)
      throw new Error(
        'Selected authority changed during configuration transition; needs attention',
      );
    this.validate(intent.base);
    const current = this.commits.ref(intent.ref);
    if (![intent.previousRef, intent.base].includes(current))
      throw new Error('Configuration branch conflicts with retained intent; needs attention');
    if (current !== intent.base) this.commits.select(intent.ref, intent.base, intent.previousRef);
    this.store.transaction('architecture.selected', () => {
      this.validate(intent.base);
      this.store.selectAuthority(this.repositoryId, {
        base: intent.base,
        sourceBase: intent.sourceBase,
        ref: intent.ref,
      });
      this.store.mutation({ ...intent, status: 'completed' });
    });
  }
}
