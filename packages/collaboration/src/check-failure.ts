import { createHash } from 'node:crypto';

export interface ProviderCheck {
  runId?: number;
  appId?: number;
  name?: string;
  context?: string;
  status?: string;
  conclusion?: string;
  state?: string;
  detailsUrl?: string;
}

/** Preserve a pinned failed check and the complete diagnostics exposed by its provider. */
export class GitHubCheckFailure extends Error {
  readonly identity: string;

  /** Keep provider facts distinct from a candidate verdict or permission to edit. */
  constructor(
    readonly pr: string,
    readonly head: string,
    readonly check: ProviderCheck,
    readonly log: string,
  ) {
    super(`Required GitHub checks failed: ${pr}`);
    this.identity = createHash('sha256')
      .update(JSON.stringify([pr, head, check, log]))
      .digest('hex');
  }
}
