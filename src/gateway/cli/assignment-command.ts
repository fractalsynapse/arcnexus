import { ArchitectureValidation } from '../../library/architecture/validation.js';
import type { CliValues } from './arguments.js';
import { InputError } from '../../library/architecture/config.js';
import { resolveAssignment, resolveBase } from '../../library/architecture/assignment.js';
import { loadBindings } from '../../library/architecture/bindings.js';

/** Resolves immutable assignments and presents their captured authority. */
export class AssignmentCommand {
  /** Retains parsed assignment arguments for catalog inspection or run dispatch. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly command: string,
  ) {}

  /** Projects captured ownership, contracts and inventories for static validation output. */
  catalog(): void {
    const { values, positionals } = this;
    if (!values.project || positionals.length !== 1)
      throw new InputError('validate requires --project');
    const report = new ArchitectureValidation().validate(
      values.project,
      values.base,
      values.bindings ? loadBindings(values.bindings) : undefined,
    );
    console.log(JSON.stringify(report));
    if (report.status !== 'valid') process.exitCode = 1;
    return;
  }

  /** Resolves captured inputs and rejects unsupported or inconsistent configuration. */
  resolve() {
    const { values, positionals, command } = this;
    const bindings = loadBindings(values.bindings);
    const selection = command === 'inspect' ? resolveBase(values.project!, values.base) : undefined;
    const resolved = selection
      ? resolveAssignment(selection.source, selection.base, positionals[1]!, {
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
        })
      : undefined;
    return { bindings, selection, resolved };
  }
}
