type Frame = { run?: number; taskID?: string; observation: unknown };

/** Follow display boundaries without changing the retained journal or its cursors. */
export class AttemptWindow {
  private attempt?: number;
  private failed = false;

  /** Return true when a root run replaces an unsuccessful attempt. */
  advance({ run, taskID, observation }: Frame, execution: string | undefined) {
    if (!execution || taskID !== execution || run === undefined) return false;
    const reset = this.failed && this.attempt !== run;
    this.attempt = run;
    this.failed = (!reset && this.failed) || unsuccessful(observation);
    return reset;
  }

  /** Wait for a known fresh run before showing its observations. */
  includes(expected?: string) {
    return !expected || (this.attempt !== undefined && this.attempt >= Number(expected));
  }
}

function unsuccessful(observation: unknown) {
  const kind = (observation as { outcome?: { kind?: unknown } } | null)?.outcome?.kind;
  return kind === 'failed' || kind === 'cancelled' || kind === 'invalid';
}
