import { ComponentResources } from '../../library/architecture/inspection.js';
import { InputError } from '../../library/architecture/config.js';
import { Portfolio } from '../../library/portfolio/portfolio.js';
import type { CliValues } from './arguments.js';

/** Adapts component reads to shared services without starting an execution host. */
export class ComponentCommand {
  /** Retains command input without opening a writable resource store. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
  ) {}

  /** Resolves registered targets from any directory and closes the read-only portfolio on failure too. */
  run(): void {
    this.validate();
    const portfolio = new Portfolio();
    try {
      const target = portfolio.packageTarget(this.positionals[2]);
      const service = new ComponentResources();
      const result =
        this.positionals[1] === 'get'
          ? service.get(target, this.positionals[3]!)
          : service.list(target, {
              filters: this.positionals.slice(3),
              search: this.values.search,
              cursor: this.values.cursor,
              limit: this.values.limit === undefined ? undefined : Number(this.values.limit),
            });
      console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
    } finally {
      portfolio.close();
    }
  }

  /** Rejects unsupported actions, positional shapes and options before opening resources. */
  private validate(): void {
    const action = this.positionals[1];
    if (
      !['list', 'get'].includes(action ?? '') ||
      !this.positionals[2]?.trim() ||
      (action === 'get' && this.positionals.length !== 4)
    )
      throw new InputError(
        'Expected component list <package> [field=value...] | get <package> <id>',
      );
    const allowed = action === 'list' ? ['json', 'search', 'limit', 'cursor'] : ['json'];
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported component resource option');
  }
}
