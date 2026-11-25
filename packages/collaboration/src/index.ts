import { execFile } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';
import { decodeGitHubResponse, retryRead } from './read.js';
import { GitHubCheckFailure, type ProviderCheck } from './check-failure.js';
import { readGitHubChecks } from './github-checks.js';
import {
  confirmationChanged,
  failedSuiteDiagnostic,
  recordEarlierChecks,
  recordPolledChecks,
  requireRetainedSuites,
  successfulChecks,
  type ProviderCISnapshot,
} from './github-ci-coverage.js';
import {
  GitHubPullReadFailure,
  GitHubReviewRejection,
  publishedPull,
  pullNumber,
  pullReviewQuery,
  reviewDecision,
  type GitHubPullObservation,
  type GitHubVerificationObserver,
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

interface VerificationTarget {
  base: string;
  state: string;
  branch?: string;
}

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

  /** Verify the pinned candidate and report the complete observation before delivery proceeds. */
  async verify(
    pr: string,
    head: string,
    base: string,
    state = 'OPEN',
    branch?: string,
    observe?: GitHubVerificationObserver,
  ) {
    const pinned = { repository: this.repository, pr, head };
    const target = { base, state, branch };
    let earlierChecks: GitHubPullObservation['earlierChecks'];
    let previous: ProviderCISnapshot | undefined;
    for (;;) {
      const evidence: GitHubPullObservation = { ...pinned, earlierChecks };
      const attempt = await this.verificationAttempt(evidence, target, previous, observe);
      if (attempt.ready) return observe?.(evidence, 'verified');
      previous = attempt.snapshot;
      if (recordPolledChecks(evidence)) observe?.(evidence, 'pending');
      earlierChecks = evidence.earlierChecks;
      await setTimeout(5_000, undefined, { signal: this.signal });
    }
  }

  /** Decide from fresh provider facts and retain partial facts when an in-flight read is cancelled. */
  private async verificationAttempt(
    evidence: GitHubPullObservation,
    target: VerificationTarget,
    previous: ProviderCISnapshot | undefined,
    observe?: GitHubVerificationObserver,
  ) {
    try {
      const facts = await this.verificationFacts(evidence, target, previous);
      const { failed, review, suites } = facts;
      if (review === 'CHANGES_REQUESTED') throw new GitHubReviewRejection(evidence);
      if (failed) throw await this.failedCheck(failed, evidence);
      if (facts.confirmationChanged)
        throw new GitHubPullReadFailure(
          'CI confirmation',
          evidence,
          new Error('GitHub CI changed during review'),
        );
      return {
        ready: facts.reviewCurrent,
        snapshot: { checks: facts.observedChecks, suites },
      };
    } catch (error) {
      if (this.signal.aborted && evidence.pull) observe?.(evidence, 'pending');
      throw error;
    }
  }

  /** Join head-pinned facts while retaining completed reads for an unavailable provider response. */
  private async verificationFacts(
    evidence: GitHubPullObservation,
    target: VerificationTarget,
    previous?: ProviderCISnapshot,
  ) {
    const current = await this.verificationPull(evidence, target, 'pull');
    const initial = await this.checks(evidence, 'checks', previous);
    const review = await this.pullRead('review decision', evidence, () => this.review(current));
    evidence.reviewDecision = review;
    if (
      review === 'CHANGES_REQUESTED' ||
      review === 'REVIEW_REQUIRED' ||
      initial.failed ||
      !successfulChecks(initial)
    )
      return { ...initial, review, reviewCurrent: false, confirmationChanged: false };

    const confirmed = await this.confirmCI(evidence, target, initial);
    return { ...confirmed, review };
  }

  /** Confirm the same CI scope after review or require fresh review after observed CI progress. */
  private async confirmCI(
    evidence: GitHubPullObservation,
    target: VerificationTarget,
    initial: Awaited<ReturnType<typeof readGitHubChecks>>,
  ) {
    const confirmed = await this.checks(evidence, 'confirmedChecks', {
      checks: initial.observedChecks,
      suites: initial.suites,
    });
    const ready = successfulChecks(confirmed);
    const changed = confirmationChanged(initial, confirmed, ready);
    const reviewCurrent =
      ready && !confirmed.failed && !changed && confirmed.progress.suites.size === 0;
    if (reviewCurrent) await this.verificationPull(evidence, target, 'confirmedPull');
    return { ...confirmed, reviewCurrent, confirmationChanged: changed };
  }

  /** Retain the observed PR even when it conflicts with captured publication identity. */
  private verificationPull(
    evidence: GitHubPullObservation,
    { base, state, branch }: VerificationTarget,
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
  private checks(
    evidence: GitHubPullObservation,
    slot: 'checks' | 'confirmedChecks',
    prior?: ProviderCISnapshot,
  ) {
    const read = slot === 'checks' ? 'CI checks' : 'CI confirmation';
    const suites = slot === 'checks' ? 'suites' : 'confirmedSuites';
    const observedChecks = slot === 'checks' ? 'observedChecks' : 'confirmedObservedChecks';
    return this.pullRead(read, evidence, () =>
      readGitHubChecks(
        (args) => this.query(args),
        this.repository,
        evidence.head,
        {
          checks: (observed) => {
            evidence[slot] = observed;
          },
          observedChecks: (observed) => {
            evidence[observedChecks] = observed;
          },
          suites: (observed, phase) => {
            evidence[suites] = observed;
            if (phase === 'initial') requireRetainedSuites(observed, prior);
          },
          earlier: (checks, suites) => recordEarlierChecks(evidence, read, { checks, suites }),
        },
        prior?.checks,
      ),
    );
  }

  /** Preserve complete check diagnostics from the authorized repository's provider job. */
  private async failedCheck(check: ProviderCheck, evidence: GitHubPullObservation) {
    const job = /\/job\/(\d+)/.exec(check.detailsUrl ?? '')?.[1];
    const suite = failedSuiteDiagnostic(evidence, check);
    const log = job
      ? await this.pullRead('CI job log', evidence, () =>
          this.query(['api', `repos/${this.repository}/actions/jobs/${job}/logs`], true),
        )
      : JSON.stringify(suite ?? check, null, 2);
    return new GitHubCheckFailure(evidence.pr, evidence.head, check, log, evidence);
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

/** Use only the first line of the goal as the provider title. */
function title(goal: string) {
  return goal.trim().split('\n')[0]!;
}

export { managedRepository, type CheckoutGit } from './managed-checkout.js';

export { githubAppReadToken, githubAppPublication } from './github-app-read.js';
