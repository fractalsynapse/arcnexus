import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { PortfolioStore } from '../../../../dist/library/coordination-store/portfolio-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises real SQLite startup contention without replacing the database implementation. */
class PortfolioConcurrencyScenarios {
  /** Keeps all registry files disposable and isolated from installed portfolio state. */
  private path(t: TestContext): string {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-portfolio-concurrency-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    return join(directory, 'portfolio.sqlite');
  }

  /** A real reader process waits for the writer's short exclusive startup lock and remains read-only. */
  async locked(t: TestContext): Promise<void> {
    const path = this.path(t);
    new PortfolioStore(path, true).close();
    const writer = new DatabaseSync(path);
    writer.exec('PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE');
    const child = this.reader(path),
      closed = once(child, 'close');
    let output = '',
      error = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      error += chunk;
    });
    try {
      await Promise.race([once(child.stdout, 'data'), closed]);
      assert.match(output, /opening/);
      await delay(100);
      writer.exec('COMMIT');
      assert.equal((await closed)[0], 0, error);
      assert.deepEqual(JSON.parse(output.split('\n')[1]!), { rows: [], denied: true });
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL');
      writer.close();
    }
  }

  /** A file created before schema initialization remains an empty read-only view without new tables. */
  empty(t: TestContext): void {
    const path = this.path(t);
    new DatabaseSync(path).close();
    const before = readFileSync(path),
      store = new PortfolioStore(path);
    try {
      assert.deepEqual(store.repositories(), []);
      assert.deepEqual(store.registrations(), []);
      assert.deepEqual(store.materializations(), []);
      assert.deepEqual(readFileSync(path), before);
    } finally {
      store.close();
    }
  }

  /** Launches the built production reader after an observable marker, without a shell or mocked lock. */
  private reader(path: string) {
    const code = `const { PortfolioStore } = await import(process.argv[2]);
      process.stdout.write('opening\\n');
      const store = new PortfolioStore(process.argv[1]);
      let denied = false;
      try { store.transaction('forbidden', () => {}); } catch { denied = true; }
      process.stdout.write(JSON.stringify({ rows: store.repositories(), denied }));
      store.close();`;
    const module = pathToFileURL(
      resolve('dist/library/coordination-store/portfolio-store.js'),
    ).href;
    return spawn(process.execPath, ['--input-type=module', '-e', code, path, module], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
}

const scenarios = new PortfolioConcurrencyScenarios();

test(
  'read-only portfolio startup waits for a short concurrent SQLite lock',
  { timeout: 10000 },
  (t) => scenarios.locked(t),
);

test('uninitialized portfolio files remain empty without read-side schema creation', (t) =>
  scenarios.empty(t));

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic'] });
