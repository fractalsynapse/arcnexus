import { GuidanceValidator } from '../guidance-validation/guidance.js';
import { resolveBase } from './assignment.js';
import { catalogView } from './catalog-view.js';
import { loadCatalog } from './components.js';
import type { Bindings } from './bindings.js';

/** Combines captured architectural validation and current tracked guidance without starting execution. */
export class ArchitectureValidation {
  /** Reports guidance findings separately; invalid architectural inputs retain their preflight errors. */
  validate(project: string, revision?: string, bindings?: Bindings) {
    const { source, base } = resolveBase(project, revision);
    const catalog = loadCatalog(source, base, bindings);
    const guidance = new GuidanceValidator().validate(source);
    return { base, ...catalogView(catalog), guidance, status: guidance.status };
  }
}
