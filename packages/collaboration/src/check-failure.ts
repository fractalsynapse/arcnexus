export interface ProviderCheck {
  name?: string;
  context?: string;
  status?: string;
  conclusion?: string;
  state?: string;
  detailsUrl?: string;
}

/** Preserve a pinned failed check and the complete diagnostics exposed by its provider. */
export class GitHubCheckFailure extends Error {
  /** Keep provider facts distinct from a candidate verdict or permission to edit. */
  constructor(
    readonly pr: string,
    readonly head: string,
    readonly check: ProviderCheck,
    readonly log: string,
  ) {
    super(`Required GitHub checks failed: ${pr}`);
  }
}
