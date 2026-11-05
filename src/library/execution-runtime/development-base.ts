import type { ProjectExecution } from '../architecture/execution-context.js';
import { githubBranchHead } from '../operations/github-upstream.js';
import { git } from '../operations/process.js';
import { PublicationPolicy } from '../publisher/publisher.js';
import { runDestination } from './run-destination.js';

/** Observes the environment's actual integration ref before creating a steward development branch. */
export async function developmentBase(
  context: ProjectExecution,
  mode: 'live' | 'simulation' | undefined,
  candidate: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  const policy = new PublicationPolicy().resolve(context);
  if (!policy) return undefined;
  const branch = policy.operation.targetBranch;
  const ref = 'refs/heads/' + branch;
  git(context.source, 'check-ref-format', ref);
  const origin = context.bindings.materializations?.[context.catalog.primaryRepository!]?.origin;
  if (mode === 'simulation' && !origin) throw new Error('Missing simulated development repository');
  const head =
    mode === 'simulation'
      ? isolatedHead(origin!, ref)
      : await githubBranchHead(runDestination(context, 'live'), branch, signal);
  const unseen = (from: string, target: string) =>
    git(context.source, 'rev-list', '--max-count=1', from, '--not', target).trim();
  if (unseen(context.base, head) || unseen(head, candidate))
    throw new Error(
      `Reconcile retained candidate and authority against ${ref} at ${head} before dispatch`,
    );
  return head;
}

/** Reports a missing simulated target without substituting a checkout or stale tracking ref. */
function isolatedHead(origin: string, ref: string): string {
  const heads = git(origin, 'for-each-ref', '--format=%(refname) %(objectname)', ref);
  const head = heads
    .split('\n')
    .find((line) => line.startsWith(ref + ' '))
    ?.split(' ')[1];
  if (!head)
    throw new Error(
      `Missing simulated development branch target ${ref}; inspect environment setup`,
    );
  return head;
}
