import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const componentFields = {
  schemaVersion: 6,
  repository: 'sample',
  activities: {
    research: {
      role: 'engineer',
      profile: 'luna',
      operations: [],
      instructions: ['Carry out the research activity within the sample component scope'],
    },
    documentation: {
      role: 'engineer',
      profile: 'luna',
      operations: [],
      instructions: ['Carry out the documentation activity within the sample component scope'],
    },
    testing: {
      role: 'engineer',
      profile: 'luna',
      operations: [],
      instructions: ['Carry out the testing activity within the sample component scope'],
    },
    implementation: {
      role: 'engineer',
      profile: 'luna',
      operations: [],
      instructions: ['Carry out the implementation activity within the sample component scope'],
    },
    review: {
      role: 'engineer',
      profile: 'luna',
      operations: [],
      instructions: ['Carry out the review activity within the sample component scope'],
    },
    release: {
      role: 'engineer',
      profile: 'luna',
      operations: [],
      instructions: ['Carry out the release activity within the sample component scope'],
    },
  },
  executionProfile: 'luna',
  parentId: 'package',
  owns: ['src/sample'],
  interfaces: [],
  documentation: [],
  tests: [],
  relatedIds: [],
  questions: [],
  patterns: [],
};

/**
 * Fields a container document may declare.
 *
 * A platform or package contains owners and names its source root; it neither owns leaf paths nor
 * runs verification, and it has no discovery, documentation or access grants of its own. Sharing the
 * leaf base with containers produced documents matching no schema branch, after which every
 * legitimate key looked like the offense, which cost several rounds of diagnosis.
 */
export const containerFields = {
  schemaVersion: 6,
  repository: 'sample',
  purpose: 'Contain test owners',
  objectives: [],
  constraints: [],
  activities: {},
};

export const members = {
  foundations: [],
  dependencies: [],
  gateways: [],
  libraries: ['sample'],
  releases: [],
};

export function catalogFixture(repo: any): any {
  for (const [path, value] of Object.entries({
    'roles/engineer': {
      schemaVersion: 4,
      id: 'engineer',
      purpose: 'Bounded engineering',
      responsibilities: ['Verify changes'],
    },
    'execution-profiles/luna': {
      schemaVersion: 3,
      id: 'luna',
      model: 'gpt-6-luna',
      reasoning: 'medium',
      webSearch: 'live',
      timeoutSeconds: 900,
      commandTimeoutSeconds: 120,
      maxTurns: 3,
      maxCorrectiveTurns: 2,
    },
  })) {
    mkdirSync(join(repo, 'architecture', path, '..'), { recursive: true });
    writeFileSync(join(repo, 'architecture', path + '.yaml'), JSON.stringify(value));
  }
}
