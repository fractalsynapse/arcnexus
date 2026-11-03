import { ancestry, componentContext, loadCatalog } from './components.js';
import { loadProjectBindings, type Bindings } from './bindings.js';
import { InputError } from './config.js';

const activities = ['research', 'document', 'design', 'implement', 'review', 'release'];

export interface InspectionRequest {
  source: string;
  revision: string;
  packageId: string;
  componentId: string;
  prompt?: string;
  activity?: string;
}

/** Presents revision-bound architectural context without creating execution authority or accepted work. */
export class ArchitectureInspection {
  /** Validates package scope and projects the same captured catalog used by engineering. */
  inspect(request: InspectionRequest, bindings?: Bindings) {
    this.validate(request);
    const { source, revision, packageId, componentId } = request;
    const catalog = loadCatalog(source, revision, bindings ?? loadProjectBindings(source));
    const context = ancestry(catalog, componentId);
    if (!context.some((component) => component.type === 'package' && component.id === packageId))
      throw new InputError('Inspection component is outside the selected package');
    const component = context.at(-1)!;
    return {
      revision,
      packageId,
      componentId,
      context: context.map(componentContext),
      policy: component.policy,
      publicApi: component.publicApi ?? [],
      imports: component.observedImports ?? [],
      consumers: component.observedConsumers ?? [],
      operations: component.operations ?? {},
      ...(request.activity ? { activity: request.activity } : {}),
      ...(request.prompt !== undefined
        ? {
            preview: {
              prompt: request.prompt,
              activity: request.activity ?? 'implement',
              requiresPlanning: true,
            },
          }
        : {}),
    };
  }

  /** Rejects empty explicit inputs and unsupported activities before loading source. */
  private validate(request: InspectionRequest): void {
    for (const key of ['source', 'revision', 'packageId', 'componentId', 'prompt'] as const)
      if (request[key] !== undefined && !request[key]!.trim())
        throw new InputError('Empty inspection input: ' + key);
    if (request.activity !== undefined && !activities.includes(request.activity))
      throw new InputError('Unsupported inspection activity: ' + request.activity);
  }
}
