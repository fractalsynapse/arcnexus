import {
  definitionPath,
  operationApplicability,
  type Capture,
  type OperationBinding,
  type ParameterValue,
  type OperationParameter,
} from './catalog.js';

/** Identify a configured use without copying or renaming its authored operation definition. */
export function operationID(binding: string | OperationBinding) {
  return typeof binding === 'string' ? binding : binding.operation;
}

/** Resolve defaults and explicitly authored configuration without granting invocation overrides. */
export function resolveOperation(
  capture: Pick<Capture, 'components' | 'operations'>,
  id: string,
  owner?: string,
  activity?: string,
) {
  return new OperationResolution(capture, id, owner, activity).resolve();
}

/** Assemble one operation binding while retaining the authored source of every resolved parameter. */
class OperationResolution {
  private readonly values: Record<string, ParameterValue> = Object.create(null);
  private readonly sources: Record<string, string> = Object.create(null);
  private readonly operation: Capture['operations'][string];

  /** Bind an existing declaration and optional captured component/activity configuration. */
  constructor(
    private readonly capture: Pick<Capture, 'components' | 'operations'>,
    private readonly id: string,
    private readonly owner?: string,
    private readonly activity?: string,
  ) {
    const operation = Object.hasOwn(capture.operations, id) && capture.operations[id];
    if (!operation) throw new Error(`Unknown operation: ${id}`);
    if (operation.applicability && !operationApplicability.includes(operation.applicability))
      throw new Error(`Operation ${id}: unknown applicability ${operation.applicability}`);
    this.operation = operation;
  }

  /** Resolve configuration, validate values and expand argument tokens through one canonical path. */
  resolve() {
    const parameters = this.operation.parameters ?? {};
    for (const [name, parameter] of Object.entries(parameters)) {
      if (parameter.default === undefined) continue;
      this.values[name] = parameter.default;
      this.sources[name] = `${definitionPath('operations', this.id)} (parameters.${name}.default)`;
    }
    this.configure();
    for (const [name, parameter] of Object.entries(parameters))
      validateValue(this.id, name, parameter, this.values[name]);
    const args = (this.operation.args ?? []).flatMap((argument) =>
      resolveArgument(this.id, argument, this.values, this.owner),
    );
    return {
      ...this.operation,
      args,
      parameterValues: this.values,
      parameterSources: this.sources,
    };
  }

  /** Apply component configuration first and then the explicitly selected activity binding. */
  private configure() {
    const component = this.owner ? this.capture.components[this.owner] : undefined;
    const mapping = this.activity ? component?.activities[this.activity] : undefined;
    const binding = mapping?.operations.find((entry) => operationID(entry) === this.id);
    const source = this.owner ? definitionPath('components', this.owner) : '';
    this.override(
      component?.operationParameters?.[this.id],
      `${source} (operationParameters.${this.id})`,
    );
    if (binding && typeof binding !== 'string')
      this.override(
        binding.parameters,
        `${source} (activities.${this.activity}.operations.${this.id})`,
      );
  }

  /** Refuse undeclared configuration keys and preserve the highest-priority value and provenance. */
  private override(values: Record<string, ParameterValue> | undefined, source: string) {
    for (const [name, value] of Object.entries(values ?? {})) {
      if (!Object.hasOwn(this.operation.parameters ?? {}, name))
        throw new Error(`Operation ${this.id}: unknown parameter ${name}`);
      this.values[name] = value;
      this.sources[name] = `${source}.${name}`;
    }
  }
}

/** Validate the declared value domain without content, collection, time or numeric resource ceilings. */
function validateValue(id: string, name: string, parameter: OperationParameter, value: unknown) {
  const valid =
    parameter.type === 'array'
      ? parameter.items?.type === 'string' &&
        Array.isArray(value) &&
        value.every((entry) => typeof entry === 'string')
      : typeof value === parameter.type;
  if (!valid) throw new Error(`Operation ${id}: parameter ${name} requires ${parameter.type}`);
}

/** Expand typed argument tokens as argv data; host-owned identity never comes from an activity override. */
function resolveArgument(
  id: string,
  argument: NonNullable<Capture['operations'][string]['args']>[number],
  values: Record<string, ParameterValue>,
  owner?: string,
): string[] {
  if (typeof argument === 'string') return [argument];
  if ('context' in argument) {
    if (argument.context === 'owner' && owner) return [owner];
    throw new Error(`Unresolved operation argument: ${id}`);
  }
  if (!Object.hasOwn(values, argument.parameter))
    throw new Error(`Operation ${id}: unresolved parameter ${argument.parameter}`);
  const value = values[argument.parameter];
  return Array.isArray(value) ? [...value] : [String(value)];
}
