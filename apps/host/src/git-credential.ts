import { readFileSync } from 'node:fs';
import { githubAppReadToken } from '../../../packages/collaboration/src/index.js';
import { hostedGitHubBinding } from './github-binding.js';

/** Serve only a read credential for the exact trusted remote requested by Git. */
async function serve() {
  if (process.argv[2] !== 'get') return;
  const request = new URLSearchParams(readFileSync(0, 'utf8').split('\n').join('&'));
  const remote = request.get('protocol') + '://' + request.get('host') + '/' + request.get('path');
  const binding = hostedGitHubBinding();
  if (!binding || remote !== binding.remote) return;
  const token = await githubAppReadToken(remote, binding);
  process.stdout.write('username=x-access-token\npassword=' + token + '\n\n');
}

await serve();
