import { hostTask, type HostTask } from '../../execution/src/index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';
import type { TaskObserver, TaskOutcome, TaskSession } from '../../workflow/src/index.js';
import { publish, type Publication } from './publication.js';
import { GitHubCheckFailure } from '../../collaboration/src/index.js';
import { PublicationCheckFailure, retainProviderFailure } from './check-failure.js';
import {
  acceptedIdentity,
  currentAcceptance,
  validateRetainedAcceptance,
  type PublicationHistory,
} from './acceptance.js';

export { publish, type Publication } from './publication.js';
export { PublicationCheckFailure } from './check-failure.js';

/** Integrate only the exact candidate accepted by Verification and the provider's gates. */
export async function integrate(
  session: TaskSession,
  candidate: Candidate,
  verdict: Extract<Verdict, { kind: 'accepted' }>,
  signal: AbortSignal,
): Promise<TaskOutcome> {
  signal.throwIfAborted();
  if (candidate.digest !== verdict.candidate)
    throw new Error('Delivery requires an accepting verdict for this candidate');
  const task = hostTask(session);
  const verification = acceptedIdentity(task, candidate, verdict);
  const { branch, issue, head } = task.commit(candidate);
  const publication = {
    target: task.config.base,
    branch,
    issue,
    head,
    candidate: candidate.digest,
    verification,
    parent: task.config.capture.source.revision,
  };
  task.note({ publication });
  return deliver(task, publication, signal);
}

/** Retry the retained publication through normal admission without reactivating stewards. */
export async function resume(
  session: TaskSession,
  signal: AbortSignal,
  progress: TaskObserver['progress'],
): Promise<TaskOutcome | undefined> {
  const task = hostTask(session);
  const retained = task.retainedPublication();
  const stale = task.config.fresh
    ? undefined
    : {
        kind: 'invalid' as const,
        reason: `Task admission requires the current verified ${task.config.base} head`,
        evidence: [],
      };
  if (!retained) return stale;
  const publication = recover(task, retained);
  if (!publication) return undefined;
  try {
    if (await refreshUnmerged(task, publication, signal)) return stale;
  } catch (error) {
    throw retainProviderFailure(task, publication, error);
  }
  progress({
    phase: 'delivery',
    message: `Reconciling retained GitHub publication ${publication.branch}`,
  });
  return deliver(task, publication, signal);
}

/** Observe PR and branch facts before continuing publication or returning to engineering. */
async function refreshUnmerged(task: HostTask, publication: Publication, signal: AbortSignal) {
  const provider = task.provider(signal);
  const pull = await provider.publication(publication.branch);
  task.note({ publicationObserved: { branch: publication.branch, pull: pull ?? null } });
  if (pull && pull.target !== publication.target)
    throw new Error(`GitHub publication target changed: ${pull.url}`);
  const confirmed = task
    .observations<{ confirmed?: string }>()
    .findLast((event) => event.confirmed)?.confirmed;
  const known = [publication.head, confirmed];
  if (pull && !known.includes(pull.head))
    throw new Error(`GitHub publication does not match the retained candidate: ${pull.url}`);
  if (pull && pull.state !== 'open') return false;
  const remote = await provider.remoteHead(publication.branch);
  task.note({ publicationObserved: { branch: publication.branch, head: remote ?? null } });
  if ((pull || remote) && !known.includes(remote))
    throw new Error(`Remote publication branch changed: ${publication.branch}`);
  if (pull && remote !== pull.head)
    throw new Error(`GitHub PR and issue branch conflict: ${pull.url}`);
  return remote && remote !== publication.head
    ? true
    : !currentAcceptance(task, publication.candidate, publication.verification);
}

/** Recover the journaled publication without substituting current acceptance for its history. */
function recover(
  task: HostTask,
  retained: NonNullable<ReturnType<HostTask['retainedPublication']>>,
): Publication | undefined {
  const events = retained.events as PublicationHistory[];
  const publication = events.findLast((event) => event.publication)?.publication;
  if (!publication) return undefined;
  if (
    publication.target !== task.config.base ||
    !/^\d+$/.test(publication.issue) ||
    publication.branch !== `${publication.issue}-task` ||
    ![publication.head, publication.parent, publication.candidate].every((id) =>
      /^[a-f0-9]{40}$/.test(id),
    )
  )
    throw new Error('The retained publication has no matching accepted candidate');
  validateRetainedAcceptance(publication, events);
  return publication;
}

/** Retain provider facts and the verified staging result for this attempt. */
async function deliver(
  task: HostTask,
  publication: Publication,
  signal: AbortSignal,
): Promise<TaskOutcome> {
  const { head, target } = publication;
  const { pr, commit } = await checkedPublication(task, publication, signal);
  task.store('staging-merge.json', JSON.stringify({ pr, head, commit, target }));
  return { kind: 'merged', commit, evidence: [pr, ...task.evidence] };
}

/** Retain complete hosted failure evidence before returning it to the ordinary task loop. */
async function checkedPublication(task: HostTask, publication: Publication, signal: AbortSignal) {
  try {
    return await publish(publication, {
      provider: task.provider(signal),
      worktree: task.capture.source.root,
      goal: task.goal,
      title: task.trackingTitle,
      validateLocal: () =>
        task.validatePublication(
          publication.branch,
          publication.head,
          publication.parent,
          publication.candidate,
        ),
      record: (event) => task.note(event),
    });
  } catch (error) {
    throw recordedFailure(task, publication, error);
  }
}

/** Preserve provider diagnostics without turning them into an engineering verdict. */
function recordedFailure(task: HostTask, publication: Publication, error: unknown) {
  if (!(error instanceof GitHubCheckFailure)) throw retainProviderFailure(task, publication, error);
  const evidence = [task.store('publication-check-failure.log', error.log)];
  task.note({
    publicationCheckFailure: {
      candidate: publication.candidate,
      head: error.head,
      pr: error.pr,
      check: error.check,
      diagnostic: error.message,
      evidence,
    },
  });
  return new PublicationCheckFailure(
    error.message,
    publication.candidate,
    evidence,
    `${publication.candidate}:${error.identity}`,
  );
}
