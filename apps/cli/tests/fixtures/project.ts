import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';

const architecture = '.arc/architecture';
const remote = 'https://example.invalid/fixture/target.git';

const activity = (role: string, operations: string[] = []) => ({
  role,
  profile: 'fixture',
  instructions: ['Component activity instruction'],
  operations,
  standards: ['fixture'],
});

/** Create a generic target project with committed guidance and distinct actors. */
export function projectFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-inspect-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init');
  git('remote', 'add', 'origin', remote);
  for (const [path, value] of Object.entries(definitions())) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof value === 'string' ? value : stringify(value));
  }
  git('add', '.');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'fixture',
  );
  return root;
}

/** Describe a self-contained project whose bindings are independent of ArcNexus. */
function definitions() {
  return {
    [`${architecture}/project.yaml`]: {
      id: 'fixture',
      remote,
      knowledgeRoot: '.arc',
      contractRegistry: 'contracts.yaml',
      planTemplate: `${architecture}/plan-template.md`,
      application: 'work',
      bindings: '.git/bindings.yaml',
      director: { component: 'plan', activity: 'planning' },
      verifier: { component: 'review', activity: 'assessment' },
    },
    ...actors(),
    ...resources(),
    [`${architecture}/plan-template.md`]: 'Fixture plan template\n',
    'AGENTS.md': 'Fixture root directive\n',
    'work/AGENTS.md': 'Fixture owner directive\n',
    'other/AGENTS.md': 'Unrelated directive\n',
    'standard.md': 'Fixture standard body\n',
    'contracts.yaml': { contracts: [] },
  };
}

/** Declare one steward and two distinct bound actors with their roles. */
function actors() {
  const components = [
    component('work', 'Fixture steward', 'work', 'testing', activity('engineer', ['test'])),
    component('plan', 'Fixture director', '.arc', 'planning', activity('director')),
    component('review', 'Fixture reviewer', 'review', 'assessment', activity('reviewer')),
  ];
  return {
    ...family('components', components),
    ...family(
      'roles',
      ['engineer', 'director', 'reviewer'].map((id) => ({
        id,
        instructions: [`Fixture ${id} instruction`],
      })),
    ),
  };
}

/** Model a component with one eligible activity for the fixture. */
function component(
  id: string,
  purpose: string,
  path: string,
  phase: string,
  binding: ReturnType<typeof activity>,
) {
  return { id, purpose, owns: [path], activities: { [phase]: binding } };
}

/** Give the fixture activity a profile, an operation, and an applicable standard. */
function resources() {
  return {
    ...family('execution-profiles', [
      {
        id: 'fixture',
        model: 'fixture-model',
        reasoning: 'medium',
        webSearch: 'disabled',
        operationCategories: ['integration-test'],
      },
    ]),
    ...family('standards', [{ id: 'fixture', document: 'standard.md' }]),
    ...family('operations', [
      { id: 'test', category: 'integration-test', command: 'npm', args: ['test'], network: false },
    ]),
  };
}

/** Derive definition filenames from IDs just as the catalog expects. */
function family(name: string, entries: readonly { id: string; [key: string]: unknown }[]) {
  return Object.fromEntries(
    entries.map((entry) => [`${architecture}/${name}/${entry.id}.yaml`, entry]),
  );
}
