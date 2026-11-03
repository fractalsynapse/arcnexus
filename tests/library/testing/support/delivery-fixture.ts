import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { DeliveryGit } from '../../../../dist/library/operations/delivery-git.js';
import { git } from '../../../../dist/library/operations/process.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import { LifecycleStore } from '../../../../dist/library/coordination-store/lifecycle-store.js';
import { UpstreamExecution } from '../../../../dist/library/operations/upstream-execution.js';
import type { RepositoryMaterialization } from '../../../../dist/library/architecture/bindings.js';

/** Exercises actual supervised commit/push against private Git repositories with controlled delivery authority. */
export class GitDeliveryFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-delivery-git-'));

  readonly store = new DeliveryStore(join(this.root, 'deliveries.sqlite'));

  readonly effects = new LifecycleStore(join(this.root, 'effects.sqlite'));

  readonly id = 'a'.repeat(64);

  readonly signal = new AbortController().signal;

  readonly repository: RepositoryMaterialization;

  readonly provider: DeliveryGit;

  readonly executor: UpstreamExecution;

  private readonly authority = {
    environmentId: 'sim',
    runId: 'run',
    authorityDigest: 'authority',
    grants: ['delivery.commit', 'delivery.push'].map((operation) => ({
      operation,
      target: 'repo',
      definitionDigest: 'policy',
    })),
  };

  /** Creates isolated source/remotes and binds the production transport to explicit test authority. */
  constructor(t: TestContext) {
    t.after(() => {
      this.store.close();
      this.effects.close();
      rmSync(this.root, { recursive: true, force: true });
    });
    this.repository = this.repositories();
    const delivery = this.capture();
    this.provider = new DeliveryGit(delivery, 'repo', this.repository, join(this.root, 'evidence'));
    this.effects.register({
      id: 'sim',
      mode: 'simulation',
      repositoryId: 'repo',
      providerId: 'provider',
      authorityDigest: 'authority',
    });
    this.executor = new UpstreamExecution(
      this.effects,
      {
        id: 'provider',
        mode: 'simulation',
        apply: (effect, signal) => this.provider.apply(effect, signal),
        inspect: async (effect) => this.provider.inspect(effect),
      },
      this.authority,
    );
  }

  /** Creates local repository identity without any reachable external upstream. */
  private repositories(): RepositoryMaterialization {
    const source = join(this.root, 'source'),
      origin = join(this.root, 'remote.git');
    mkdirSync(source);
    git(source, 'init', '-q', '-b', 'staging');
    writeFileSync(join(source, 'source.txt'), 'before');
    git(source, 'add', '.');
    git(
      source,
      '-c',
      'user.name=Acceptance',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'baseline',
    );
    const base = git(source, 'rev-parse', 'HEAD').trim();
    git(source, 'clone', '--bare', '--no-local', source, origin);
    git(origin, 'remote', 'remove', 'origin');
    git(source, 'remote', 'add', 'origin', origin);
    return {
      source,
      origin,
      base,
      commonDir: join(source, '.git'),
      repository: 'https://example.invalid/repo.git',
    };
  }

  /** Pins real candidate bytes while keeping synthetic verification confined to this transport acceptance fixture. */
  private capture() {
    writeFileSync(join(this.repository.source, 'source.txt'), 'reviewed candidate');
    const candidate = new CandidateSnapshots(
      this.repository.source,
      join(this.root, 'snapshots'),
    ).capture(this.repository.source, this.repository.base);
    git(this.repository.source, 'restore', 'source.txt');
    return this.store.capture({
      id: this.id,
      projectId: 'project',
      packageId: 'package',
      runId: 'run',
      assignmentIds: ['assignment'],
      environment: { id: 'sim', mode: 'simulation' },
      authorityDigest: 'authority',
      base: this.repository.base,
      candidate,
      verification: { references: ['controlled-review'], digest: 'controlled-digest' },
      target: { repository: 'repo', branch: 'staging' },
    });
  }

  /** Uses a stable host intent key for each actual Git effect. */
  execute(operation: string) {
    return this.executor.execute(
      operation,
      operation,
      'repo',
      { deliveryId: this.id },
      this.signal,
    );
  }
}
