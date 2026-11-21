import type { HostTask } from '../../execution/src/index.js';
import type { Publication } from './publication.js';

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

/** Preserve full provider diagnostics and the reconciliation action without asserting absence. */
export function retainProviderFailure(task: HostTask, publication: Publication, error: unknown) {
  const failure = error as { stdout?: string | Buffer; stderr?: string | Buffer } | undefined;
  const diagnostic = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const log = [diagnostic, failure?.stdout?.toString(), failure?.stderr?.toString()]
    .filter((text) => text !== undefined)
    .join('\n');
  const evidence = [task.store('publication-provider-failure.log', log)];
  task.note({
    publicationHold: {
      branch: publication.branch,
      head: publication.head,
      candidate: publication.candidate,
      diagnostic,
      evidence,
      requiredAction:
        'Resolve the provider diagnostic and observe PR and issue-branch facts before retrying effects',
    },
  });
  return error;
}
