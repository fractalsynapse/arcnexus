import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GoalPatch } from './records.js';

/** Render the exact checked content proposal as a unified line diff. */
export function unifiedDiff({ path, before, content }: GoalPatch) {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-goal-diff-'));
  try {
    const files = [before, content].map((text, index) => {
      if (text === null) return '/dev/null';
      const file = join(root, String(index));
      writeFileSync(file, text, { mode: 0o600 });
      return file;
    });
    const diff = spawnSync(
      '/usr/bin/git',
      ['diff', '--no-index', '--no-ext-diff', '--no-textconv', '--no-color', '--', ...files],
      {
        cwd: root,
        encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
      },
    );
    if (diff.status === 0) return '';
    if (diff.status !== 1) throw new Error('Unable to render the goal diff');
    const body = diff.stdout.slice(diff.stdout.indexOf('\n@@'));
    const from = before === null ? '/dev/null' : `a/${path}`;
    const to = content === null ? '/dev/null' : `b/${path}`;
    return `--- ${from}\n+++ ${to}${body.replace(/\n$/, '')}`;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
