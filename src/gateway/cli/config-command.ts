import { ApplicationSettings } from '../../library/portfolio/portfolio.js';
import { InputError } from '../../library/architecture/config.js';

/** Reads and writes machine settings; configuration version migration no longer exists. */
export class ConfigCommand {
  /** Retains parsed input without accepting caller-authored execution or permission overrides. */
  constructor(
    private readonly positionals: string[],
    private readonly values: Record<string, string | boolean | undefined>,
  ) {}

  /** Routes settings access and rejects the retired migration surface outright. */
  run(): void {
    if (['get', 'update'].includes(this.positionals[1] ?? '')) return this.settings();
    throw new InputError('config migrate is retired; configuration carries no version to upgrade');
  }

  /** Reads or updates machine settings without mutating component definitions. */
  private settings(): void {
    const [, action, name, value] = this.positionals;
    if (
      !name ||
      this.positionals.length !== (action === 'get' ? 3 : 4) ||
      Object.keys(this.values).some((key) => key !== 'json')
    )
      throw new InputError('Expected config get <name> or config update <name> <value>');
    const settings = new ApplicationSettings();
    console.log(
      JSON.stringify(action === 'get' ? settings.get(name) : settings.update(name, value!)),
    );
  }
}
