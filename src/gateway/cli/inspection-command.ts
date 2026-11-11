import type { Mode } from '../../library/architecture/modes.js';
import { ArchitectureInspection } from '../../library/architecture/inspection.js';
import { InputError } from '../../library/architecture/config.js';
import { Portfolio } from '../../library/portfolio/portfolio.js';
import type { CliValues } from './arguments.js';

/** Adapts registered package inspection to the shared read-only architecture service. */
export class InspectionCommand {
  /** Retains parsed input without starting a host or opening writable persistence. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
  ) {}

  /** Resolves one explicit target and renders context without accepting an engineering assignment. */
  run(): void {
    if (this.positionals.length < 3 || this.positionals.length > 4)
      throw new InputError('Expected inspect <package> <component> [prompt]');
    if (Object.keys(this.values).some((key) => !['json', 'activity', 'mode'].includes(key)))
      throw new InputError('Unsupported package inspection option');
    const portfolio = new Portfolio();
    try {
      const target = portfolio.packageTarget(this.positionals[1]);
      const result = new ArchitectureInspection().inspect({
        source: target.source,
        revision: target.base,
        packageId: target.packageId,
        componentId: this.positionals[2]!,
        prompt: this.positionals[3],
        activity: this.values.activity,
        ...(this.values.mode ? { mode: this.values.mode as Mode } : {}),
      });
      if (this.values.json) console.log(JSON.stringify(result));
      else
        console.log(`${result.frame}\n\nDeclared operations: ${JSON.stringify(result.operations)}`);
    } finally {
      portfolio.close();
    }
  }
}
