import { type ConfigurationSource, ConfigurationReader } from '../architecture/configuration.js';
import { relativePath, type Command } from '../architecture/config.js';
import { validateSchema } from '../architecture/schema.js';

interface ProfileFields {
  configuration: ConfigurationSource;
  id: string;
  adapter: 'node';
  outputRoot: string;
}

export type TestProfile = ProfileFields &
  (
    | { schemaVersion: 1; preparation: Array<Command & { purpose: 'production' | 'tests' }> }
    | {
        schemaVersion: 2;
        run: string;
        preparation: Array<{ operation: string; purpose: 'production' | 'tests' }>;
      }
  );

/** Resolves fixed preparation commands from the same immutable catalog revision. */
export function loadTestProfile(project: string, revision: string, id: string): TestProfile {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Invalid test profile: ${id}`);
  const source = new ConfigurationReader().definition(
    project,
    revision,
    `architecture/test-profiles/${id}`,
  );
  const profile = validateSchema<TestProfile>('test-profile', source.value);
  if (profile.id !== id) throw new Error(`Test profile identity mismatch: ${id}`);
  relativePath(profile.outputRoot);
  return { ...profile, configuration: source };
}
