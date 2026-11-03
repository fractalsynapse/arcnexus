import { setTimeout as delay } from 'node:timers/promises';
import { WorkspacePreparation, WorkspaceResources } from '../../library/workspace/workspace.js';
import { Portfolio } from '../../library/portfolio/portfolio.js';
import { InputError } from '../../library/architecture/config.js';
import type { CliValues } from './arguments.js';

/** Renders workspace queries independently of the current checkout and execution-host lifecycle. */
export class WorkspaceQueryCommand {
  /** Keeps terminal observation cancellation separate from assignment cancellation. */
  constructor(
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly signal: AbortSignal,
  ) {}

  /** Routes resource reads and captured preparation through their shared application services. */
  async run(): Promise<void> {
    if (this.positionals[1] === 'list') return this.list();
    if (this.positionals[1] === 'prepare') return this.prepare();
    const input = this.input(),
      resources = new WorkspaceResources();
    let after = input.after,
      previous = '';
    while (!this.signal.aborted) {
      const result = resources.get(input.id, after);
      if (result.revision !== previous || result.events.length) this.render(result);
      previous = result.revision;
      after = result.cursor;
      if (!this.values.follow || result.finalized) return;
      await delay(200);
    }
  }

  /** Resolves registered authority before invoking preparation and maps its retained terminal outcome. */
  private async prepare(): Promise<void> {
    this.options(['json']);
    if (this.positionals.length !== 3) throw new InputError('Expected workspace prepare <package>');
    const portfolio = new Portfolio();
    try {
      const target = portfolio.packageTarget(this.positionals[2]);
      const result = await new WorkspacePreparation().prepare(target, this.signal);
      this.render(result);
      process.exitCode =
        result.workspace.status === 'prepared'
          ? 0
          : result.workspace.status === 'cancelled'
            ? 130
            : 1;
    } finally {
      portfolio.close();
    }
  }

  /** Resolves optional package context without registering it or starting execution. */
  private list(): void {
    this.options(['json', 'search', 'limit', 'cursor']);
    if (this.positionals.length > 3) throw new InputError('Expected workspace list [package]');
    const portfolio = new Portfolio();
    try {
      const target = this.positionals[2] ? portfolio.packageTarget(this.positionals[2]) : undefined;
      this.render(
        new WorkspaceResources().list(target, {
          search: this.values.search,
          cursor: this.values.cursor,
          limit: this.values.limit === undefined ? undefined : Number(this.values.limit),
        }),
      );
    } finally {
      portfolio.close();
    }
  }

  /** Validates read identity and event-following cursor before accessing retained evidence. */
  private input() {
    this.options(['json', 'follow', 'after']);
    if (this.positionals[1] !== 'get' || this.positionals.length !== 3)
      throw new InputError('Expected workspace list [package] | get <id> [--follow]');
    if (
      this.values.after !== undefined &&
      (!this.values.follow || !/^\d+$/.test(this.values.after))
    )
      throw new InputError('--after requires following with an exclusive event cursor');
    return { id: this.positionals[2]!, after: Number(this.values.after ?? 0) };
  }

  /** Rejects irrelevant options so queries cannot silently grant or change execution authority. */
  private options(allowed: string[]): void {
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported workspace query option');
  }

  /** Emits structured service results without exposing raw execution records. */
  private render(result: unknown): void {
    console.log(JSON.stringify(result, null, this.values.json ? undefined : 2));
  }
}
