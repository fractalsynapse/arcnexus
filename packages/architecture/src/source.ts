import { execFileSync } from 'node:child_process';
import type { GuidanceSource } from '../../manager/src/index.js';

export interface ProjectSource extends GuidanceSource {
  readonly root: string;
  readonly revision: string;
  readonly remote: string;
  readonly files?: readonly string[];
  fileHistory?(path: string): FileHistory;
  fileDates?(directory: string): ReadonlyMap<string, string>;
}

interface FileHistory {
  revisions: readonly { revision: string; updated: string }[];
  read(revision: string): string;
}

/** Open a fixed Git tree without consulting the worktree or contacting the remote. */
export function openProject(directory: string, requested = 'HEAD'): ProjectSource {
  const root = git(directory, 'rev-parse', '--show-toplevel').trim();
  const revision = git(
    root,
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${requested}^{commit}`,
  ).trim();
  const remote = git(root, 'config', '--get', 'remote.origin.url').trim();
  const entries = git(root, 'ls-tree', '-rz', revision).split('\0').filter(Boolean);
  const paths = Object.freeze(entries.map((entry) => entry.slice(entry.indexOf('\t') + 1)));
  const files = Object.freeze(
    paths.filter((_, index) => /^100(?:644|755) blob /.test(entries[index]!)),
  );
  const byPath = new Set(paths);
  return Object.freeze({
    root,
    revision,
    remote,
    paths,
    files,
    ...capturedFiles(root, revision, byPath),
  });
}

/** Read the last change for each path in a collection with one Git command. */
function capturedFileDates(root: string, revision: string, directory: string) {
  const args = ['--format=%x1f%cI', '--diff-filter=AMRT', '--name-only', '-z'];
  const records = git(root, '--literal-pathspecs', 'log', ...args, revision, '--', directory);
  let date = '';
  const dates = new Map<string, string>();
  for (const record of records.split('\0')) {
    if (record.startsWith('\x1f')) date = record.slice(1);
    else if (record && date) {
      const path = record.replace(/^\n/, '');
      if (!dates.has(path)) dates.set(path, date);
    }
  }
  return dates;
}

/** Read only the file revisions reachable from this captured tree. */
function capturedHistory(root: string, capture: string, path: string): FileHistory {
  const revisions = git(
    root,
    '--literal-pathspecs',
    'log',
    '--diff-filter=AMRT',
    '--format=%H%x09%cI',
    capture,
    '--',
    path,
  )
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [revision, updated] = line.split('\t') as [string, string];
      return { revision, updated };
    });
  return {
    revisions,
    read(revision) {
      if (!revisions.some((entry) => entry.revision === revision))
        throw new Error('File revision unavailable at the captured revision');
      return git(root, 'show', `${revision}:${path}`);
    },
  };
}

/** Run a local read and expose failures without leaking command output or credentials. */
function git(directory: string, ...args: string[]): string {
  try {
    return execFileSync('/usr/bin/git', ['--no-replace-objects', ...args], {
      cwd: directory,
      encoding: 'utf8',
      maxBuffer: Infinity,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: '/usr/bin:/bin',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
      },
    });
  } catch {
    throw new Error(`Cannot read Git project (${args[0]} ${args[1] ?? ''}) from ${directory}`);
  }
}

function capturedFiles(root: string, revision: string, byPath: ReadonlySet<string>) {
  return {
    /** Read an exact repository-relative path from the captured commit. */
    read(path: string) {
      if (!byPath.has(path)) throw new Error(`Missing from captured project: ${path}`);
      return git(root, 'show', `${revision}:${path}`);
    },
    fileHistory(path: string) {
      if (!byPath.has(path)) throw new Error(`Missing from captured project: ${path}`);
      return capturedHistory(root, revision, path);
    },
    fileDates: (directory: string) => capturedFileDates(root, revision, directory),
  };
}
