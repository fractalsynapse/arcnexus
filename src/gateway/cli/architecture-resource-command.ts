import { architectureFields } from './architecture-fields.js';
import { ComponentResources, StandardResources } from '../../library/architecture/inspection.js';
import { InputError } from '../../library/architecture/config.js';
import { Portfolio } from '../../library/portfolio/portfolio.js';
import type { CliValues } from './arguments.js';

/** Adapts architectural reads and updates using common argument validation and portfolio lifetime. */
export class ArchitectureResourceCommand {
  /** Retains parsed inputs without opening storage or acquiring execution ownership. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
  ) {}

  /** Resolves registered resources independently of the caller's directory and always closes storage. */
  run(): void {
    this.validate();
    const portfolio = new Portfolio(
      undefined,
      ['update', 'create', 'remove'].includes(this.positionals[1]!),
    );
    try {
      console.log(JSON.stringify(this.dispatch(portfolio), null, this.values.json ? undefined : 2));
    } finally {
      portfolio.close();
    }
  }

  /** Routes validated reads and architectural mutations to their shared application services. */
  private dispatch(portfolio: Portfolio) {
    if (['update', 'create', 'remove'].includes(this.positionals[1]!))
      return this.mutate(portfolio);
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

  /** Delegates explicit mutations to the same application-owned configuration transaction path. */
  private mutate(portfolio: Portfolio) {
    const [kind, action, target, id] = this.positionals;
    if (kind === 'standard')
      return portfolio.changeStandard(
        target!,
        id!,
        action as 'create' | 'update' | 'remove',
        action === 'remove' ? {} : architectureFields(this.positionals.slice(4)),
      );
    if (action === 'remove') return portfolio.removeComponent(target!, id!);
    const fields = architectureFields(this.positionals.slice(4));
    return action === 'create'
      ? portfolio.createComponent(target!, id!, fields)
      : portfolio.updateComponent(target!, id!, fields);
  }

  /** Rejects unsupported actions, positional shapes and options before reading resources. */
  private validate(): void {
    const [kind, action, target] = this.positionals;
    if (
      !['standard', 'component'].includes(kind ?? '') ||
      !['list', 'get', 'update', 'create', 'remove'].includes(action ?? '') ||
      !target?.trim() ||
      (['get', 'remove'].includes(action!) && this.positionals.length !== 4) ||
      (['update', 'create'].includes(action!) && this.positionals.length < 5)
    )
      throw new InputError(
        'Expected component/standard list <target> [field=value...] | get <target> <id> | create/update <target> <id> <field=value>... | remove <target> <id>',
      );
    const allowed = action === 'list' ? ['json', 'search', 'limit', 'cursor'] : ['json'];
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported architectural resource option');
  }
}
