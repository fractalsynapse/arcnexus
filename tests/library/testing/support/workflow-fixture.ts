import { MinimalWorkflowPolicy } from './minimal-workflow-policy.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { catalogFixture, componentFields, containerFields } from './catalog-fixture.js';
import type { WorkflowOptions } from './controlled-workflow.js';

export const cli = resolve('dist/cli.js');

export const stewardEntry = fileURLToPath(new URL('./steward-entry.js', import.meta.url));

export function workflowFixture(
  t: TestContext,
  mode = 'success',
  beforeCleanup?: () => Promise<void>,
): WorkflowFixture {
  return new WorkflowFixture(t, mode, beforeCleanup);
}

/** Materializes the same scripted workflow under minimal authority and actual native confinement. */
export function minimalWorkflowFixture(t: TestContext, mode = 'success'): WorkflowFixture {
  const fixture = new WorkflowFixture(t, mode);
  new MinimalWorkflowPolicy(fixture).apply();
  return fixture;
}

/** Exercises workflow fixture behavior through observable scenarios. */
export class WorkflowFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-workflow-'));

  readonly repo = join(this.root, 'repo');

  readonly state = join(this.root, 'state');

  readonly calls = join(this.root, 'calls.jsonl');

  readonly executable = join(this.root, 'codex');

  readonly env = { ...process.env, ARCNEXUS_STATE_DIR: this.state };

  readonly component: any = {
    ...componentFields,
    id: 'sample',
    type: 'library',
    purpose: 'Own sample behavior',
    objectives: ['Bounded change'],
    constraints: ['No commits'],
    // Ownership is the write scope: path, access and allowed-write derivations all come from it,
    // and verification comes from the operations bound to the component, so none is authored.
    owns: ['source.txt', 'docs', 'tests', 'new.txt'],
    // Binding the verify operation is what makes this leaf executable: the assignment path requires
    // an owner whose operation plan produced a verification check, and an unbound leaf has none.
    operations: { verify: ['verify'] },
  };

  private options: WorkflowOptions;

  /** Creates a committed engineering fixture and controlled executable with temporary cleanup. */
  constructor(t: TestContext, mode: string, beforeCleanup?: () => Promise<void>) {
    t.after(async () => {
      await beforeCleanup?.();
      rmSync(this.root, { recursive: true, force: true });
    });
    this.options = { mode, calls: this.calls };
    mkdirSync(join(this.repo, 'architecture/components'), { recursive: true });
    this.git('init', '-b', 'staging');
    this.git('config', 'user.name', 'Test');
    this.git('config', 'user.email', 'test@example.invalid');
    // The environment declares a primary repository, so the checkout must carry that origin: binding
    // identity compares the declared URL against it, and without a remote git's raw "No such remote
    // 'origin'" surfaces instead of the assignment behavior these scenarios exercise. Guarded
    // because a fixture that already established its remotes must not fail on a duplicate add.
    if (!this.git('remote').trim().split('\n').includes('origin'))
      this.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    this.files();
    this.catalog();
    this.configure({});
    this.commit();
  }

  git = (...args: string[]): string => {
    const result = spawnSync('git', ['-C', this.repo, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };

  commit = (): void => {
    this.git('add', '.');
    this.git('commit', '-m', 'fixture');
  };

  run = (...args: string[]) => {
    return spawnSync(
      process.execPath,
      [
        stewardEntry,
        'run',
        'sample',
        'Improve behavior',
        '--project',
        this.repo,
        '--codex-path',
        this.executable,
        ...args,
      ],
      { encoding: 'utf8', env: this.env, timeout: 30 * 60 * 1000 },
    );
  };

  configure = (options: Partial<WorkflowOptions>): void => {
    Object.assign(this.options, options);
    const module = pathToFileURL(
      resolve('.test-build/library/testing/support/controlled-workflow.js'),
    ).href;
    writeFileSync(
      this.executable,
      `#!/usr/bin/env node\nimport(${JSON.stringify(module)}).then(({ControlledWorkflow}) => new ControlledWorkflow(${JSON.stringify(this.options)}).run());\n`,
      { mode: 0o755 },
    );
  };

  /** Writes baseline source, documentation and a regression-aware verification executable. */
  private files(): void {
    catalogFixture(this.repo);
    mkdirSync(join(this.repo, 'docs'));
    mkdirSync(join(this.repo, 'tests'));
    writeFileSync(join(this.repo, 'docs/behavior.md'), 'Before');
    writeFileSync(join(this.repo, 'tests/.keep'), '');
    writeFileSync(join(this.repo, 'source.txt'), 'before');
    writeFileSync(join(this.repo, '.gitignore'), '.env\ngenerated/\n');
    writeFileSync(
      join(this.repo, 'verify.cjs'),
      "const fs=require('fs');if(fs.existsSync('tests/regression.cjs'))require('./tests/regression.cjs');if(fs.readFileSync('source.txt','utf8')==='broken')process.exit(6);",
    );
  }

  /** Writes one fixture component definition as JSON. */
  private declare(id: string, value: unknown): void {
    writeFileSync(join(this.repo, `architecture/components/${id}.json`), JSON.stringify(value));
  }

  /**
   * Declares the containers the fixture's leaves are parented to.
   *
   * The leaves name `package` as their parent, so a catalog without that document cannot load, and
   * every suite built on it reports whatever the assignment code did next rather than the missing
   * component it actually created.
   */
  private containers(): void {
    this.declare('platform', {
      ...containerFields,
      id: 'platform',
      type: 'platform',
      reads: ['.'],
      director: { component: 'sample', profile: 'luna' },
      reviewerProfile: 'luna',
      defaultPackage: 'package',
    });
    this.declare('package', {
      ...containerFields,
      id: 'package',
      type: 'package',
      parentId: 'platform',
      repository: 'sample',
      root: '.',
    });
  }

  /**
   * Declares the leaf that maintains the configuration and root files the fixture commits.
   *
   * Containers own nothing of their own, so their definition files need an owner: this is the same
   * role architecture-maintenance plays in this repository. The list names each path instead of
   * declaring the `architecture` directory, because a folder covering this leaf's own definition -
   * or another leaf's - is refused as a duplicate grant or an ownership overlap.
   */
  private maintainer(): void {
    this.declare('maintainer', {
      ...this.component,
      id: 'maintainer',
      purpose: 'Own shared fixture configuration',
      parentId: 'package',
      owns: [
        '.gitignore',
        'verify.cjs',
        'architecture/operations/verify.yaml',
        'architecture/environment.yaml',
        'architecture/execution-profiles/luna.yaml',
        'architecture/roles/engineer.yaml',
        'architecture/components/platform.json',
        'architecture/components/package.json',
      ],
    });
  }

  /** Declares the one finite check every fixture leaf binds as its verification. */
  private verificationOperation(): void {
    mkdirSync(join(this.repo, 'architecture/operations'), { recursive: true });
    writeFileSync(
      join(this.repo, 'architecture/operations/verify.yaml'),
      JSON.stringify({
        schemaVersion: 4,
        id: 'verify',
        purpose: 'Check the fixture behavior',
        kind: 'command',
        repository: 'sample',
        cwd: '.',
        category: 'unit-test',
        command: 'node',
        args: ['verify.cjs'],
        generatedDirectories: [],
        artifacts: [],
        prerequisites: [],
        network: false,
      }),
    );
  }

  /** Writes component definitions and disposable-output declarations for the fixture workspace. */
  private catalog(): void {
    this.containers();
    this.verificationOperation();
    this.maintainer();
    writeFileSync(
      join(this.repo, 'architecture/components/sample.json'),
      JSON.stringify(this.component),
    );
    this.declare('dependency', {
      ...this.component,
      id: 'dependency',
      purpose: 'Own dependency interface',
      // Two leaves cannot claim one path: overlap is refused, and this leaf exists to be imported by
      // the sample, not to share its write scope.
      owns: ['dependency'],
    });
    writeFileSync(
      join(this.repo, 'architecture/environment.yaml'),
      JSON.stringify({
        schemaVersion: 4,
        workspace: {
          primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
          dependencies: [],
        },
      }),
    );
  }
}
