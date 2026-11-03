import { architectureFields } from './architecture-fields.js';
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
    const [kind, action] = this.positionals;
    if (kind !== 'platform' && kind !== 'package') throw new InputError('Invalid portfolio kind');
    const allowed = action === 'list' ? ['json', 'search', 'limit', 'cursor'] : ['json'];
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported portfolio option');
    const service = new Portfolio(undefined, ['create', 'remove', 'update'].includes(action ?? ''));
    try {
      const result = await this.dispatch(service, kind);
      console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
    } finally {
      service.close();
    }
  }

  /** Dispatches validated command shapes while leaving persistence lifetime with the gateway. */
  private dispatch(service: Portfolio, kind: 'platform' | 'package') {
    const [, action, id, repository] = this.positionals;
    if (action === 'list' && this.positionals.length <= (kind === 'package' ? 3 : 2))
      return service.list(kind, id, {
        search: this.values.search,
        cursor: this.values.cursor,
        limit: this.values.limit === undefined ? undefined : Number(this.values.limit),
      });
    if (action === 'get' && id && this.positionals.length === 3) return service.get(kind, id);
    if (action === 'create' && id && repository && this.positionals.length === 4)
      return service.create(kind, id, repository, this.signal);
    if (action === 'update' && id && this.positionals.length >= 4)
      return service.update(kind, id, architectureFields(this.positionals.slice(3)));
    if (action === 'remove' && id && this.positionals.length === 3) return service.remove(kind, id);
    throw new InputError(
      'Expected ' + kind + ' list|get|create <id> <repository>|update <id> <field=value>...|remove',
    );
  }
}
