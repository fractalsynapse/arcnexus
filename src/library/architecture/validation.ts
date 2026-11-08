import { GuidanceValidator } from '../guidance-validation/guidance.js';
import { resolveBase } from './assignment.js';
import { catalogView } from './catalog-view.js';
import { loadCatalog } from './components.js';
import { ContractRegistry } from './contracts.js';
import type { Bindings } from './bindings.js';

/** Combines captured architectural validation and current tracked guidance without starting execution. */
export class ArchitectureValidation {
  /** Reports guidance findings separately; invalid architectural inputs retain their preflight errors. */
  validate(project: string, revision?: string, bindings?: Bindings) {
    const { source, base } = resolveBase(project, revision);
    const catalog = loadCatalog(source, base, bindings);
    const guidance = new GuidanceValidator().validate(source);
    const contracts = this.contracts(source, base);
    const invalid = guidance.status === 'invalid' || contracts.status === 'invalid';
    return {
      base,
      ...catalogView(catalog),
      guidance,
      contracts,
      status: invalid ? 'invalid' : 'valid',
    };
  }

  /**
   * Recomputes every recorded contract digest at the validated revision.
   *
   * A locked contract whose bytes differ from the registry record, a locked record without
   * acceptance, an unknown stage or a missing file each become stable findings. A project that
   * declares no registry reports zero records and stays valid.
   */
  private contracts(source: string, base: string) {
    const registry = ContractRegistry.atRevision(source, base);
    const findings = registry.integrityFindings((path) =>
      ContractRegistry.readAtRevision(source, base, path),
    );
    return {
      declared: registry.declared,
      records: registry.records.length,
      findings,
      status: findings.length ? 'invalid' : 'valid',
    } as const;
  }
}
