import { DeliveryResources } from '../../library/publisher/publisher.js';
import { ExecutionContext } from '../../library/architecture/execution-context.js';
import { Portfolio } from '../../library/portfolio/portfolio.js';
import { InputError } from '../../library/architecture/config.js';
import type { CliValues } from './arguments.js';

/** Adapts delivery inspection, exact-revision authorization and host-queued publication to the terminal. */
export class DeliveryCommand {
  /** Retains parsed arguments without starting hosts or creating execution state for read commands. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly signal: AbortSignal,
  ) {}

  /** Delegates mutations to application services and exposes structured revision-bearing resource results. */
  async run(): Promise<void> {
    const action = this.positionals[1];
    if (action === 'list') return this.list();
    if (!['get', 'approve'].includes(action ?? '') || this.positionals.length !== 3)
      throw new InputError('Expected delivery list [package] | get|approve <id>');
    this.options(['json']);
    const resources = new DeliveryResources();
    const delivery = resources.get(this.positionals[2]!);
    if (action === 'approve') return this.render(resources.approve(delivery.id, delivery.revision));
    this.render(delivery);
  }

  /** Applies optional package selection and common query controls without launching an execution host. */
  private list(): void {
    this.options(['json', 'search', 'limit', 'cursor']);
    if (this.positionals.length > 3) throw new InputError('Expected delivery list [package]');
    const portfolio = new Portfolio();
    try {
      const target = this.positionals[2] ? portfolio.packageTarget(this.positionals[2]) : undefined;
      const context =
        target && new ExecutionContext().resolve(target.source, target.packageId, target.base);
      this.render(
        new DeliveryResources().list(
          {
            search: this.values.search,
            cursor: this.values.cursor,
            limit: this.values.limit === undefined ? undefined : Number(this.values.limit),
          },
          context ? { projectId: context.key, packageId: context.packageId } : undefined,
        ),
      );
    } finally {
      portfolio.close();
    }
  }

  /** Rejects irrelevant options rather than silently altering publication intent. */
  private options(allowed: string[]): void {
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported delivery option');
  }

  /** Uses the same machine-readable result for terminal rendering and future gateway consumers. */
  private render(result: unknown): void {
    console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
  }
}
