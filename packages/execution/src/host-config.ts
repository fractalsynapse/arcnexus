import { accessSync, constants, existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { parse } from 'yaml';
import type { Capture } from '../../architecture/src/index.js';
import { GitHub } from '../../collaboration/src/index.js';
import { git } from './git.js';

export interface HostConfig {
  capture: Capture;
  common: string;
  executable: string;
  base: string;
  fresh: boolean;
  storage: string;
}

/** Refuse dirty or unverified source and executable settings before writing a lane row. */
export function preflight(capture: Capture, storage: string, freshCapture = false): HostConfig {
  const { project, source } = capture;
  const base = project.delivery?.baseBranch;
  if (
    !base ||
    !/^[\w/-]+$/.test(base) ||
    base === project.delivery?.protectedBranch ||
    base === 'main'
  )
    throw new Error('Missing or unsafe captured staging branch');
  if (storage === source.root || storage.startsWith(source.root + '/'))
    throw new Error('Application storage must be outside the project');
  const common = realpathSync(
    git(source.root, 'rev-parse', '--path-format=absolute', '--git-common-dir'),
  );
  if (git(source.root, 'status', '--porcelain', '--untracked-files=normal'))
    throw new Error('Task admission requires a clean working tree');
  if (!freshCapture && git(source.root, 'rev-parse', 'HEAD') !== source.revision)
    throw new Error('The source revision changed during admission');
  const fresh =
    freshCapture ||
    git(source.root, 'ls-remote', '--exit-code', 'origin', `refs/heads/${base}`).split('\t')[0] ===
      source.revision;
  if (!project.checks?.acceptance?.length) throw new Error('Missing captured acceptance checks');
  new GitHub(source.remote, new AbortController().signal);
  if (!freshCapture) verifyNativeGuidance(capture, source.root);
  return { capture, common, executable: binding(project.bindings, common), base, fresh, storage };
}

/** Resolve only the configured local executable, with no PATH fallback. */
function binding(file: string | undefined, common: string) {
  if (!file || !/^\.git\/(?:[\w.-]+\/)*[\w.-]+$/.test(file) || file.split('/').includes('..'))
    throw new Error('Missing or unsafe project bindings path');
  const path = join(common, file.slice('.git/'.length));
  if (realpathSync(path) !== path) throw new Error('Project bindings must not use an alias');
  const data = parse(readFileSync(path, 'utf8'));
  const executable = data?.tools?.codex;
  if (data?.schemaVersion !== 1 || typeof executable !== 'string' || !isAbsolute(executable))
    throw new Error('Missing supported executable binding: tools.codex');
  accessSync(executable, constants.X_OK);
  return executable;
}

/** Keep native Codex discovery pinned to the approved input files during activation. */
export function verifyNativeGuidance(capture: Capture, worktree: string) {
  const isGuidance = (path: string) =>
    /(?:^|\/)(?:AGENTS(?:\.override)?\.md|\.agents\/skills\/)/.test(path);
  const listed = git(
    worktree,
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ).split('\0');
  if (
    existsSync(join(worktree, '.codex', 'config.toml')) ||
    listed.some((path) => /(?:^|\/)\.codex\/config\.toml$/.test(path))
  )
    throw new Error('Target Codex configuration is outside the captured harness binding');
  const approved = new Set(capture.source.paths.filter(isGuidance));
  for (const path of new Set([...listed.filter(isGuidance), ...approved])) {
    const absolute = join(worktree, path);
    if (
      !approved.has(path) ||
      !lstatSync(absolute).isFile() ||
      readFileSync(absolute, 'utf8') !== capture.source.read(path)
    )
      throw new Error(`Captured project guidance differs from the native discovery view: ${path}`);
  }
}

/** Choose the default external application state directory. */
export function applicationStorage() {
  return resolve(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'arcnexus');
}
