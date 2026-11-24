import type { Context } from 'cordis';
import { platformEndpoint } from '../../../packages/foundation/src/index.js';
import { readSecret } from '../../../packages/platform/src/index.js';

type Inspection = ReturnType<Context['commands']['inspect']>;

/** Inspect a verified remote project through the authorized operator API. */
export async function inspectPlatform(component: string, activity: string) {
  const query = new URLSearchParams({ component, activity });
  const response = await platformRequest('/inspection?' + query);
  if (!response.ok) throw new Error('Platform inspection unavailable (' + response.status + ')');
  return (await response.json()) as Inspection;
}

/** Use the same explicit operator and project boundary for hosted terminal operations. */
export async function platformRequest(path: string, init?: RequestInit) {
  const base = process.env.ARC_API_URL;
  const project = process.env.ARC_PROJECT_ID;
  const credential = process.env.ARC_OPERATOR_TOKEN_FILE;
  if (!base || !project || !credential)
    throw new Error('Configure the API URL, project ID, and operator credential file');
  const headers = new Headers(init?.headers);
  headers.set('authorization', 'Bearer ' + readSecret(credential));
  return fetch(platformEndpoint(base) + '/projects/' + encodeURIComponent(project) + path, {
    ...init,
    headers,
    redirect: 'error',
  });
}
