import { Portfolio } from '../../library/portfolio/portfolio.js';
import { InputError } from '../../library/architecture/config.js';
import type { CliValues } from './arguments.js';

/** Adapts portfolio commands to shared services without binding resource lookup to the current directory. */
export class PortfolioCommand {
  /** Retains parsed arguments without opening persistence or acquiring execution ownership. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly signal: AbortSignal,
  ) {}

  /** Opens read-only services for queries and guarantees database closure on every result. */
  async run(): Promise<void> {
    const [kind, action, id, repository] = this.positionals;
    if (kind !== 'platform' && kind !== 'package') throw new InputError('Invalid portfolio kind');
    const allowed = action === 'list' ? ['json', 'search', 'limit', 'cursor'] : ['json'];
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported portfolio option');
    const service = new Portfolio(undefined, action === 'create' || action === 'remove');
    try {
      let result;
      if (action === 'list' && this.positionals.length <= (kind === 'package' ? 3 : 2))
        result = service.list(kind, id, {
          search: this.values.search,
          cursor: this.values.cursor,
          limit: this.values.limit === undefined ? undefined : Number(this.values.limit),
        });
      else if (action === 'get' && id && this.positionals.length === 3)
        result = service.get(kind, id);
      else if (action === 'create' && id && repository && this.positionals.length === 4)
        result = await service.create(kind, id, repository, this.signal);
      else if (action === 'remove' && id && this.positionals.length === 3)
        result = service.remove(kind, id);
      else throw new InputError('Expected ' + kind + ' list|get|create <id> <repository>|remove');
      console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
    } finally {
      service.close();
    }
  }
}
