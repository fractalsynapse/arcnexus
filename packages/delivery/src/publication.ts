import type { GitHub, PublishedPull } from '../../collaboration/src/index.js';

import type { VerificationIdentity } from '../../verification/src/index.js';

export interface Publication {
  verification?: VerificationIdentity;
  target: string;
  branch: string;
  head: string;
  issue: string;
  candidate: string;
  parent: string;
}

interface PublicationActions {
  provider: Pick<
    GitHub,
    'publication' | 'remoteHead' | 'push' | 'pull' | 'verify' | 'merge' | 'confirm'
  >;
  worktree: string;
  goal: string;
  title?: string;
  validateLocal(): void;
  record(event: Record<string, unknown>): void;
}

/** Inspect the provider before each uncertain effect and keep one path for first runs and retries. */
export async function publish(publication: Publication, actions: PublicationActions) {
  const { provider, record } = actions;
  const { branch, target, head, issue, candidate } = publication;
  const observed = await provider.publication(branch);
  record({ publicationObserved: { branch, pull: observed ?? null } });
  if (observed) {
    verifyPull(publication, observed);
    if (observed.state === 'merged' && observed.commit) {
      await provider.verify(observed.url, head, target, 'MERGED');
      await provider.confirm(observed.commit, candidate, target);
      return { pr: observed.url, commit: observed.commit };
    }
    if (observed.state !== 'open')
      throw new Error(`Retained pull request cannot be resumed: ${observed.url}`);
    if ((await provider.remoteHead(branch)) !== head)
      throw new Error(`Remote publication branch changed: ${branch}`);
  }
  const pr = observed?.url ?? (await open(publication, actions));
  await provider.verify(pr, head, target);
  await currentBase(publication, provider);
  record({ publicationAction: 'merge', pr, head });
  const commit = await provider.merge(pr, head, issue);
  await provider.confirm(commit, candidate, target);
  return { pr, commit };
}

/** Open one PR after observing the exact issue branch and checking the retained base. */
async function open(publication: Publication, actions: PublicationActions) {
  const { provider, goal, worktree, record } = actions;
  const { branch, target, head, issue } = publication;
  const remote = await provider.remoteHead(branch);
  record({ publicationObserved: { branch, head: remote ?? null } });
  if (remote && remote !== head) throw new Error(`Remote publication branch changed: ${branch}`);
  await currentBase(publication, provider);
  if (!remote) {
    actions.validateLocal();
    record({ publicationAction: 'push', branch, head });
    await provider.push(worktree, branch, head);
  }
  record({ publicationAction: 'open', branch, head });
  return provider.pull(
    target,
    branch,
    `chore: ${(actions.title ?? goal).trim().split('\n')[0]!} (#${issue})`,
    `Part of #${issue}.\n\nVerified candidate: ${head}\n\n${goal}`,
  );
}

/** Refuse a PR whose staging target or verified head changed. */
function verifyPull(publication: Publication, pull: PublishedPull) {
  if (pull.head !== publication.head || pull.target !== publication.target)
    throw new Error(`GitHub publication does not match the retained candidate: ${pull.url}`);
}

/** Require the reviewed parent before creating or merging an unmerged publication. */
async function currentBase(publication: Publication, provider: PublicationActions['provider']) {
  if ((await provider.remoteHead(publication.target)) !== publication.parent)
    throw new Error(`The reviewed staging base moved: ${publication.target}`);
}
