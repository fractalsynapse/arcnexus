import type { Context } from 'cordis';
import { platformEndpoint } from '../../../packages/foundation/src/index.js';
import { readSecret } from '../../../packages/platform/src/index.js';

type Inspection = ReturnType<Context['commands']['inspect']>;

/** Inspect a verified remote project through the authorized operator API. */
export async function inspectPlatform(component: string, activity: string) {
  const base = process.env.ARC_API_URL;
  const project = process.env.ARC_PROJECT_ID;
  const credential = process.env.ARC_OPERATOR_TOKEN_FILE;
  if (!base || !project || !credential)
    throw new Error('Configure the API URL, project ID, and operator credential file');
  const query = new URLSearchParams({ component, activity });
  const response = await fetch(
    platformEndpoint(base) + '/projects/' + encodeURIComponent(project) + '/inspection?' + query,
    { headers: { authorization: 'Bearer ' + readSecret(credential) }, redirect: 'error' },
  );
  if (!response.ok) throw new Error('Platform inspection unavailable (' + response.status + ')');
  return (await response.json()) as Inspection;
}
