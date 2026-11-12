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

  private identifiers = new Set<string>();

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
    // Assignment updates name only their assignment, so the readout learns the run's assignment ids
    // from the run itself and filters on the same identifier set the resource query uses. Without
    // this, following a run would show its status changes but silently omit the work inside them.
    if (!this.identifiers.size) await this.identify();
    const events = (await this.request('events', { after: this.cursor })) as EventRow[];
    let written = 0;
    for (const event of events) {
      this.cursor = Math.max(this.cursor, Number(event.sequence));
      if (!this.belongsToRun(event)) continue;
      process.stdout.write(`${JSON.stringify(eventLine(event))}\n`);
      written += 1;
    }
    // Assignments are created after the run starts, so the identifier set must grow with the work.
    // A set gathered once at startup silently filtered out every later assignment event - including
    // the verification failure that ended an in-place run, whose stream showed only the plan.
    if (written) await this.identify();
    return written;
  }

  /** Collects the run and assignment identities that a stream for this run must include. */
  private async identify(): Promise<void> {
    this.identifiers.add(this.runId);
    const view = (await this.request('task-status')) as {
      assignments?: Array<{ id?: string }>;
    };
    for (const assignment of view.assignments ?? [])
      if (typeof assignment.id === 'string') this.identifiers.add(assignment.id);
  }

  /** Prints the run summary as a single JSON object, the shape `--async` reports. */
  summary(run: unknown): void {
    process.stdout.write(`${JSON.stringify(run)}\n`);
  }

  /**
   * True when an event names this run.
   *
   * A store event carries its subject under whichever key its type uses: `id` for run and assignment
   * mutations, `runId` for turn and activity records, `from`/`to` for transitions. Events naming no
   * run - host runtime changes, for instance - describe the machine rather than the work, so they are
   * not part of a run's stream; including them replayed months of unrelated history before the run's
   * first line. The resource query filters the same way, so both paths show the same events.
   */
  private belongsToRun(event: EventRow): boolean {
    const detail = (parse(event.data) ?? {}) as Record<string, unknown>;
    return ['id', 'runId', 'from', 'to'].some(
      (key) => typeof detail[key] === 'string' && this.identifiers.has(detail[key] as string),
    );
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
