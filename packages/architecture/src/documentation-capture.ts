import type { Capture } from './catalog.js';
import type { ProjectSource } from './source.js';

const inactive = { component: 'unavailable', activity: 'unavailable' };
const category = 'project-tool';

/** Bind documentation discovery to platform tools before the project has supplied any authority. */
export function documentationCapture(source: ProjectSource): Capture {
  return {
    source,
    documentationOnly: true,
    project: {
      id: source.remote,
      remote: source.remote,
      contractRegistry: 'Platform read-only binding',
      planTemplate: '',
      director: inactive,
      verifier: inactive,
    },
    components: discoveryPlanner,
    roles: { planner: { id: 'planner', purpose: 'Recommend objectives for human review.' } },
    profiles: {
      documentation: {
        id: 'documentation',
        model: 'gpt-6.1-sol',
        reasoning: 'medium',
        webSearch: 'disabled',
        operationCategories: [category],
      },
    },
    operations: discoveryOperations,
    standards: {},
    contracts: [],
  };
}

const discoveryPlanner: Capture['components'] = {
  planner: {
    id: 'planner',
    purpose: 'Discover source-backed objectives from a verified Git tree.',
    owns: [],
    activities: {
      planning: {
        role: 'planner',
        profile: 'documentation',
        instructions: ['Read committed material as evidence for the supplied assignment.'],
        standards: [],
        operations: ['list-files', 'read-file'],
      },
    },
  },
};

const discoveryOperations = {
  'list-files': { id: 'list-files', category, tool: 'list' },
  'read-file': { id: 'read-file', category, tool: 'read' },
} satisfies Capture['operations'];
