import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Creates local configuration objects through a private Git index without touching caller files or hooks. */
export class ConfigurationCommit {
  /** Captures the source repository for fixed Git plumbing operations. */
  constructor(private readonly source: string) {}

  /** Replaces one existing regular definition and retains its mode in a parented configuration commit. */
  create(base: string, change: { path: string; text: string }): string {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-configuration-'));
    const index = join(directory, 'index');
    try {
      const mode = this.git(['ls-tree', base, '--', change.path]).split(' ')[0]!;
      if (!['100644', '100755'].includes(mode)) throw new Error('Definition is not a regular file');
      this.git(['read-tree', base], undefined, index);
      const blob = this.git(['hash-object', '-w', '--stdin'], change.text);
      this.git(['update-index', '--cacheinfo', mode, blob, change.path], undefined, index);
      const tree = this.git(['write-tree'], undefined, index);
      if (tree === this.git(['rev-parse', base + '^{tree}'])) return base;
      const commit = this.git(
        ['commit-tree', tree, '-p', base],
        'Update architectural definition\n',
      );
      this.git(['update-ref', 'refs/arcnexus/configuration-candidates/' + commit, commit]);
      return commit;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  /** Reads an optional exact application ref without conflating missing refs and Git failures. */
  ref(name: string): string {
    const value = this.git(['for-each-ref', '--format=%(objectname) %(symref)', name]);
    const [revision, symbolic] = value.split(' ');
    if (symbolic) throw new Error('Configuration branch is symbolic; reconcile retained authority');
    return revision ?? '';
  }

  /** Applies the journaled compare-and-swap transition; a conflicting branch remains untouched. */
  select(ref: string, base: string, previous: string): void {
    this.git(['update-ref', '--no-deref', ref, base, previous || '0'.repeat(base.length)]);
  }

  /** Executes fixed local plumbing with isolated index and identity; ambient Git overrides cannot redirect writes. */
  private git(args: string[], input?: string, index?: string): string {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
    );
    const result = spawnSync(
      'git',
      ['-C', this.source, '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args],
      {
        input,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        env: {
          ...env,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
          GIT_AUTHOR_NAME: 'ArcNexus',
          GIT_COMMITTER_NAME: 'ArcNexus',
          GIT_AUTHOR_EMAIL: 'configuration@arcnexus.invalid',
          GIT_COMMITTER_EMAIL: 'configuration@arcnexus.invalid',
          ...(index ? { GIT_INDEX_FILE: index } : {}),
        },
      },
    );
    if (result.error || result.status !== 0)
      throw new Error(result.error?.message ?? result.stderr);
    return result.stdout.trim();
  }
}
