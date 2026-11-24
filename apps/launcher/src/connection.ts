import { platformEndpoint as endpoint } from '../../../packages/foundation/src/index.js';
export { endpoint };
import { providerIdentitySchema, providerSchema } from '../../../packages/capacity/src/index.js';
import type { z } from 'zod';

export type Identity = z.output<typeof providerIdentitySchema>;

/** Exchange the setup code for a credential that can only start work after admission. */
export async function enroll(api: string, code: string, name: string, platform: string) {
  const result = await fetch(endpoint(api) + '/capacity-providers/enrollment', {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, name, platform }),
  });
  if (!result.ok) throw new Error('Launcher registration unavailable');
  return providerIdentitySchema.parse(await result.json());
}

/** Recheck the provisioned identity without disclosing the local secret. */
export async function status(api: string, identity: Identity) {
  const result = await fetch(endpoint(api) + '/capacity-providers/' + identity.id + '/status', {
    redirect: 'error',
    headers: { authorization: 'Bearer ' + identity.token },
  });
  if (!result.ok) throw new Error('Launcher authorization unavailable');
  return providerSchema.parse(await result.json());
}

/** Open the authenticated outbound connection for an admitted launcher. */
export async function connect(api: string, identity: Identity, signal?: AbortSignal) {
  const target = endpoint(api) + '/capacity-providers/' + identity.id + '/connection';
  const response = await fetch(target, {
    signal,
    redirect: 'error',
    headers: { authorization: 'Bearer ' + identity.token, accept: 'text/event-stream' },
  });
  if (!response.ok || !response.body) throw new Error('Launcher connection not admitted');
  return response.body;
}
