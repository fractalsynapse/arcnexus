import { execFile } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Use the trusted GitHub CLI for scoped tracking and publication operations. */
export class GitHub {
  readonly repository: string;

  /** Verify the canonical GitHub target before invoking the provider. */
  constructor(
    remote: string,
    private readonly signal: AbortSignal,
  ) {
    const match = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\.git$/.exec(remote);
    if (!match?.[1]) throw new Error('A canonical GitHub repository is required');
    this.repository = match[1];
  }

  /** Create the issue that identifies this admitted task. */
  async issue(goal: string, taskID: string, goalID: string) {
    const marker = `<!-- arcnexus-goal:${goalID} -->
<!-- arcnexus-task:${taskID} -->`;
    const url = await this.command([
      'issue',
      'create',
      '--title',
      title(goal),
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
    const raw = await this.command([
      'issue',
      'list',
      '--state',
      'all',
      '--search',
      `${goalID} in:body`,
      '--limit',
      '100',
      '--json',
      'number,body',
    ]);
    const issues = JSON.parse(raw) as { number: number; body: string }[];
    const actual = issues.filter(({ body }) => body.endsWith(`<!-- arcnexus-task:${taskID} -->`));
    if (actual.length > 1) throw new Error(`Ambiguous GitHub issues for task ${taskID}`);
    return actual[0] && String(actual[0].number);
  }

  /** Confirm the exact recorded issue is still present in the captured repository. */
  async verifyIssue(issue: string) {
    if (!/^\d+$/.test(issue)) throw new Error('Invalid recorded GitHub issue');
    const observed = JSON.parse(
      await this.command(['api', `repos/${this.repository}/issues/${issue}`]),
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
    const matches: ProviderPull[] = JSON.parse(
      await this.command([
        'api',
        `repos/${this.repository}/pulls?head=${head}&state=all&per_page=100`,
      ]),
    );
    if (matches.length > 1) throw new Error(`Ambiguous GitHub publication for ${branch}`);
    const match = matches[0];
    if (!match) return undefined;
    if (
      match.head.repo?.full_name !== this.repository ||
      match.head.ref !== branch ||
      match.base.repo?.full_name !== this.repository
    )
      throw new Error(`GitHub returned a pull request outside the publication scope: ${branch}`);
    return {
      url: match.html_url,
      head: match.head.sha,
      target: match.base.ref,
      state: match.merged_at ? 'merged' : match.state,
      commit: match.merge_commit_sha,
    };
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
      { signal: this.signal, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
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
      await this.command(['api', `repos/${this.repository}/commits/${commit}`]),
    );
    const comparison = JSON.parse(
      await this.command([
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
      { cwd: worktree, signal: this.signal, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
    );
  }

  /** Observe checks and the configured GitHub review decision on the pinned candidate. */
  async verify(pr: string, head: string, base: string, state = 'OPEN') {
    for (;;) {
      const current = await this.observe(pr);
      if (current.headRefOid !== head || current.baseRefName !== base || current.state !== state)
        throw new Error(`GitHub PR changed before integration: ${pr}`);
      if (current.reviewDecision === 'CHANGES_REQUESTED')
        throw new Error(`GitHub review requested changes: ${pr}`);
      const checks = current.statusCheckRollup;
      const failed = checks.find(
        ({ status, conclusion, state }) =>
          (status === 'COMPLETED' && conclusion !== 'SUCCESS') ||
          ['ERROR', 'FAILURE'].includes(state ?? ''),
      );
      if (failed) throw new Error(`Required GitHub checks failed: ${pr}`);
      if (
        checks.length &&
        current.reviewDecision !== 'REVIEW_REQUIRED' &&
        checks.every(({ conclusion, state }) => conclusion === 'SUCCESS' || state === 'SUCCESS')
      )
        return;
      await setTimeout(5_000, undefined, { signal: this.signal });
    }
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
    const result = await this.observe(pr);
    if (result.state !== 'MERGED' || result.headRefOid !== head || !result.mergeCommit?.oid)
      throw new Error(`GitHub did not confirm the verified merge: ${pr}`);
    return result.mergeCommit.oid;
  }

  /** Read provider facts rather than trusting local push or merge command completion. */
  private async observe(pr: string): Promise<Pull> {
    return JSON.parse(
      await this.command([
        'pr',
        'view',
        pr,
        '--json',
        'state,headRefOid,baseRefName,reviewDecision,mergeCommit,statusCheckRollup',
      ]),
    );
  }

  /** Run a scoped provider action without interpolating model content into a shell. */
  private async command(args: string[]) {
    const scoped = args[0] === 'api' ? args : [...args, '--repo', this.repository];
    const { stdout } = await run('/usr/bin/gh', scoped, {
      signal: this.signal,
      env: { ...process.env, GH_PROMPT_DISABLED: '1' },
    });
    return stdout.trim();
  }
}

export interface PublishedPull {
  url: string;
  head: string;
  target: string;
  state: 'open' | 'closed' | 'merged';
  commit: string | null;
}

interface ProviderPull {
  html_url: string;
  head: { ref: string; sha: string; repo?: { full_name: string } };
  base: { ref: string; repo?: { full_name: string } };
  state: 'open' | 'closed';
  merged_at: string | null;
  merge_commit_sha: string | null;
}

interface Pull {
  state: string;
  headRefOid: string;
  baseRefName: string;
  reviewDecision: string;
  mergeCommit?: { oid: string };
  statusCheckRollup: { status?: string; conclusion?: string; state?: string }[];
}

/** Use only the first line of the goal as the provider title. */
function title(goal: string) {
  return goal.trim().split('\n')[0]!.slice(0, 118);
}
