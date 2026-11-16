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
  async issue(goal: string) {
    const url = await this.command(['issue', 'create', '--title', title(goal), '--body', goal]);
    const issue = /\/issues\/(\d+)$/.exec(url)?.[1];
    if (!issue) throw new Error('GitHub did not return an issue number');
    return issue;
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

  /** Push only the verified task commit to its captured issue branch. */
  async push(worktree: string, branch: string, head: string) {
    if (!/^\d+-[\w-]+$/.test(branch) || !/^[a-f0-9]{40}$/.test(head))
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
        `https://github.com/${this.repository}.git`,
        `${head}:refs/heads/${branch}`,
      ],
      { cwd: worktree, signal: this.signal, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
    );
  }

  /** Observe checks and the configured GitHub review decision on the pinned candidate. */
  async verify(pr: string, head: string, base: string) {
    for (;;) {
      const current = await this.observe(pr);
      if (current.headRefOid !== head || current.baseRefName !== base || current.state !== 'OPEN')
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
    const { stdout } = await run('/usr/bin/gh', [...args, '--repo', this.repository], {
      signal: this.signal,
      env: { ...process.env, GH_PROMPT_DISABLED: '1' },
    });
    return stdout.trim();
  }
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
