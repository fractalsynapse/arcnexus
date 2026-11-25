import type { Context } from 'cordis';
import { UiPreferences, type UiPreferencesBinding } from '../../../../packages/ui/src/index.js';
import {
  preferencesSnapshot,
  uiPreferencesResource,
  type UiPreference,
} from '../../../../packages/ui/src/preferences/schema.js';
import { api } from '../platform/resource.js';
import { legacyPreferences } from '../platform/legacy-preferences.js';

declare module 'cordis' {
  interface Context {
    uiPreferences: UiPreferences;
  }
}

const path = '/' + uiPreferencesResource;

async function save(entries: UiPreference[], preserveExisting?: boolean) {
  return preferencesSnapshot.parse(
    await api(path, {
      method: 'PATCH',
      body: JSON.stringify({ entries, preserveExisting }),
    }),
  );
}

const operatorPreferences: UiPreferencesBinding = {
  async load() {
    const snapshot = preferencesSnapshot.parse(await api(path, { cache: 'no-store' }));
    if (snapshot.entries.length) return snapshot;
    const legacy = legacyPreferences();
    return legacy.length ? save(legacy, true) : snapshot;
  },
  save: (entry) => save([entry]),
};

export const preferencesPlugin = {
  /** Bind the reusable UI settings service to the current operator's gateway. */
  apply(context: Context) {
    context.provide('uiPreferences', new UiPreferences(operatorPreferences));
  },
};
