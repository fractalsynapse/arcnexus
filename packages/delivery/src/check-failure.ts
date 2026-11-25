import type { HostTask } from '../../execution/src/index.js';
import {
  GitHubPullReadFailure,
  GitHubReviewRejection,
  type GitHubPullObservation,
} from '../../collaboration/src/index.js';
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
  const source = error instanceof GitHubPullReadFailure ? error.cause : error;
  const failure = source as { stdout?: string | Buffer; stderr?: string | Buffer } | undefined;
  const diagnostic = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const log = [diagnostic, failure?.stdout?.toString(), failure?.stderr?.toString()]
    .filter((text) => text !== undefined)
    .join('\n');
  const evidence = [task.store('publication-provider-failure.log', log)];
  if (error instanceof GitHubPullReadFailure)
    evidence.push(retainProviderObservation(task, error.observation, error.read));
  if (error instanceof GitHubReviewRejection)
    evidence.push(retainProviderObservation(task, error.observation));
  task.note({
    publicationHold: {
      branch: publication.branch,
      head: publication.head,
      candidate: publication.candidate,
      diagnostic,
      evidence,
      requiredAction:
        error instanceof GitHubPullReadFailure
          ? `Obtain the ${error.read} for ${error.observation.pr} and reverify the retained publication before retrying effects`
          : 'Resolve the provider diagnostic and observe PR and issue-branch facts before retrying effects',
    },
  });
  return error;
}

/** Store source-separated provider observations alongside the complete diagnostic. */
export function retainProviderObservation(
  task: HostTask,
  observation: GitHubPullObservation,
  read?: string,
) {
  return task.store(
    'publication-provider-observation.json',
    JSON.stringify({ read, ...observation }, null, 2),
  );
}
