import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execute, git } from './process.js';

export const gitPolicy = [
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'init.templateDir=',
  '-c',
  'credential.helper=',
  '-c',
  'http.followRedirects=false',
  '-c',
  'http.sslVerify=true',
];

/** Restricts transport to local files unless the caller supplied repository-bound HTTPS authorization. */
export function gitEnvironment(credentials: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ALLOW_PROTOCOL: 'file',
    ...credentials,
  };
}

/** Supplies credentials exclusively to the authorized repository in an isolated host Git process. */
export async function gitAuthorization(repository: string, credential: () => Promise<string>) {
  const token = await credential();
  if (!token.trim()) throw new Error('GitHub host credential is unavailable');
  const authorization = Buffer.from('x-access-token:' + token).toString('base64');
  return {
    GIT_ALLOW_PROTOCOL: 'https',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.https://github.com/${repository}.git.extraHeader`,
    GIT_CONFIG_VALUE_0: 'Authorization: Basic ' + authorization,
  };
}

/** Imports a provider-observed SHA without moving checkout, tracking refs, or FETCH_HEAD. */
export async function importObservedHead(
  source: string,
  evidence: string,
  repository: string,
  head: string,
  credential: (() => Promise<string>) | undefined,
  signal: AbortSignal,
): Promise<void> {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new Error('Invalid observed commit');
  if (containsCommit(source, head)) return;
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  if (realpathSync(evidence) !== resolve(evidence)) throw new Error('Aliased target evidence path');
  const area = mkdtempSync(join(evidence, 'observed-'));
  const bare = join(area, 'objects.git');
  const run = observedCommands(area, signal);
  await run('init', area, ['init', '--bare', bare]);
  const fetch = ['fetch', '--no-tags', '--no-write-fetch-head', '--no-recurse-submodules', '--'];
  await run(
    'upstream',
    bare,
    [...fetch, 'https://github.com/' + repository + '.git', head],
    credential ? await gitAuthorization(repository, credential) : { GIT_ALLOW_PROTOCOL: 'https' },
  );
  await run('import', source, [...fetch, bare, head]);
  if (git(source, 'cat-file', '-t', head).trim() !== 'commit')
    throw new Error('Invalid imported target');
}

/** A missing local object is expected when another contributor advanced staging. */
function containsCommit(source: string, head: string): boolean {
  try {
    return git(source, 'cat-file', '-t', head).trim() === 'commit';
  } catch {
    return false;
  }
}

/** Records each scoped transport command under its private observation directory. */
function observedCommands(area: string, signal: AbortSignal) {
  return async (name: string, cwd: string, args: string[], credentials = {}) => {
    const result = await execute(
      { command: 'git', args: [...gitPolicy, ...args] },
      cwd,
      join(area, name + '.log'),
      signal,
      {
        env: gitEnvironment(credentials),
        processScope: true,
      },
    );
    if (result.exitCode !== 0)
      throw new Error('Unable to import observed staging commit; inspect ' + result.log);
  };
}
