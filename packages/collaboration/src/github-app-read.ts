import { createAppAuth } from '@octokit/auth-app';
import { z } from 'zod';
import { githubReadHeaders, githubRepository } from './repository-read.js';

interface AppBinding {
  appId: string;
  privateKey: string;
  request?: typeof fetch;
}

const installation = z.object({ id: z.int().positive() });
const accessToken = z.object({ token: z.string().min(1), expires_at: z.string().optional() });
type Permissions = Record<string, 'read' | 'write'>;

/** Resolve the exact repository's installation and request only its read access. */
export async function githubAppReadToken(remote: string, binding: AppBinding) {
  return (await installationToken(remote, binding, { contents: 'read' })).token;
}

/** Keep a repository's publication token inside its trusted Host adapter. */
export function githubAppPublication(remote: string, binding: AppBinding) {
  let credential: z.output<typeof accessToken> | undefined;
  return async (requested: string) => {
    if (requested !== remote) throw new Error('The GitHub App is bound to another repository');
    if (!credential?.expires_at || Date.parse(credential.expires_at) <= Date.now()) {
      credential = await installationToken(remote, binding, {
        contents: 'write',
        issues: 'write',
        pull_requests: 'write',
        checks: 'read',
        statuses: 'read',
        actions: 'read',
        workflows: 'write',
      });
    }
    return credential.token;
  };
}

async function installationToken(remote: string, binding: AppBinding, permissions: Permissions) {
  const target = githubRepository(remote);
  if (!target) throw new Error('Invalid GitHub repository binding');
  const [, owner, repository] = target;
  const auth = createAppAuth({ appId: binding.appId, privateKey: binding.privateKey });
  const { token: jwt } = await auth({ type: 'app' });
  const request = binding.request ?? fetch;
  const access = await request(
    'https://api.github.com/repos/' + owner + '/' + repository + '/installation',
    { method: 'GET', headers: githubReadHeaders(jwt), redirect: 'error' },
  );
  if (!access.ok) throw new Error('The GitHub App has no access to this repository');
  const { id } = installation.parse(await access.json());
  const response = await request(
    'https://api.github.com/app/installations/' + id + '/access_tokens',
    {
      method: 'POST',
      redirect: 'error',
      headers: { ...githubReadHeaders(jwt), 'content-type': 'application/json' },
      body: JSON.stringify({ repositories: [repository], permissions }),
    },
  );
  if (!response.ok)
    throw new Error('The GitHub App could not authorize the requested repository access');
  return accessToken.parse(await response.json());
}
