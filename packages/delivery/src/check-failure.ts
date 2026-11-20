/** Return new provider evidence to Workflow without editing an accepted candidate. */
export class PublicationCheckFailure extends Error {
  /** Preserve the exact candidate and complete retained failure artifacts. */
  constructor(
    message: string,
    readonly candidate: string,
    readonly evidence: readonly string[],
    readonly identity: string,
  ) {
    super(message);
  }
}
