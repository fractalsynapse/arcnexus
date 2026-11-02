import { Portfolio } from '../../library/portfolio/portfolio.js';
import { loadBindings } from '../../library/architecture/bindings.js';
import { InputError } from '../../library/architecture/config.js';
import { ComponentTesting, testSelectionView } from '../../library/testing/testing.js';

/** Adapts component test requests to the shared selection and execution service. */
export class TestCommand {
  /** Retains literal test filters and cancellation for the shared test service. */
  constructor(
    private readonly positionals: string[],
    private readonly values: Record<string, string | boolean | undefined>,
    private readonly tags: string[],
    private readonly signal: AbortSignal,
  ) {}

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  async run(): Promise<void> {
    const action = this.validate();
    const service = new ComponentTesting();
    const selection = this.selection(service);
    const result = action === 'run' ? await service.run(selection, this.signal) : selection;
    const view =
      'selection' in result
        ? { ...result, selection: testSelectionView(result.selection) }
        : testSelectionView(result);
    console.log(JSON.stringify(view, null, this.values.json ? undefined : 2));
    if ('exitCode' in result) process.exitCode = result.exitCode;
  }

  /** Resolves explicit package context while retaining one temporary repository-selection adapter. */
  private selection(service: ComponentTesting) {
    const project = this.values.project as string | undefined;
    const filters = {
      component:
        (this.values.component as string | undefined) ??
        (project ? this.positionals[2] : undefined),
      level: this.values.level as string | undefined,
      category: this.values.category as string | undefined,
      tags: this.tags,
    };
    const bindings = this.values.bindings
      ? loadBindings(this.values.bindings as string)
      : undefined;
    if (project) return service.inspect(project, filters, bindings);
    const portfolio = new Portfolio();
    try {
      const target = portfolio.packageTarget(this.positionals[2]);
      return service.inspect(target.source, { ...filters, package: target.packageId }, bindings);
    } finally {
      portfolio.close();
    }
  }

  /** Rejects invalid actions and options before resolving captured test selection. */
  private validate(): string {
    const action = this.positionals[1];
    if (!['inspect', 'run'].includes(action ?? '') || this.positionals.length > 3)
      throw new InputError('Expected test inspect|run [package] [--component <id>]');
    if (
      Object.keys(this.values).some(
        (key) =>
          ![
            'project',
            'component',
            'json',
            'level',
            'category',
            'timeout-seconds',
            'bindings',
          ].includes(key),
      )
    )
      throw new InputError('Unsupported test command option');
    if (this.values.project && this.positionals[2] && this.values.component)
      throw new InputError('Cannot combine a legacy positional component with --component');
    return action!;
  }
}
