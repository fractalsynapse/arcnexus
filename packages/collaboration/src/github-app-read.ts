import { createAppAuth } from '@octokit/auth-app';
import { z } from 'zod';
import { githubReadHeaders, githubRepository } from './repository-read.js';

interface AppReadBinding {
  appId: string;
  privateKey: string;
  request?: typeof fetch;
}

const installation = z.object({ id: z.int().positive() });
const accessToken = z.object({ token: z.string().min(1) });

/** Resolve the exact repository's installation and request only its read access. */
export async function githubAppReadToken(remote: string, binding: AppReadBinding) {
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
      body: JSON.stringify({ repositories: [repository], permissions: { contents: 'read' } }),
    },
  );
  if (!response.ok) throw new Error('The GitHub App could not authorize repository reads');
  return accessToken.parse(await response.json()).token;
}
