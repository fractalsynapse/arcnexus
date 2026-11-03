import { ComponentResources, StandardResources } from '../../library/architecture/inspection.js';
import { InputError } from '../../library/architecture/config.js';
import { Portfolio } from '../../library/portfolio/portfolio.js';
import type { CliValues } from './arguments.js';

/** Adapts architectural resource reads using common argument validation and portfolio lifetime. */
export class ArchitectureResourceCommand {
  /** Retains parsed inputs without opening storage or acquiring execution ownership. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
  ) {}

  /** Resolves registered resources independently of the caller's directory and always closes storage. */
  run(): void {
    this.validate();
    const portfolio = new Portfolio();
    try {
      console.log(JSON.stringify(this.read(portfolio), null, this.values.json ? undefined : 2));
    } finally {
      portfolio.close();
    }
  }

  /** Delegates scope and projection decisions to the corresponding shared application service. */
  private read(portfolio: Portfolio) {
    const query = {
      filters: this.positionals.slice(3),
      search: this.values.search,
      cursor: this.values.cursor,
      limit: this.values.limit === undefined ? undefined : Number(this.values.limit),
    };
    if (this.positionals[0] === 'standard') {
      const { source, base, id } = portfolio.get('platform', this.positionals[2]!);
      const target = { source, base, platformId: id };
      const service = new StandardResources();
      return this.positionals[1] === 'get'
        ? service.get(target, this.positionals[3]!)
        : service.list(target, query);
    }
    const target = portfolio.packageTarget(this.positionals[2]);
    const service = new ComponentResources();
    return this.positionals[1] === 'get'
      ? service.get(target, this.positionals[3]!)
      : service.list(target, query);
  }

  /** Rejects unsupported actions, positional shapes and options before reading resources. */
  private validate(): void {
    const [kind, action, target] = this.positionals;
    if (
      !['standard', 'component'].includes(kind ?? '') ||
      !['list', 'get'].includes(action ?? '') ||
      !target?.trim() ||
      (action === 'get' && this.positionals.length !== 4)
    )
      throw new InputError(
        'Expected component/standard list <target> [field=value...] | get <target> <id>',
      );
    const allowed = action === 'list' ? ['json', 'search', 'limit', 'cursor'] : ['json'];
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported architectural resource option');
  }
}
