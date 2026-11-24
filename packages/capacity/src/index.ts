import { randomBytes, randomUUID } from 'node:crypto';
import type { Context } from 'cordis';
import type { Client } from 'pg';
import { textDigest } from '../../foundation/src/index.js';
import { Presence } from './presence.js';
export { capacityMigration } from './schema.js';

export type CapacityState = 'pending' | 'admitted' | 'revoked';

export interface CapacityProvider {
  id: string;
  name: string;
  platform: string;
  state: CapacityState;
}

export interface ProviderInfo {
  name: string;
  platform: string;
}

declare module 'cordis' {
  interface Context {
    capacity: Capacity;
  }
}

function secret() {
  return randomBytes(32).toString('base64url');
}

/** Own the database-backed launcher enrollment and its credential state. */
export class Capacity {
  private readonly presence = new Presence();

  /** Use the operator platform store prepared by database setup. */
  constructor(private readonly database: Client) {}

  /** Return a one-use code while persisting only its digest. */
  async issue(operator: string) {
    const code = secret();
    await this.database.query(
      'INSERT INTO arcnexus_capacity.registration_codes (digest, operator) VALUES ($1, $2)',
      [textDigest(code), operator],
    );
    return code;
  }

  /** Consume a registration and create its pending identity in one statement. */
  async claim(code: string, info: ProviderInfo) {
    const id = randomUUID();
    const token = secret();
    const { rowCount } = await this.database.query(
      `WITH claimed AS (
         DELETE FROM arcnexus_capacity.registration_codes WHERE digest = $1 RETURNING operator
       )
       INSERT INTO arcnexus_capacity.providers (id, operator, name, platform, digest, state)
       SELECT $2, operator, $3, $4, $5, 'pending' FROM claimed`,
      [textDigest(code), id, info.name, info.platform, textDigest(token)],
    );
    if (!rowCount) throw new Error('Registration code unavailable');
    return { id, token };
  }

  /** Expose only provider identity and registration state to the owning operator. */
  async list(operator: string) {
    const { rows } = await this.database.query<CapacityProvider>(
      'SELECT id, name, platform, state FROM arcnexus_capacity.providers WHERE operator = $1 ORDER BY name, id',
      [operator],
    );
    return rows.map((provider) => ({ ...provider, online: this.presence.online(provider.id) }));
  }

  /** Admit exactly a pending registration or revoke an existing authorization. */
  async decide(operator: string, id: string, state: 'admitted' | 'revoked') {
    const { rows } = await this.database.query<CapacityProvider>(
      `UPDATE arcnexus_capacity.providers SET state = $3
       WHERE operator = $1 AND id = $2 AND (state = 'pending' OR ($3 = 'revoked' AND state = 'admitted'))
       RETURNING id, name, platform, state`,
      [operator, id, state],
    );
    if (!rows[0]) throw new Error('Provider action unavailable');
    if (state === 'revoked') this.presence.disconnect(id);
    return rows[0];
  }

  /** Recheck a launcher's identity against the durable admission state. */
  async authenticate(id: string, token: string) {
    const { rows } = await this.database.query<CapacityProvider>(
      `SELECT id, name, platform, state FROM arcnexus_capacity.providers
       WHERE id = $1 AND digest = $2 AND state <> 'revoked'`,
      [id, textDigest(token)],
    );
    return rows[0];
  }

  /** Maintain one active connection for an admitted credential. */
  async connect(id: string, token: string) {
    const provider = await this.authenticate(id, token);
    return provider?.state === 'admitted' ? this.presence.attach(id) : undefined;
  }
}

export function capacityPlugin(database: Client) {
  return {
    /** Publish enrollment through the accountable service. */
    apply(context: Context) {
      context.provide('capacity', new Capacity(database));
    },
  };
}

export {
  enrollmentSchema,
  providerDecisionSchema,
  providerIdentitySchema,
  providerSchema,
} from './registration.js';
