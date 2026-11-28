import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { stringify } from 'yaml';
import { Architecture } from '../../../architecture/src/index.js';

export const remote = 'https://example.com/commands-ownership.git';

/** Retain a real Git project with immutable authority and independently mutable candidate declarations. */
export class AuditProject {
  readonly root = mkdtempSync(join(tmpdir(), 'commands-ownership-'));
  readonly architecture = new Architecture();
  readonly capture;
  readonly tracked: string[];
  readonly candidatePaths = [
    'shared/first.ts',
    'shared/second.ts',
    'unowned/first.ts',
    'unowned/second.ts',
  ];
  private readonly options = {
    cwd: this.root,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
    },
    stdio: 'pipe' as const,
    encoding: 'utf8' as const,
  };

  /** Commit uniquely owned authority before adding mixed candidate findings and untracked paths. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    this.git('init', '-q');
    this.git('remote', 'add', 'origin', remote);
    this.writeAuthority();
    this.component('alpha', ['.arc', 'contract.md', '.gitignore', 'nested']);
    this.component('beta', ['shared']);
    this.component('zeta', ['other']);
    this.write('.gitignore', 'ignored/\n');
    this.write('nested/consumer.ts', 'export {};\n');
    this.git('add', '.');
    this.git('commit', '-qm', 'Accepted ownership');
    this.capture = this.architecture.capture(this.root);
    this.tracked = [...this.capture.source.paths];
    this.component('alpha', ['.arc', 'contract.md', '.gitignore', 'nested', 'shared']);
    this.component('zeta', ['other', 'shared']);
    for (const path of this.candidatePaths) this.write(path, 'candidate\n');
    this.git('add', '--', 'shared/first.ts');
    this.write('ignored/absent.ts', 'ignored\n');
  }

  /** Supply complete project identity and a genuine locked contract for the immutable capture. */
  private writeAuthority() {
    const contract = '# Fixture authority\n';
    this.write('contract.md', contract);
    this.yaml('.arc/contracts.yaml', {
      contracts: [
        {
          id: 'fixture/project',
          owner: 'alpha',
          file: 'contract.md',
          stage: 'locked',
          digest: createHash('sha256').update(contract).digest('hex'),
          acceptedBy: 'fixture architect',
          acceptedAt: '2026-01-01',
        },
      ],
    });
    this.yaml('.arc/architecture/project.yaml', {
      id: 'commands-ownership',
      remote,
      contractRegistry: '.arc/contracts.yaml',
      planTemplate: 'contract.md',
      director: { component: 'alpha', activity: 'testing' },
      verifier: { component: 'beta', activity: 'testing' },
    });
  }

  /** Declare ownership without granting any activity or provider capability to this read-only scenario. */
  component(id: string, owns: string[]) {
    this.yaml(`.arc/architecture/components/${id}.yaml`, {
      id,
      purpose: `Maintain ${id} resources.`,
      owns,
      activities: {},
    });
  }

  /** Serialize candidate declarations through the same YAML representation as committed declarations. */
  private yaml(path: string, value: unknown) {
    this.write(path, stringify(value));
  }

  /** Materialize authored fixture bytes without touching the caller's project. */
  write(path: string, content: string) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), content);
  }

  /** Execute local Git operations with isolated configuration and captured output. */
  git(...args: string[]): string {
    return execFileSync('git', args, this.options);
  }

  /** Retain all source and Git metadata bytes and timestamps to detect writes or worktree creation. */
  snapshot() {
    return readdirSync(this.root, { recursive: true, encoding: 'utf8' })
      .sort()
      .map((path) => {
        const absolute = join(this.root, path);
        const stat = lstatSync(absolute);
        return {
          path,
          mode: stat.mode,
          modified: stat.mtimeMs,
          content: stat.isFile() ? readFileSync(absolute).toString('base64') : null,
        };
      });
  }
}
