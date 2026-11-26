type Frame = { run?: number; taskID?: string; observation: unknown };

/** Follow display boundaries without changing the retained journal or its cursors. */
export class AttemptWindow {
  private attempt?: number;
  private completed = false;

  /** Return true when a root run follows a completed attempt. */
  advance({ run, taskID, observation }: Frame, execution: string | undefined) {
    if (!execution || taskID !== execution || run === undefined) return false;
    const reset = this.completed && this.attempt !== run;
    this.attempt = run;
    this.completed = (!reset && this.completed) || completedOutcome(observation);
    return reset;
  }

  /** Wait for a known fresh run before showing its observations. */
  includes(expected?: string) {
    return !expected || (this.attempt !== undefined && this.attempt >= Number(expected));
  }
}

function completedOutcome(observation: unknown) {
  const kind = (observation as { outcome?: { kind?: unknown } } | null)?.outcome?.kind;
  // A blocked attempt can resume an approval with the same report and evidence.
  return typeof kind === 'string' && kind !== 'blocked';
}
