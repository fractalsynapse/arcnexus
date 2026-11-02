import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkflowFixture } from './workflow-fixture.js';

/** Supplies minimal captured authority for the existing scripted engineering scenarios. */
export class MinimalWorkflowPolicy {
  /** Keeps fixture materialization separate from the production architectural resolver. */
  constructor(private readonly fixture: WorkflowFixture) {}

  /** Replaces legacy recipes, binds native confinement and captures a clean test revision. */
  apply(): void {
    const f = this.fixture;
    const native = process.env.ARCNEXUS_TEST_CODEX;
    if (!native) throw new Error('Minimal workflow qualification requires ARCNEXUS_TEST_CODEX');
    this.components();
    this.execution();
    const bindings = join(f.root, 'minimal-bindings.json');
    writeFileSync(
      bindings,
      JSON.stringify({
        schemaVersion: 1,
        tools: { codex: f.executable, nativeCodex: native, node: process.execPath },
        repositories: {},
      }),
    );
    const run = f.run;
    f.run = (...args: string[]) => run('--bindings', bindings, ...args);
    f.configure({ planning: true, checkedEdits: true, nativeExecutable: native });
    f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    f.commit();
  }

  /** Gives the worker exact source ownership and assigns configuration to a separate maintenance owner. */
  private components(): void {
    const f = this.fixture;
    for (const key of Object.keys(f.component)) delete f.component[key];
    Object.assign(
      f.component,
      this.definition('sample', 'library', {
        parentId: 'package',
        owns: ['source.txt', 'docs', 'tests', 'new.txt'],
      }),
    );
    this.put('components/sample.json', f.component);
    this.put(
      'components/dependency.json',
      this.definition('dependency', 'library', {
        parentId: 'package',
        owns: ['dependency'],
      }),
    );
    this.maintenance();
    this.containers();
  }

  /** Assigns shared configuration to its accountable executable maintainer. */
  private maintenance(): void {
    this.put(
      'components/maintenance.json',
      this.definition('maintenance', 'foundation', {
        parentId: 'package',
        owns: [
          '.gitignore',
          'verify.cjs',
          'architecture/environment.yaml',
          'architecture/roles',
          'architecture/execution-profiles',
          'architecture/operations',
          'architecture/components/platform.json',
          'architecture/components/package.json',
        ],
      }),
    );
  }

  /** Declares inherited engineering and verification once without granting container write authority. */
  private containers(): void {
    this.put(
      'components/platform.json',
      this.definition('platform', 'platform', {
        role: 'engineer',
        executionProfile: 'luna',
        reads: ['.'],
        operations: { verify: ['verify', 'agent'] },
        director: { component: 'maintenance', profile: 'luna' },
        reviewerProfile: 'luna',
        defaultPackage: 'package',
      }),
    );
    this.put(
      'components/package.json',
      this.definition('package', 'package', {
        parentId: 'platform',
      }),
    );
  }

  /** Captures one finite check and no execution budgets or inline setup commands. */
  private execution(): void {
    this.put('execution-profiles/luna.yaml', {
      schemaVersion: 3,
      id: 'luna',
      model: 'gpt-6-luna',
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: ['unit-test'],
    });
    this.put('operations/verify.yaml', {
      schemaVersion: 4,
      id: 'verify',
      purpose: 'Observe the captured regression',
      kind: 'command',
      repository: 'sample',
      cwd: '.',
      category: 'unit-test',
      activities: ['research', 'documentation', 'testing', 'implementation', 'review'],
      command: 'node',
      args: ['verify.cjs'],
      prerequisites: [],
      generatedDirectories: ['generated'],
      artifacts: [],
    });
    this.composition();
  }

  /** Preserves repository identity without authoring executable lifecycle recipes. */
  private composition(): void {
    this.put('environment.yaml', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [],
      },
    });
  }

  /** Supplies only the architectural fields meaningful to the selected fixture component. */
  private definition(id: string, type: string, fields: object): object {
    return { schemaVersion: 6, id, type, purpose: 'Own ' + id + ' responsibilities', ...fields };
  }

  /** Writes fixture declarations before their authority revision is committed. */
  private put(path: string, value: unknown): void {
    const target = join(this.fixture.repo, 'architecture', path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, JSON.stringify(value));
  }
}
