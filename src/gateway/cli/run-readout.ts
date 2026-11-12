/**
 * The one run readout: JSONL events while a run is followed, one summary object otherwise.
 *
 * Every stance - goal, plan, addressed component, fan-out - streams through this renderer, because
 * a preview that disagrees with the run it describes is worse than no preview: the operator would be
 * reading a claim about authority the agent does not have. Depth follows the stance by reading the
 * same stored event sequence the report is built from, rather than a second projection of it, so the
 * difference between stances is how far the run went, not how differently it is printed.
 */
export class RunReadout {
  private cursor = 0;

  /** Binds the readout to a request function so it works for any host transport. */
  constructor(
    private readonly request: (action: string, extra?: Record<string, unknown>) => Promise<unknown>,
    private readonly runId: string,
    after = 0,
  ) {
    this.cursor = after;
  }

  /** Prints each new event as one JSON object per line; returns how many lines were written. */
  async poll(): Promise<number> {
    const events = (await this.request('events', { after: this.cursor })) as EventRow[];
    let written = 0;
    for (const event of events) {
      this.cursor = Math.max(this.cursor, Number(event.sequence));
      if (!this.belongsToRun(event)) continue;
      process.stdout.write(`${JSON.stringify(eventLine(event))}\n`);
      written += 1;
    }
    return written;
  }

  /** Prints the run summary as a single JSON object, the shape `--async` reports. */
  summary(run: unknown): void {
    process.stdout.write(`${JSON.stringify(run)}\n`);
  }

  /**
   * True when an event names this run, or names no run at all and so describes its environment.
   *
   * A store event carries the subject under whichever key its type uses: `id` for run and assignment
   * mutations, `runId` for turn and activity records, `from`/`to` for transitions. The resource layer
   * already filters on that set, so the streaming readout matches it rather than inventing a second
   * rule that would show one command events the other withholds.
   */
  private belongsToRun(event: EventRow): boolean {
    const detail = (parse(event.data) ?? {}) as Record<string, unknown>;
    const names = ['id', 'runId', 'from', 'to']
      .map((key) => detail[key])
      .filter((value): value is string => typeof value === 'string');
    return names.length === 0 || names.includes(this.runId);
  }
}

/**
 * One stored event, as the coordination store returns it (payload as text) or as the resource layer
 * hands it over (payload already parsed). Both feed the same line so both readouts are identical.
 */
export interface EventRow {
  sequence: number;
  type: string;
  data: string | Record<string, unknown>;
  observed_at?: string;
}

/** Reads an event payload without letting one malformed row end the stream. */
function parse(value: string | Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** One stored event as the readout emits it; the same shape is used by every following command. */
export function eventLine(event: EventRow): Record<string, unknown> {
  const detail = parse(event.data);
  return {
    sequence: Number(event.sequence),
    type: event.type,
    ...(event.observed_at ? { at: event.observed_at } : {}),
    ...((detail as Record<string, unknown>) ?? {}),
  };
}
