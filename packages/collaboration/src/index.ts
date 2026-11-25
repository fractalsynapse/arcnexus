import { execFile } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';
import { decodeGitHubResponse, retryRead } from './read.js';
import { GitHubCheckFailure, type ProviderCheck } from './check-failure.js';
import { readGitHubChecks } from './github-checks.js';
import {
  GitHubPullReadFailure,
  GitHubReviewRejection,
  publishedPull,
  pullNumber,
  pullReviewQuery,
  reviewDecision,
  type GitHubPullObservation,
  type PublishedPull,
} from './github-pull.js';

export { isTransientReadFailure } from './read.js';
export { verifyBoundCommit } from './repository-read.js';
export { GitHubCheckFailure } from './check-failure.js';
export {
  GitHubPullReadFailure,
  GitHubReviewRejection,
  type GitHubPullObservation,
  type PublishedPull,
} from './github-pull.js';

const run = promisify(execFile);
export type GitHubCredential = (remote: string) => Promise<string>;

/** Use the trusted GitHub CLI for scoped tracking and publication operations. */
export class GitHub {
  readonly repository: string;

  /** Verify the canonical GitHub target before invoking the provider. */
  constructor(
    remote: string,
    private readonly signal: AbortSignal,
    private readonly credential?: GitHubCredential,
  ) {
    const match = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\.git$/.exec(remote);
    if (!match?.[1]) throw new Error('A canonical GitHub repository is required');
    this.repository = match[1];
  }

  /** Create the issue that identifies this admitted task. */
  async issue(goal: string, taskID: string, goalID: string, subject = goal) {
    const marker = `<!-- arcnexus-goal:${goalID} -->
<!-- arcnexus-task:${taskID} -->`;
    const url = await this.command([
      'issue',
      'create',
      '--title',
      title(subject),
      '--body',
      `${goal}

${marker}`,
    ]);
    const issue = /\/issues\/(\d+)$/.exec(url)?.[1];
    if (!issue) throw new Error('GitHub did not return an issue number');
    return issue;
  }

  /** Correlate an uncertain issue creation through the exact hosted task marker. */
  async findIssue(taskID: string, goalID: string): Promise<string | undefined> {
    if (![taskID, goalID].every((id) => /^[a-f0-9]{64}$/.test(id)))
      throw new Error('Invalid goal or task identity');
    const search = encodeURIComponent(`repo:${this.repository} ${goalID} in:body`);
    const issues = await this.pages(
      `search/issues?q=${search}`,
      '.items[]|{number,body}',
      (items) => items as { number: number; body: string }[],
    );
    const actual = issues.filter(({ body }) => body.endsWith(`<!-- arcnexus-task:${taskID} -->`));
    if (actual.length > 1) throw new Error(`Ambiguous GitHub issues for task ${taskID}`);
    return actual[0] && String(actual[0].number);
  }

  /** Confirm the exact recorded issue is still present in the captured repository. */
  async verifyIssue(issue: string) {
    if (!/^\d+$/.test(issue)) throw new Error('Invalid recorded GitHub issue');
    const observed = JSON.parse(
      await this.query(['api', `repos/${this.repository}/issues/${issue}`]),
    );
    if (String(observed.number) !== issue || observed.pull_request)
      throw new Error(`GitHub issue #${issue} could not be verified`);
  }

  /** Create one staging PR after the checked candidate has been pushed. */
  async pull(base: string, head: string, titleText: string, body: string) {
    return this.command([
      'pr',
      'create',
      '--base',
      base,
      '--head',
      head,
      '--title',
      title(titleText),
      '--body',
      body,
    ]);
  }

  /** Find the retained issue branch's PR, including a PR whose merge reply was lost. */
  async publication(branch: string): Promise<PublishedPull | undefined> {
    const owner = this.repository.split('/')[0];
    const head = encodeURIComponent(`${owner}:${branch}`);
    return this.pages(`repos/${this.repository}/pulls?head=${head}&state=all`, '.[]', (matches) => {
      if (matches.length > 1) throw new Error(`Ambiguous GitHub publication for ${branch}`);
      if (matches.length === 0) return undefined;
      return publishedPull(matches[0], this.repository, { branch });
    });
  }

  /** Observe the exact remote ref. An absent ref and an unavailable query are distinct. */
  async remoteHead(branch: string): Promise<string | undefined> {
    const ref = `refs/heads/${branch}`;
    const { stdout } = await run(
      '/usr/bin/git',
      [
        '-c',
        'credential.helper=',
        '-c',
        'credential.helper=!/usr/bin/gh auth git-credential',
        'ls-remote',
        '--heads',
        `https://github.com/${this.repository}.git`,
        ref,
      ],
      {
        signal: this.signal,
        maxBuffer: Infinity,
        env: { ...(await this.environment()), GIT_TERMINAL_PROMPT: '0' },
      },
    );
    return stdout
      .trim()
      .split('\n')
      .map((line) => line.split('\t'))
      .find(([, name]) => name === ref)?.[0];
  }

  /** Verify the merge contains the reviewed tree and remains in the captured staging branch. */
  async confirm(commit: string, tree: string, target: string) {
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid GitHub merge identity');
    const entry = JSON.parse(
      await this.query(['api', `repos/${this.repository}/commits/${commit}`]),
    );
    const comparison = JSON.parse(
      await this.query([
        'api',
        `repos/${this.repository}/compare/${commit}...${encodeURIComponent(target)}`,
      ]),
    );
    if (
      entry.sha !== commit ||
      entry.commit?.tree?.sha !== tree ||
      !['identical', 'ahead'].includes(comparison.status)
    )
      throw new Error('GitHub staging does not contain the reviewed publication tree');
  }

  /** Push only the verified task commit to its captured issue branch. */
  async push(worktree: string, branch: string, head: string, previous = '') {
    if (
      !/^\d+-[\w-]+$/.test(branch) ||
      !/^[a-f0-9]{40}$/.test(head) ||
      (previous && !/^[a-f0-9]{40}$/.test(previous))
    )
      throw new Error('Invalid verified publication identity');
    await run(
      '/usr/bin/git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'credential.helper=',
        '-c',
        'credential.helper=!/usr/bin/gh auth git-credential',
        'push',
        `--force-with-lease=refs/heads/${branch}:${previous}`,
        `https://github.com/${this.repository}.git`,
        `${head}:refs/heads/${branch}`,
      ],
      {
        cwd: worktree,
        signal: this.signal,
        maxBuffer: Infinity,
        env: { ...(await this.environment()), GIT_TERMINAL_PROMPT: '0' },
      },
    );
  }

  /** Observe checks and the configured GitHub review decision on the pinned candidate. */
  async verify(pr: string, head: string, base: string, state = 'OPEN', branch?: string) {
    let earlierChecks: GitHubPullObservation['earlierChecks'];
    for (;;) {
      const evidence: GitHubPullObservation = {
        repository: this.repository,
        pr,
        head,
        earlierChecks,
      };
      const facts = await this.verificationFacts(evidence, base, state, branch);
      const { checks, pendingSuites, review } = facts;
      if (review === 'CHANGES_REQUESTED') throw new GitHubReviewRejection(evidence);
      const failed = checks.find((check) => terminalCheckFailure(check, pendingSuites));
      if (failed) throw await this.failedCheck(failed, evidence);
      if (review !== 'REVIEW_REQUIRED' && successfulChecks(facts)) return;
      recordEarlierChecks(
        evidence,
        evidence.confirmedChecks ? 'CI confirmation' : 'CI checks',
        checks,
      );
      earlierChecks = evidence.earlierChecks;
      await setTimeout(5_000, undefined, { signal: this.signal });
    }
  }

  /** Join head-pinned facts while retaining completed reads for an unavailable provider response. */
  private async verificationFacts(
    evidence: GitHubPullObservation,
    base: string,
    state: string,
    branch?: string,
  ) {
    const current = await this.verificationPull(evidence, base, state, branch, 'pull');
    const initial = await this.checks(evidence, 'checks');
    const review = await this.pullRead('review decision', evidence, () => this.review(current));
    evidence.reviewDecision = review;
    if (
      review === 'CHANGES_REQUESTED' ||
      review === 'REVIEW_REQUIRED' ||
      !successfulChecks(initial)
    )
      return { ...initial, review };

    const confirmed = await this.checks(evidence, 'confirmedChecks');
    const ready = successfulChecks(confirmed);
    if (ready && checkSnapshot(initial.checks) !== checkSnapshot(confirmed.checks))
      throw new GitHubPullReadFailure(
        'CI confirmation',
        evidence,
        new Error('GitHub CI changed during review'),
      );
    if (ready) await this.verificationPull(evidence, base, state, branch, 'confirmedPull');
    return { ...confirmed, review };
  }

  /** Retain the observed PR even when it conflicts with captured publication identity. */
  private verificationPull(
    evidence: GitHubPullObservation,
    base: string,
    state: string,
    branch: string | undefined,
    slot: 'pull' | 'confirmedPull',
  ) {
    const read = slot === 'pull' ? 'PR identity' : 'PR confirmation';
    return this.pullRead(read, evidence, async () => {
      const current = await this.observe(evidence.pr, branch);
      evidence[slot] = current;
      if (
        current.head !== evidence.head ||
        current.target !== base ||
        current.state !== state.toLowerCase()
      )
        throw new Error(`GitHub PR changed before integration: ${evidence.pr}`);
      return current;
    });
  }

  /** Keep both CI snapshots and their partial results when verification cannot proceed. */
  private async checks(evidence: GitHubPullObservation, slot: 'checks' | 'confirmedChecks') {
    const read = slot === 'checks' ? 'CI checks' : 'CI confirmation';
    const snapshot = await this.pullRead(read, evidence, () =>
      readGitHubChecks(
        (args) => this.query(args),
        this.repository,
        evidence.head,
        (partial, beforeReread) => {
          if (beforeReread) recordEarlierChecks(evidence, read, partial);
          else evidence[slot] = partial;
        },
      ),
    );
    evidence[slot] = snapshot.checks;
    evidence.pendingSuites = snapshot.pendingSuites;
    return snapshot;
  }

  /** Preserve complete check diagnostics from the authorized repository's provider job. */
  private async failedCheck(check: ProviderCheck, evidence: GitHubPullObservation) {
    const job = /\/job\/(\d+)/.exec(check.detailsUrl ?? '')?.[1];
    const log = job
      ? await this.pullRead('CI job log', evidence, () =>
          this.query(['api', `repos/${this.repository}/actions/jobs/${job}/logs`], true),
        )
      : JSON.stringify(check, null, 2);
    const observation = evidence.earlierChecks ? evidence : undefined;
    return new GitHubCheckFailure(evidence.pr, evidence.head, check, log, observation);
  }

  /** Request a head-pinned squash merge and verify the resulting provider identity. */
  async merge(pr: string, head: string, issue: string) {
    await this.command([
      'pr',
      'merge',
      pr,
      '--squash',
      '--match-head-commit',
      head,
      '--body',
      `Part of #${issue}.`,
    ]);
    const result = await this.pullRead(
      'merge confirmation',
      { repository: this.repository, pr, head },
      () => this.observe(pr),
    );
    if (result.state !== 'merged' || result.head !== head || !result.commit)
      throw new Error(`GitHub did not confirm the verified merge: ${pr}`);
    return result.commit;
  }

  /** Recognize the canonical PR and retrieve only its publication identity. */
  private async observe(pr: string, branch?: string) {
    const number = pullNumber(pr, this.repository);
    const value = await this.query(['api', `repos/${this.repository}/pulls/${number}`]);
    return decodeGitHubResponse(value, `PR ${number}`, () =>
      publishedPull(JSON.parse(value), this.repository, { branch, number }),
    );
  }

  /** Read the authoritative aggregate review decision without expanding CI contexts. */
  private async review(pr: PublishedPull) {
    const [owner, name] = this.repository.split('/');
    const number = pullNumber(pr.url, this.repository);
    const value = await this.query([
      'api',
      'graphql',
      '-f',
      `query=${pullReviewQuery}`,
      '-f',
      `owner=${owner}`,
      '-f',
      `name=${name}`,
      '-F',
      `number=${number}`,
    ]);
    return decodeGitHubResponse(value, `PR ${number} review`, () =>
      reviewDecision(JSON.parse(value), pr),
    );
  }

  /** Attach the completed observations to a failed read for Delivery to retain. */
  private async pullRead<T>(
    read: string,
    evidence: GitHubPullObservation,
    operation: () => Promise<T>,
  ) {
    try {
      return await operation();
    } catch (cause) {
      if (this.signal.aborted) throw cause;
      throw new GitHubPullReadFailure(read, evidence, cause);
    }
  }

  /** Retry transient failures only at explicit read-only provider call sites. */
  private query(args: string[], complete = false) {
    return retryRead(() => this.command(args, complete), this.signal);
  }

  /** Read every provider page, retaining complete JSON values without a local result-count ceiling. */
  private async pages<T>(endpoint: string, selection: string, decode: (items: unknown[]) => T) {
    const output = await this.query([
      'api',
      endpoint,
      '--paginate',
      '--jq',
      `[${selection}]|tojson`,
    ]);
    return decodeGitHubResponse(output, endpoint, () => {
      const values = output
        .split('\n')
        .filter(Boolean)
        .flatMap((line) => {
          const page: unknown = JSON.parse(line);
          if (!Array.isArray(page)) throw new Error('GitHub returned an invalid page');
          return page as unknown[];
        });
      return decode(values);
    });
  }

  /** Run a scoped provider action without interpolating model content into a shell. */
  private async command(args: string[], complete = false) {
    const scoped = args[0] === 'api' ? args : [...args, '--repo', this.repository];
    const { stdout } = await run('/usr/bin/gh', scoped, {
      signal: this.signal,
      maxBuffer: Infinity,
      env: { ...(await this.environment()), GH_PROMPT_DISABLED: '1' },
    });
    return complete ? stdout : stdout.trim();
  }

  /** Give the scoped token only to the trusted GitHub or Git subprocess. */
  private async environment() {
    if (!this.credential) return process.env;
    const token = await this.credential('https://github.com/' + this.repository + '.git');
    return { ...process.env, GH_TOKEN: token };
  }
}

function successfulChecks(snapshot: Awaited<ReturnType<typeof readGitHubChecks>>) {
  const { checks, pendingSuites } = snapshot;
  return (
    pendingSuites.length === 0 &&
    checks.length > 0 &&
    checks.every(
      ({ status, conclusion, state }) =>
        (status === 'COMPLETED' && conclusion === 'SUCCESS') || state === 'SUCCESS',
    )
  );
}

/** Keep unresolved run associations from turning incomplete reruns into terminal failures. */
function terminalCheckFailure(check: ProviderCheck, pendingSuites: readonly number[]) {
  const { state, status, conclusion, suiteId } = check;
  if (state) return ['ERROR', 'FAILURE'].includes(state);
  const suiteKnown =
    suiteId == null ? pendingSuites.length === 0 : !pendingSuites.includes(suiteId);
  return suiteKnown && status === 'COMPLETED' && conclusion !== 'SUCCESS';
}

/** Retain distinct CI observations even when a later poll is unavailable. */
function recordEarlierChecks(
  evidence: GitHubPullObservation,
  phase: 'CI checks' | 'CI confirmation',
  checks: readonly ProviderCheck[],
) {
  const earlier = (evidence.earlierChecks ??= []);
  const previous = earlier.findLast((item) => item.phase === phase);
  if (!previous || checkSnapshot(previous.checks) !== checkSnapshot(checks))
    earlier.push({ phase, checks });
}

function checkSnapshot(checks: readonly ProviderCheck[]) {
  return checks
    .map((check) => JSON.stringify(check))
    .sort()
    .join('\n');
}

/** Use only the first line of the goal as the provider title. */
function title(goal: string) {
  return goal.trim().split('\n')[0]!;
}

export { managedRepository, type CheckoutGit } from './managed-checkout.js';

export { githubAppReadToken, githubAppPublication } from './github-app-read.js';
