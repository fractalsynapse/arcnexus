import { Portfolio } from '../../library/portfolio/portfolio.js';
import { InputError } from '../../library/architecture/config.js';
import type { CliValues } from './arguments.js';

/** Adapts portfolio commands to shared services without binding resource lookup to the current directory. */
export class PortfolioCommand {
  /** Retains parsed arguments without opening persistence or acquiring execution ownership. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
  ) {}

  /** Opens read-only services for queries and guarantees database closure on every result. */
  run(): void {
    const [kind, action, id, repository] = this.positionals;
    if (kind !== 'platform' && kind !== 'package') throw new InputError('Invalid portfolio kind');
    if (Object.keys(this.values).some((key) => key !== 'json'))
      throw new InputError('Unsupported portfolio option');
    const service = new Portfolio(undefined, action === 'create' || action === 'remove');
    try {
      let result;
      if (action === 'list' && this.positionals.length <= (kind === 'package' ? 3 : 2))
        result = service.list(kind, id);
      else if (action === 'get' && id && this.positionals.length === 3)
        result = service.get(kind, id);
      else if (action === 'create' && id && repository && this.positionals.length === 4)
        result = service.register(kind, id, repository);
      else if (action === 'remove' && id && this.positionals.length === 3)
        result = service.remove(kind, id);
      else throw new InputError('Expected ' + kind + ' list|get|create <id> <repository>|remove');
      console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
    } finally {
      service.close();
    }
  }
}
