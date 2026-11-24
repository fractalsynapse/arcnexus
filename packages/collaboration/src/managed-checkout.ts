import { execFile } from 'node:child_process';
import { lstat, mkdtemp, realpath, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize } from 'node:path';
import { promisify } from 'node:util';
import { githubRepository } from './repository-read.js';

export type CheckoutGit = (
  args: string[],
  directory: string,
  config: Readonly<Record<string, string>>,
) => Promise<string>;

const execute = promisify(execFile);

const git: CheckoutGit = async (args, cwd, config) => {
  const entries = Object.entries(config);
  const settings = Object.fromEntries(
    entries.flatMap(([key, value], index) => [
      ['GIT_CONFIG_KEY_' + index, key],
      ['GIT_CONFIG_VALUE_' + index, value],
    ]),
  );
  const { stdout } = await execute('/usr/bin/git', args, {
    cwd,
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_COUNT: String(entries.length),
      ...settings,
    },
    encoding: 'utf8',
    maxBuffer: Infinity,
  });
  return stdout.trim();
};

function settings(remote: string, token?: string) {
  const config: Record<string, string> = {
    'http.followRedirects': 'false',
    'credential.helper': '',
    'protocol.allow': 'never',
    'protocol.https.allow': 'always',
    'core.hooksPath': '/dev/null',
  };
  if (token)
    config['http.' + remote + '.extraHeader'] =
      'Authorization: Basic ' + Buffer.from('x-access-token:' + token).toString('base64');
  return config;
}

async function isCheckout(path: string) {
  try {
    const found = await lstat(path);
    if (!found.isDirectory() || (await realpath(path)) !== path)
      throw new Error('Managed checkout must be a direct directory');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return false;
  }
}

type Binding = { directory: string; remote: string; token?: string };

async function provision(
  directory: string,
  remote: string,
  run: CheckoutGit,
  config: ReturnType<typeof settings>,
) {
  const parent = dirname(directory);
  const staging = await mkdtemp(join(parent, '.arcnexus-checkout-'));
  try {
    const checkout = join(staging, 'repository');
    await run(
      ['clone', '--no-checkout', '--no-tags', '--no-recurse-submodules', '--', remote, checkout],
      parent,
      config,
    );
    try {
      await rename(checkout, directory);
    } catch (error) {
      const collision = ['EEXIST', 'ENOTEMPTY'].includes(
        (error as NodeJS.ErrnoException).code ?? '',
      );
      if (!collision || !(await isCheckout(directory))) throw error;
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** Prepare a trusted read checkout and retain each pinned revision for Data clients. */
export async function managedRepository({ directory, remote, token }: Binding, run = git) {
  if (
    !githubRepository(remote) ||
    !isAbsolute(directory) ||
    normalize(directory) !== directory ||
    (await realpath(dirname(directory))) !== dirname(directory)
  )
    throw new Error('Managed checkout binding is unavailable');
  const config = settings(remote, token);
  if (!(await isCheckout(directory))) await provision(directory, remote, run, config);
  if (
    (await run(['config', '--local', '--get', 'remote.origin.url'], directory, config)) !== remote
  )
    throw new Error('Managed checkout remote changed');
  await run(
    ['fetch', '--no-tags', '--no-recurse-submodules', '--', remote, 'HEAD'],
    directory,
    config,
  );
  const revision = await run(['rev-parse', '--verify', 'FETCH_HEAD^{commit}'], directory, config);
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error('Managed checkout returned an invalid revision');
  await run(['update-ref', 'refs/arcnexus/retained/' + revision, revision], directory, config);
  return revision;
}
