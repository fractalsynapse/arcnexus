import { setTimeout as delay } from 'node:timers/promises';
import { ExecutionResources } from '../../library/execution-runtime/execution-resources.js';
import { InputError } from '../../library/architecture/config.js';
import type { RunMode } from '../../library/coordination-store/execution-types.js';
import type { CliValues } from './arguments.js';

/** Renders task and workday resource queries without creating a host or acquiring execution ownership. */
export class RunQueryCommand {
  /** Retains gateway input and observer cancellation independently of any attached task. */
  constructor(
    private readonly mode: RunMode,
    private readonly positionals: string[],
    private readonly values: CliValues,
    private readonly signal: AbortSignal,
  ) {}

  /** Dispatches a list or an observing resource read through the shared runtime service. */
  async run(): Promise<void> {
    const resources = new ExecutionResources();
    if (this.positionals[1] === 'list') return this.list(resources);
    const input = this.readInput();
    let after = input.after,
      previous = '';
    while (!this.signal.aborted) {
      const result = resources.get(this.mode, input.id, after);
      if (result.revision !== previous || result.events.length) this.render(result);
      previous = result.revision;
      after = result.cursor;
      if (
        !input.follow ||
        ['completed', 'failed', 'cancelled', 'stopped'].includes(result.run.status)
      )
        return;
      await delay(200);
    }
  }

  /** Intersects explicit equality filters and shared search/pagination options. */
  private list(resources: ExecutionResources): void {
    this.options(['json', 'search', 'limit', 'cursor']);
    this.render(
      resources.list(this.mode, {
        filters: this.positionals.slice(2),
        search: this.values.search,
        limit: this.values.limit === undefined ? undefined : Number(this.values.limit),
        cursor: this.values.cursor,
      }),
    );
  }

  /** Validates observer-only options before reading persistence. */
  private readInput() {
    this.options(['json', 'follow', 'after']);
    const follow = this.positionals[1] === 'follow' || this.values.follow === true;
    if (this.positionals.length !== 3 || !this.positionals[2]?.trim())
      throw new InputError('Expected ' + this.mode + ' get <id> [--follow]');
    if (this.values.after !== undefined && (!follow || !/^\d+$/.test(this.values.after)))
      throw new InputError('--after requires following with an exclusive event cursor');
    return { id: this.positionals[2], follow, after: Number(this.values.after ?? 0) };
  }

  /** Rejects unsupported flags instead of silently changing the intended query. */
  private options(allowed: string[]): void {
    if (Object.keys(this.values).some((key) => !allowed.includes(key)))
      throw new InputError('Unsupported run query option');
  }

  /** Keeps rendering outside application services and emits one JSON object per observation. */
  private render(value: unknown): void {
    console.log(JSON.stringify(value, null, this.values.json ? undefined : 2));
  }
}
