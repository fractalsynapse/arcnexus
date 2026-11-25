import {
  preferenceKey,
  preferencesUpdate,
  type UiPreference,
} from '../../../../packages/ui/src/preferences/schema.js';

/** Supply the same request shape for browser fixtures without an operator database. */
export function fixturePreferences() {
  const records = new Map<string, UiPreference>();
  return (method: string, body: string) => {
    if (method === 'PATCH') {
      const update = preferencesUpdate.parse(JSON.parse(body));
      for (const entry of update.entries) {
        const key = preferenceKey(entry);
        if (!update.preserveExisting || !records.has(key)) records.set(key, entry);
      }
    }
    return { entries: [...records.values()] };
  };
}
