import { ConfigurationReader } from '../../library/architecture/configuration.js';
import {
  PromptExperimentResolver,
  resolveExperiment,
} from '../../library/experiments/experiment-config.js';
import { InputError } from '../../library/architecture/config.js';
import type { CliValues } from './arguments.js';

/** Preserves read-only historical campaign inspection without exposing scripted execution. */
export class ExperimentCommand {
  /** Retains historical input paths without starting processes or opening an execution host. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly signal: AbortSignal,
  ) {}

  /** Rejects retired execution before reading manifests; inspection retains original evidence vocabulary. */
  async run(): Promise<void> {
    this.signal.throwIfAborted();
    if (this.positionals[1] === 'run')
      throw new InputError(
        'Experiment execution is retired. Use test inspect/run --component experiments for scripted acceptance; use task run "<prompt>" --simulate or workday start --simulate for real-agent simulation.',
      );
    if (
      this.positionals.length !== 3 ||
      this.positionals[1] !== 'inspect' ||
      !this.values.bindings ||
      Object.keys(this.values).some((key) => !['bindings', 'json'].includes(key))
    )
      throw new InputError('Historical experiment inspect requires manifest and --bindings');
    const definition = new ConfigurationReader().file(this.positionals[2]!).value as {
      schemaVersion?: number;
    };
    try {
      const input =
        definition.schemaVersion === 3
          ? new PromptExperimentResolver().resolve(this.positionals[2]!, this.values.bindings)
          : resolveExperiment(this.positionals[2]!, this.values.bindings);
      console.log(JSON.stringify(input, null, this.values.json ? undefined : 2));
    } catch (error) {
      throw new InputError(String(error));
    }
  }
}
