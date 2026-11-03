import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RunQueryFixture } from '../support/run-query-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { WorkspaceResources } from '../../../../dist/library/workspace/workspace.js';

/** Retains workspace receipts without starting an execution host or requiring source availability. */
class WorkspaceQueryScenarios {
  /** Empty discovery is usable from an unrelated directory without creating application state. */
  empty(f: RunQueryFixture): void {
    assert.deepEqual(f.value('workspace', 'list').items, []);
    assert.equal(existsSync(f.state), false);
    assert.equal(f.command('workspace', 'get', '../escape').status, 2);
  }

  /** Reads expose stable revisions and retained events, excluding private harness and binding content. */
  retained(f: RunQueryFixture): void {
    const path = this.seed(f, 'first');
    const before = readFileSync(path);
    const first = f.value('workspace', 'get', 'first');
    assert.equal(first.workspace.id, 'first');
    assert.equal(first.workspace.status, 'prepared');
    assert.equal(first.workspace.packageId, 'package-a');
    assert.equal(first.events.length, 1);
    assert.equal(first.cursor, 1);
    assert.equal(JSON.stringify(first).includes('private-secret'), false);
    assert.equal(f.value('workspace', 'get', 'first').revision, first.revision);
    assert.deepEqual(readFileSync(path), before);
    const service = new WorkspaceResources(f.state);
    assert.equal(service.list({ source: '/source', packageId: 'package-a' }).items.length, 1);
    assert.equal(service.list({ source: '/source', packageId: 'other' }).items.length, 0);
    assert.equal(service.get('first', 1).events.length, 0);
  }

  /** An observer detaches without rewriting retained work, even when there are no new events. */
  async follow(f: RunQueryFixture): Promise<void> {
    const path = this.seed(f, 'first'),
      before = readFileSync(path);
    const child = spawn(
      process.execPath,
      [f.cli, 'workspace', 'get', 'first', '--follow', '--after', '1', '--json'],
      {
        cwd: f.root,
        env: f.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const exit = once(child, 'exit');
    try {
      const output = await Promise.race([once(child.stdout, 'data'), exit]);
      assert.ok(Buffer.isBuffer(output[0]), 'Follower must present retained workspace state');
      assert.deepEqual(JSON.parse(String(output[0])).events, []);
      child.kill('SIGINT');
      assert.equal((await exit)[0], 0);
      assert.deepEqual(readFileSync(path), before);
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }

  /** Pagination/search operate on workspace receipts, never on operation-only working directories. */
  listed(f: RunQueryFixture): void {
    this.seed(f, 'first');
    this.seed(f, 'second');
    this.seed(f, 'operation', '/source');
    const page = f.value('workspace', 'list', '--limit', '1');
    assert.equal(page.items[0].id, 'first');
    const next = f.value('workspace', 'list', '--limit', '1', '--cursor', page.nextCursor);
    assert.deepEqual(
      next.items.map((item: any) => item.id),
      ['second'],
    );
    assert.equal(next.nextCursor, null);
    assert.equal(f.value('workspace', 'list', '--search', 'SECOND').items.length, 1);
    assert.equal(f.command('workspace', 'get', 'operation').status, 2);
    assert.equal(f.command('workspace', 'list', '--model', 'override').status, 2);
  }

  /** Historical membership comes from captured preparation context and remains unknown when absent. */
  membership(f: RunQueryFixture): void {
    const path = this.seed(f, 'first');
    const record = JSON.parse(readFileSync(path, 'utf8'));
    delete record.packageId;
    record.operationCatalog = [
      { id: 'package-a', type: 'package', parentId: 'platform' },
      { id: 'nested', type: 'package', parentId: 'package-a' },
      { id: 'other', type: 'package', parentId: 'platform' },
    ];
    record.preparationOwners = ['package-a', 'nested'];
    writeFileSync(path, JSON.stringify(record));
    assert.equal(f.value('workspace', 'get', 'first').workspace.packageId, 'package-a');
    delete record.preparationOwners;
    writeFileSync(path, JSON.stringify(record));
    assert.equal(f.value('workspace', 'get', 'first').workspace.packageId, null);
  }

  /** Models the persisted production receipt shape, including data that must never reach query output. */
  private seed(f: RunQueryFixture, id: string, workspace = join(f.state, 'workspaces', id)) {
    const directory = join(f.state, 'runs', id);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'report.json');
    writeFileSync(
      path,
      JSON.stringify({
        id,
        workspace,
        source: '/source',
        base: 'revision',
        branch: 'branch-' + id,
        status: 'prepared',
        startedAt: '2026-01-01T00:00:00Z',
        packageId: 'package-a',
        bindings: { token: 'private-secret' },
        turns: ['private-secret'],
      }),
    );
    this.timeline(directory, id);
    return path;
  }

  /** Retains a real timeline shape whose private payload must be omitted from public reads. */
  private timeline(directory: string, id: string): void {
    writeFileSync(
      join(directory, 'timeline.jsonl'),
      JSON.stringify({
        schemaVersion: 1,
        sequence: 1,
        runId: id,
        observedAt: '2026-01-01T00:00:00Z',
        type: 'workspace.prepared',
        payload: { private: 'private-secret' },
      }) + '\n',
    );
  }
}

const scenarios = new WorkspaceQueryScenarios();

test('workspace discovery does not create state or require a checkout', (t) =>
  scenarios.empty(new RunQueryFixture(t)));

test('workspace resource reads preserve receipts and omit private evidence', (t) =>
  scenarios.retained(new RunQueryFixture(t)));

test('workspace lists paginate managed resources and exclude operation receipts', (t) =>
  scenarios.listed(new RunQueryFixture(t)));

test('workspace membership derives only from captured package context', (t) =>
  scenarios.membership(new RunQueryFixture(t)));

test('workspace followers detach without cancelling retained work', { timeout: 15000 }, (t) =>
  scenarios.follow(new RunQueryFixture(t)),
);

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'resources'] });
