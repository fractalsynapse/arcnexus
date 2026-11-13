import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { WorkspaceCliFixture } from '../../testing/support/workspace-cli-fixture.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  minimalWorkflowFixture,
  type WorkflowFixture,
} from '../../testing/support/workflow-fixture.js';

const generatedDirectoryProbe = {
  command: 'node',
  args: [
    '-e',
    "require('fs').mkdirSync('generated',{recursive:true});require('fs').writeFileSync('generated/cwd',process.cwd())",
  ],
};

/** Materializes two captured repositories whose lifecycle recipes use shared confined operations. */
export function composed(t: TestContext): any {
  const f = minimalWorkflowFixture(t),
    { dependency, dg } = createDependency(f.root);
  configureOwners(f);
  writeFileSync(join(f.repo, '.gitignore'), '.env\ngenerated/\npackages/\n');
  const environment = workspaceEnvironment(dg('rev-parse', 'HEAD'));
  const bindings = writeBindings(f.root, dependency);
  const commit = () => {
    writeFileSync(join(f.repo, '.arc/architecture/environment.yaml'), JSON.stringify(environment));
    if (f.git('status', '--porcelain')) f.commit();
  };
  const setup = (command: { command: string; args: string[] }) => writeSetup(f, command);
  setup(generatedDirectoryProbe);
  commit();
  const workspace = new WorkspaceCliFixture(f, bindings);
  return {
    ...f,
    env: workspace.env,
    prepareArgs: workspace.prepareArgs,
    dependency,
    dg,
    environment,
    bindings,
    commit,
    setup,
    prepare: () => workspace.prepare(),
    cleanup: (id: string) => workspace.cleanup(id),
  };
}

/** Keeps repository-specific verification on its package while inheriting common engineering policy. */
function configureOwners(f: WorkflowFixture): void {
  const read = (id: string) =>
    JSON.parse(readFileSync(join(f.repo, `.arc/architecture/components/${id}.json`), 'utf8'));
  const put = (id: string, value: object) =>
    writeFileSync(join(f.repo, `.arc/architecture/components/${id}.json`), JSON.stringify(value));
  const platform = read('platform'),
    primary = read('package');
  primary.operations = platform.operations;
  delete platform.operations;
  put('platform', platform);
  put('package', primary);
  put('dependency-package', {
    ...primary,
    id: 'dependency-package',
    repository: 'dependency',
    operations: { 'dependency-setup': ['setup'] },
  });
  put('dependency', {
    ...read('dependency'),
    parentId: 'dependency-package',
    owns: ['source.txt', '.gitignore'],
  });
  const maintenance = read('maintenance');
  maintenance.owns.push('.arc/architecture/components/dependency-package.json');
  put('maintenance', maintenance);
}

/** Captures the supplied recipe once under the dependency's explicit operation identity. */
function writeSetup(f: WorkflowFixture, command: { command: string; args: string[] }): void {
  const template = JSON.parse(
    readFileSync(join(f.repo, '.arc/architecture/operations/verify.yaml'), 'utf8'),
  );
  writeFileSync(
    join(f.repo, '.arc/architecture/operations/dependency-setup.yaml'),
    JSON.stringify({
      ...template,
      ...command,
      id: 'dependency-setup',
      repository: 'dependency',
      purpose: 'Prepare captured dependency',
    }),
  );
}

/** Creates the dependency source without importing any executable configuration from it. */
function createDependency(root: string) {
  const dependency = join(root, 'dependency');
  mkdirSync(dependency);
  const dg = (...args: string[]) => {
    const r = spawnSync('git', ['-C', dependency, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  dg('init', '-b', 'main');
  dg('config', 'user.name', 'Test');
  dg('config', 'user.email', 'test@example.invalid');
  dg('remote', 'add', 'origin', 'https://example.invalid/dependency.git');
  writeFileSync(join(dependency, 'source.txt'), 'dependency');
  writeFileSync(join(dependency, '.gitignore'), 'generated/\nunknown/\n');
  dg('add', '.');
  dg('commit', '-m', 'dependency');
  return { dependency, dg };
}

/** Keeps machine-specific executables and repository locations outside committed authority. */
function writeBindings(root: string, dependency: string): string {
  const path = join(root, 'minimal-bindings.json');
  const bindings = JSON.parse(readFileSync(path, 'utf8'));
  bindings.repositories = { dependency };
  writeFileSync(path, JSON.stringify(bindings));
  return path;
}

/** Declares repository composition without duplicating setup commands or generated roots. */
function workspaceEnvironment(commit: string): any {
  return {
    schemaVersion: 4,
    workspace: {
      primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
      dependencies: [
        {
          id: 'dependency',
          repository: 'https://example.invalid/dependency.git',
          commit,
          path: 'packages/dependency',
        },
      ],
    },
  };
}
