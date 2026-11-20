import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hostTask, type HostTask } from '../../execution/src/index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';
import type { TaskObserver, TaskOutcome, TaskSession } from '../../workflow/src/index.js';
import { publish, type Publication } from './publication.js';

export { publish, type Publication } from './publication.js';

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
  const { branch, issue, head } = task.commit(candidate);
  const publication = {
    target: task.config.base,
    branch,
    issue,
    head,
    candidate: candidate.digest,
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
  if (!retained) {
    if (!task.config.fresh)
      return {
        kind: 'invalid',
        reason: `Task admission requires the current verified ${task.config.base} head`,
        evidence: [],
      };
    return undefined;
  }
  const publication = recover(task, retained);
  if (!publication) return undefined;
  progress({
    phase: 'delivery',
    message: `Reconciling retained GitHub publication ${publication.branch}`,
  });
  return deliver(task, publication, signal);
}

/** Validate the original acceptance and adapt the publication artifact used before journaling. */
function recover(
  task: HostTask,
  retained: NonNullable<ReturnType<HostTask['retainedPublication']>>,
): Publication | undefined {
  const events = retained.events as {
    publication?: Publication;
    candidate?: Candidate;
    verdict?: Verdict;
  }[];
  const saved = events.findLast((event) => event.publication)?.publication;
  const publication = saved ?? legacy(task, dirname(retained.worktree));
  if (!publication) return undefined;
  const accepted = events.findLast((event) => event.verdict?.kind === 'accepted');
  if (
    accepted?.candidate?.digest !== publication.candidate ||
    accepted?.verdict?.kind !== 'accepted' ||
    accepted.verdict.candidate !== publication.candidate ||
    publication.target !== task.config.base ||
    !/^\d+$/.test(publication.issue) ||
    publication.branch !== `${publication.issue}-task` ||
    ![publication.head, publication.parent, publication.candidate].every((id) =>
      /^[a-f0-9]{40}$/.test(id),
    )
  )
    throw new Error('The retained publication has no matching accepted candidate');
  return publication;
}

/** Read former runtime evidence without changing the retained run. */
function legacy(task: HostTask, directory: string): Publication | undefined {
  if (!existsSync(directory)) return undefined;
  const files = readdirSync(directory).filter((name) => /^\d+-publication\.json$/.test(name));
  if (files.length !== 1) return undefined;
  const record = JSON.parse(readFileSync(join(directory, files[0]!), 'utf8'));
  return { ...record, parent: task.publicationParent(record.head) };
}

/** Retain provider facts and the verified staging result for this attempt. */
async function deliver(
  task: HostTask,
  publication: Publication,
  signal: AbortSignal,
): Promise<TaskOutcome> {
  const { branch, head, parent, candidate, target } = publication;
  const { pr, commit } = await publish(publication, {
    provider: task.provider(signal),
    worktree: task.capture.source.root,
    goal: task.goal,
    title: task.trackingTitle,
    validateLocal: () => task.validatePublication(branch, head, parent, candidate),
    record: (event) => task.note(event),
  });
  task.store('staging-merge.json', JSON.stringify({ pr, head, commit, target }));
  return { kind: 'merged', commit, evidence: [pr, ...task.evidence] };
}
