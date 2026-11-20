import { join } from 'node:path';

const remote = 'https://github.com/example/reviewed-hold.git';

const project = {
  id: 'hold-fixture',
  remote,
  contractRegistry: 'registry.yaml',
  planTemplate: 'plan.md',
  director: { component: 'director', activity: 'planning' },
  verifier: { component: 'reviewer', activity: 'review' },
  checks: { acceptance: [] },
};
const activity = {
  role: 'steward',
  profile: 'controlled',
  instructions: [],
  operations: ['checked-edit', 'read-file', 'owner-tests'],
  standards: [],
};
const owner = {
  id: 'owner',
  purpose: 'Own reviewed inputs',
  owns: ['fixture.txt', 'unrelated.txt'],
  activities: { implementation: activity },
};
const operations = {
  'owner-tests': {
    id: 'owner-tests',
    category: 'test',
    command: process.execPath,
    args: [join(import.meta.dirname, 'reviewed-hold-command.js')],
    network: false,
  },
  'checked-edit': { id: 'checked-edit', category: 'edit', tool: 'edit' },
  'read-file': { id: 'read-file', category: 'read', tool: 'read' },
};

export const holdFiles: Record<string, string> = {
  'fixture.txt': 'original',
  'unrelated.txt': 'unrelated',
  'plan.md': '# Plan\n',
  'registry.yaml': 'contracts: []\n',
  '.arc/architecture/project.yaml': JSON.stringify(project),
  '.arc/architecture/components/owner.yaml': JSON.stringify(owner),
  '.arc/architecture/roles/steward.yaml': '{"id":"steward","purpose":"Correct owned work"}',
  '.arc/architecture/execution-profiles/controlled.yaml': JSON.stringify({
    id: 'controlled',
    model: 'controlled',
    reasoning: 'high',
    webSearch: 'disabled',
    operationCategories: ['test', 'edit', 'read'],
  }),
  ...Object.fromEntries(
    Object.entries(operations).map(([id, operation]) => [
      `.arc/architecture/operations/${id}.yaml`,
      JSON.stringify(operation),
    ]),
  ),
};
