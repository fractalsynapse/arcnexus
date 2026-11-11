import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { createWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';
import type { WorkflowFixture } from '../../testing/support/workflow-fixture.js';

interface HostOwner {
  pid: number;
  start: string;
}

interface StartedHost {
  child: ChildProcess;
  owner: HostOwner;
}

/** Exercises reclamation through built production startup with real exited and live project hosts. */
export class HostStartReclamationScenario {
  private readonly children: ChildProcess[] = [];

  /** Keeps the other project's host alive across startup and always drains fixture hosts before disposal. */
  async run(t: TestContext): Promise<void> {
    const project = generalCatalogFixture(t);
    const other = generalCatalogFixture(t);
    try {
      const earlier = await this.start(project, project.state);
      await this.stop(earlier.child);
      const live = await this.start(other, project.state);
      const abandoned = this.resources(t, project, project.state, earlier.owner, 'failed');
      const prepared = this.resources(t, project, project.state, earlier.owner, 'prepared');
      const protectedResources = this.resources(t, other, project.state, live.owner, 'prepared');
      const evidence = [
        ...abandoned.evidence,
        ...prepared.evidence,
        ...protectedResources.evidence,
      ];
      const before = evidence.map((path) => readFileSync(path, 'utf8'));
      await this.start(project, project.state);
      this.assertStartupResults(abandoned, prepared, protectedResources, evidence, before, project);
    } finally {
      for (const child of this.children.reverse()) await this.stop(child);
    }
  }

  /** Verifies deletion, prepared continuation, live ownership and retained application evidence. */
  private assertStartupResults(
    abandoned: ReturnType<HostStartReclamationScenario['resources']>,
    prepared: ReturnType<HostStartReclamationScenario['resources']>,
    protectedResources: ReturnType<HostStartReclamationScenario['resources']>,
    evidence: string[],
    before: string[],
    project: WorkflowFixture,
  ): void {
    assert.ok(prepared.paths.every(existsSync), 'prepared resources must remain for continuation');
    assert.ok(
      protectedResources.paths.every(existsSync),
      'another live host must retain resources',
    );
    assert.deepEqual(
      evidence.map((path) => readFileSync(path, 'utf8')),
      before,
    );
    assert.deepEqual(
      abandoned.paths.filter(existsSync),
      [],
      'host startup must reclaim abandoned operation scratch, configuration and workspace',
    );
    assert.ok(existsSync(join(project.repo, 'source.txt')));
  }

  /** Starts the built production host entry point and waits for its published readiness identity. */
  private async start(f: WorkflowFixture, root: string): Promise<StartedHost> {
    const context = new ExecutionContext().resolve(f.repo);
    const directory = join(f.repo, '.git', 'arcnexus');
    mkdirSync(directory, { recursive: true });
    const contextFile = join(directory, 'reclamation-context.json');
    const metadata = join(root, 'projects', context.key, 'host.json');
    writeFileSync(contextFile, JSON.stringify(context));
    rmSync(metadata, { force: true });
    const child = spawn(
      process.execPath,
      [
        resolve('dist/library/execution-runtime/host-main.js'),
        root,
        contextFile,
        join(f.root, 'host.sock'),
      ],
      {
        cwd: f.repo,
        env: { ...f.env, ARCNEXUS_STATE_DIR: root },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    this.children.push(child);
    return { child, owner: await this.readiness(child, metadata) };
  }

  /** Observes production readiness and reports launch diagnostics without substituting a fake startup. */
  private async readiness(child: ChildProcess, metadata: string): Promise<HostOwner> {
    let errors = '';
    child.stderr!.on('data', (chunk) => {
      errors += String(chunk);
    });
    for (let observation = 0; observation < 200; observation++) {
      assert.equal(child.exitCode, null, errors);
      if (existsSync(metadata)) {
        const owner = JSON.parse(readFileSync(metadata, 'utf8')) as HostOwner;
        assert.equal(owner.pid, child.pid);
        assert.match(owner.start, /^\d+$/);
        return owner;
      }
      await delay(25);
    }
    throw new Error('Production host did not publish readiness: ' + errors);
  }

  /** Stops only a process launched by this scenario and observes exit before deleting fixture resources. */
  private async stop(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }

  /** Seeds revision-bound clean worktrees and real inode/process identities without invoking cleanup. */
  private resources(
    t: TestContext,
    f: WorkflowFixture,
    root: string,
    owner: HostOwner,
    status: 'failed' | 'prepared',
  ) {
    const context = new ExecutionContext().resolve(f.repo);
    const record = createWorkspace(root, { project: f.repo, bindings: context.bindings });
    f.git('worktree', 'add', '-b', record.branch, record.workspace, record.base);
    const temporary = mkdtempSync(join(tmpdir(), 'arcnexus-op-'));
    const configuration = temporary + '-configuration';
    mkdirSync(configuration);
    t.after(() => {
      rmSync(temporary, { recursive: true, force: true });
      rmSync(configuration, { recursive: true, force: true });
    });
    this.initializeRecord(record, owner, status, temporary, configuration);
    const report = join(root, 'runs', record.id, 'report.json');
    writeFileSync(report, JSON.stringify(record));
    const evidence = this.evidence(root, record.id);
    return { paths: [temporary, configuration, record.workspace], evidence: [report, ...evidence] };
  }

  /** Writes resource identity and settled invocation state consumed by production reclamation. */
  private initializeRecord(
    record: ReturnType<typeof createWorkspace>,
    owner: HostOwner,
    status: 'failed' | 'prepared',
    temporary: string,
    configuration: string,
  ): void {
    record.status = status;
    record.operationTemporaryRoot = temporary;
    record.operationInvocations = [{ id: 'settled-fixture-operation', status: 'completed' }];
    record.workspaceOwnerIdentity = owner;
    record.operationScratchIdentity = {
      id: randomUUID(),
      ownerPid: owner.pid,
      ownerStart: owner.start,
      temporary: this.identity(temporary),
      configuration: this.identity(configuration),
    };
  }

  /** Captures actual filesystem identity so replacement paths cannot accidentally satisfy the fixture. */
  private identity(path: string) {
    const stat = lstatSync(path);
    return { path, device: stat.dev, inode: stat.ino };
  }

  /** Writes representative retained journals and logs outside both disposable scratch directories. */
  private evidence(root: string, id: string): string[] {
    const paths = [
      join(root, 'runs', id, 'invocation.log'),
      join(root, 'private', 'steward', id, 'events.jsonl'),
      join(root, 'projects', 'retained-reports', id + '.md'),
    ];
    for (const path of paths) {
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, 'retained evidence: ' + id);
    }
    return paths;
  }
}
