import { Portfolio } from '../../library/portfolio/portfolio.js';
import { ArchitectureValidation } from '../../library/architecture/validation.js';
import type { CliValues } from './arguments.js';
import { InputError } from '../../library/architecture/config.js';
import { resolveAssignment, resolveBase } from '../../library/architecture/assignment.js';
import { loadBindings, loadProjectBindings } from '../../library/architecture/bindings.js';

/** Resolves immutable assignments and presents their captured authority. */
export class AssignmentCommand {
  /** Retains parsed assignment arguments for read-only validation or context inspection. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
  ) {}

  /** Projects captured ownership, contracts and inventories for static validation output. */
  catalog(): void {
    const { values, positionals } = this;
    if (positionals.length > 2 || (positionals[1] && values.project))
      throw new InputError('Use validate [package] or validate --project <repository>');
    if (Object.keys(values).some((key) => !['json', 'project', 'base', 'bindings'].includes(key)))
      throw new InputError('Unsupported validation option');
    const report = positionals[1]
      ? this.registeredValidation(positionals[1])
      : new ArchitectureValidation().validate(
          values.project ?? process.cwd(),
          values.base,
          values.bindings ? loadBindings(values.bindings) : undefined,
        );
    console.log(JSON.stringify(report));
    if (report.status !== 'valid') process.exitCode = 1;
    return;
  }

  /** Closes the read-only registry even when selection or source validation fails. */
  private registeredValidation(reference: string) {
    if (this.values.base || this.values.bindings)
      throw new InputError('Registered validation uses the selected source and its bindings');
    const portfolio = new Portfolio();
    try {
      return portfolio.validate(reference);
    } finally {
      portfolio.close();
    }
  }

  /** Resolves captured inputs and rejects unsupported or inconsistent configuration. */
  resolve() {
    const { values, positionals } = this;
    const { source, base } = resolveBase(values.project!, values.base);
    const bindings = values.bindings ? loadBindings(values.bindings) : loadProjectBindings(source);
    return resolveAssignment(source, base, positionals[1]!, {
      objective: positionals[2],
      bindings,
      file: values.assignment,
      kind: values.kind,
      compositionProfile: values['composition-profile'],
      executionProfile: values['execution-profile'],
      model: values.model,
      initializerModel: values['initializer-model'],
      timeoutSeconds:
        values['timeout-seconds'] === undefined ? undefined : Number(values['timeout-seconds']),
    });
  }
}
