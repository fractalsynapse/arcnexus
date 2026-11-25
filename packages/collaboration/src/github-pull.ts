import { z } from 'zod';
import type { ProviderCheck } from './check-failure.js';

const commit = z.string().regex(/^[a-f0-9]{40}$/);
const repositoryName = z.object({ full_name: z.string() });
const pullRef = z.object({ ref: z.string().min(1), repo: repositoryName });
const pull = z.object({
  html_url: z.string(),
  number: z.int().positive(),
  head: pullRef.extend({ sha: commit }),
  base: pullRef,
  state: z.enum(['open', 'closed']),
  merged_at: z.string().min(1).nullable(),
  merge_commit_sha: commit.nullable(),
});
const reviewEnvelope = z.object({
  errors: z.array(z.unknown()).length(0).optional(),
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
        headRefOid: commit,
        baseRefName: z.string(),
        reviewDecision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED']).nullable(),
      }),
    }),
  }),
});

export interface PublishedPull {
  url: string;
  head: string;
  target: string;
  state: 'open' | 'closed' | 'merged';
  commit: string | null;
}

export const pullReviewQuery = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { state headRefOid baseRefName reviewDecision }
  }
}`;

/** Bind a provider read to a canonical pull request inside the configured repository. */
export function pullNumber(pr: string, repository: string) {
  const prefix = `https://github.com/${repository}/pull/`;
  const number = pr.startsWith(prefix) && pr.slice(prefix.length);
  if (!number || !/^[1-9]\d*$/.test(number) || !Number.isSafeInteger(Number(number)))
    throw new Error(`Invalid GitHub pull request for ${repository}: ${pr}`);
  return Number(number);
}

/** Share identity validation between branch discovery and the direct pull read. */
export function publishedPull(
  value: unknown,
  repository: string,
  expected: { branch?: string; number?: number },
): PublishedPull {
  const result = pull.parse(value);
  if (
    pullNumber(result.html_url, repository) !== result.number ||
    result.head.repo.full_name !== repository ||
    result.base.repo.full_name !== repository ||
    (expected.branch !== undefined && result.head.ref !== expected.branch) ||
    (expected.number !== undefined && result.number !== expected.number) ||
    (result.merged_at !== null && result.state !== 'closed')
  )
    throw new Error(
      `GitHub returned a pull request outside the publication scope: ${result.html_url}`,
    );
  return {
    url: result.html_url,
    head: result.head.sha,
    target: result.base.ref,
    state: result.merged_at ? 'merged' : result.state,
    commit: result.merged_at ? result.merge_commit_sha : null,
  };
}

/** Require an explicit review decision tied to the same PR state, base and head. */
export function reviewDecision(value: unknown, pr: PublishedPull) {
  const review = reviewEnvelope.parse(value).data.repository.pullRequest;
  if (
    review.state.toLowerCase() !== pr.state ||
    review.headRefOid !== pr.head ||
    review.baseRefName !== pr.target
  )
    throw new Error(`GitHub PR changed during review observation: ${pr.url}`);
  return review.reviewDecision;
}

export interface GitHubPullObservation {
  repository: string;
  pr: string;
  head: string;
  pull?: PublishedPull;
  checks?: readonly ProviderCheck[];
}

/** Preserve completed provider facts with the exact unavailable read. */
export class GitHubPullReadFailure extends Error {
  /** Name the unavailable read while retaining its diagnostics and completed facts. */
  constructor(
    readonly read: string,
    readonly observation: GitHubPullObservation,
    cause: unknown,
  ) {
    const diagnostic = cause instanceof Error ? cause.message : String(cause);
    super(
      `GitHub ${read} unavailable for ${observation.pr} at ${observation.head}: ${diagnostic}`,
      {
        cause,
      },
    );
  }
}
