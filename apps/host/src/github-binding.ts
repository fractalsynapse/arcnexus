import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { githubAppPublication } from '../../../packages/collaboration/src/index.js';
import { readSecret } from '../../../packages/platform/src/index.js';

const keyFile = '/run/arcnexus/github-app.pem';
const assignmentFile = '/run/arcnexus/assignment.json';

export function hostedGitHubBinding() {
  const { remote, githubAppId } = JSON.parse(readFileSync(assignmentFile, 'utf8')) as {
    remote: string;
    githubAppId?: string;
  };
  if (!githubAppId) return;
  const stat = lstatSync(keyFile);
  if (!stat.isFile() || stat.nlink !== 1 || stat.mode & 0o077 || realpathSync(keyFile) !== keyFile)
    throw new Error('Invalid Host GitHub App key mount');
  return { remote, appId: githubAppId, privateKey: readSecret(keyFile) };
}

/** Bind native Git staging reads and the publication provider to one trusted repository. */
export function configureGitHub(directory: string, remote: string) {
  const binding = hostedGitHubBinding();
  if (!binding || binding.remote !== remote)
    throw new Error('Missing trusted Host GitHub App binding');
  for (const [key, value] of Object.entries({
    'user.name': 'ArcNexus Host',
    'user.email': 'arcnexus-host@users.noreply.github.com',
    'credential.useHttpPath': 'true',
    ['credential.' + remote + '.helper']:
      '!/usr/bin/node /app/dist/apps/host/src/git-credential.js',
  })) {
    execFileSync('/usr/bin/git', ['config', '--local', '--replace-all', key, value], {
      cwd: directory,
    });
  }
  return githubAppPublication(remote, binding);
}
