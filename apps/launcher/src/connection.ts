import { providerIdentitySchema, providerSchema } from '../../../packages/capacity/src/index.js';
import type { z } from 'zod';

export type Identity = z.output<typeof providerIdentitySchema>;

export function endpoint(input: string) {
  const url = new URL(input);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Use HTTPS or a local loopback endpoint');
  return url.href.replace(/\/$/, '');
}

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
