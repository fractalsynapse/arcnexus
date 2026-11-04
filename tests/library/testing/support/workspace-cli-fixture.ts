import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Portfolio } from '../../../../dist/library/portfolio/portfolio.js';
import { cli } from './workflow-fixture.js';

interface WorkspaceFixtureInput {
  root: string;
  repo: string;
  state: string;
  env: NodeJS.ProcessEnv;
}

/** Exercises package workspace commands with real registrations and isolated application storage. */
export class WorkspaceCliFixture {
  readonly env: NodeJS.ProcessEnv;

  readonly prepareArgs = ['workspace', 'prepare', 'platform/package', '--json'];

  /** Binds captured tools locally and registers committed fixture authority without changing source. */
  constructor(
    private readonly fixture: WorkspaceFixtureInput,
    bindings: string,
  ) {
    const volume = join(fixture.root, 'volume');
    this.env = { ...fixture.env, ARCNEXUS_VOLUME: volume };
    mkdirSync(join(fixture.repo, '.git/arcnexus'), { recursive: true });
    symlinkSync(bindings, join(fixture.repo, '.git/arcnexus/bindings.yaml'));
    const portfolio = new Portfolio(volume, true);
    try {
      portfolio.register('platform', 'platform', fixture.repo);
      portfolio.register('package', 'platform/package', fixture.repo);
    } finally {
      portfolio.close();
    }
  }

  /** Invokes the built gateway from outside the source checkout with no execution-option adapter. */
  command(...args: string[]) {
    return spawnSync(process.execPath, [cli, ...args], {
      cwd: this.fixture.root,
      env: this.env,
      encoding: 'utf8',
      timeout: 30 * 60 * 1000,
    });
  }

  /** Keeps low-level assertions on retained evidence while preparation uses the public command. */
  prepare(...args: string[]) {
    const result = this.command(...this.prepareArgs, ...args);
    if (!result.stdout.trim()) return result;
    const resource = JSON.parse(result.stdout);
    if (!resource.workspace?.id) return result;
    return {
      ...result,
      stdout: readFileSync(
        join(this.fixture.state, 'runs', resource.workspace.id, 'report.json'),
        'utf8',
      ),
    };
  }

  /** Uses package-scoped disposal and leaves its public outcome intact for assertions. */
  cleanup(id: string) {
    return this.command('workspace', 'cleanup', 'platform/package', '--workspace', id, '--json');
  }
}
