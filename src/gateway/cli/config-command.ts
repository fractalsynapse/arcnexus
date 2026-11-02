import { ApplicationSettings } from '../../library/portfolio/portfolio.js';
import { ConfigurationMigration } from '../../library/architecture/migration.js';
import { InputError } from '../../library/architecture/config.js';

/** Adapts the minimal maintenance interface to validated architecture migration. */
export class ConfigCommand {
  /** Retains parsed input without accepting caller-authored execution or permission overrides. */
  constructor(
    private readonly positionals: string[],
    private readonly values: Record<string, string | boolean | undefined>,
  ) {}

  /** Prints a reviewable diff by default; explicit write applies only the fully validated change set. */
  run(): void {
    if (['get', 'update'].includes(this.positionals[1] ?? '')) return this.settings();
    if (
      this.positionals.length !== 2 ||
      this.positionals[1] !== 'migrate' ||
      Object.keys(this.values).some((key) => key !== 'write')
    )
      throw new InputError('Use config migrate or config migrate --write');
    const result = new ConfigurationMigration(process.cwd()).run(this.values.write === true);
    if (!result.changes) return console.log('No configuration changes');
    console.log(result.diff);
    console.log(
      `${result.applied ? 'Applied' : 'Previewed'} ${result.changes} configuration changes`,
    );
    console.log('Migration evidence: ' + result.evidence);
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
