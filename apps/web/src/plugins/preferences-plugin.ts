import type { Context } from 'cordis';
import { UiPreferences, type UiPreferencesBinding } from '../../../../packages/ui/src/index.js';
import {
  preferencesSnapshot,
  uiPreferencesResource,
  type UiPreference,
} from '../../../../packages/ui/src/preferences/schema.js';
import type { GatewayClient } from '../platform/gateway-client.js';
import { legacyPreferences } from '../platform/legacy-preferences.js';

declare module 'cordis' {
  interface Context {
    uiPreferences: UiPreferences;
  }
}

const path = '/' + uiPreferencesResource;

async function save(gateway: GatewayClient, entries: UiPreference[], preserveExisting?: boolean) {
  return preferencesSnapshot.parse(
    await gateway.read(path, {
      method: 'PATCH',
      body: JSON.stringify({ entries, preserveExisting }),
    }),
  );
}

function operatorPreferences(gateway: GatewayClient): UiPreferencesBinding {
  return {
    async load() {
      const snapshot = preferencesSnapshot.parse(await gateway.read(path, { cache: 'no-store' }));
      if (snapshot.entries.length) return snapshot;
      const legacy = legacyPreferences();
      return legacy.length ? save(gateway, legacy, true) : snapshot;
    },
    save: (entry) => save(gateway, [entry]),
  };
}

export const preferencesPlugin = {
  inject: ['webPlatform'],
  /** Bind the reusable UI settings service to the current operator's gateway. */
  apply(context: Context) {
    context.provide(
      'uiPreferences',
      new UiPreferences(operatorPreferences(context.webPlatform.gateway)),
    );
  },
};
