import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { executeDirect } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises actual child output rather than manufacturing operation log evidence. */
class CommandOutputFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-command-output-'));

  readonly log = join(this.root, 'combined.log');

  readonly stdout = join(this.root, 'stdout');

  readonly stderr = join(this.root, 'stderr');

  readonly controller = new AbortController();

  /** Removes only private fixture files and cancels any still-owned child when a scenario fails. */
  constructor(t: TestContext) {
    t.after(() => {
      this.controller.abort(new Error('Cancelled fixture'));
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Uses regular child descriptors, including separate streams, through the production executor. */
  run(program: string) {
    return executeDirect(
      { command: process.execPath, args: ['-e', program] },
      this.root,
      this.log,
      this.controller.signal,
      { fileOutput: true, stdout: this.stdout, stderr: this.stderr },
    );
  }
}

test('regular-file execution preserves complete structured stdout alongside stderr warnings', async (t) => {
  const f = new CommandOutputFixture(t);
  const result = await f.run(`
    console.log(JSON.stringify({content:'large-content-'.repeat(3000)}));
    console.error('diagnostic warning');
  `);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdoutLog, f.stdout);
  assert.equal(JSON.parse(readFileSync(f.stdout, 'utf8')).content, 'large-content-'.repeat(3000));
  const stderr = readFileSync(f.stderr, 'utf8');
  assert.match(stderr, /diagnostic warning\n/);
  const combined = readFileSync(f.log, 'utf8');
  assert.ok(combined.includes(readFileSync(f.stdout, 'utf8')));
  assert.ok(combined.includes(stderr));
});

test(
  'regular-file output retains partial separate streams on cancellation',
  { timeout: 5000 },
  async (t) => {
    const f = new CommandOutputFixture(t);
    const failure = assert.rejects(
      f.run(`
    const fs=require('fs');fs.writeSync(2,'warning');fs.writeSync(1,'ready');
    setInterval(()=>{},1000);
  `),
      /Cancelled/,
    );
    while (!statSync(f.stdout).size) await delay(10);
    f.controller.abort(new Error('Cancelled test'));
    await failure;
    assert.equal(readFileSync(f.stdout, 'utf8'), 'ready');
    const stderr = readFileSync(f.stderr, 'utf8');
    assert.match(stderr, /warning/);
    assert.match(readFileSync(f.log, 'utf8'), /ready/);
    assert.ok(readFileSync(f.log, 'utf8').includes(stderr));
  },
);

test('separate regular-file capture enforces the existing combined output transport bound', async (t) => {
  const f = new CommandOutputFixture(t);
  await assert.rejects(
    f.run(`
    require('fs').writeSync(1,Buffer.alloc(65*1024*1024,120));
  `),
    /output limit exceeded/,
  );
  assert.ok(statSync(f.log).size <= 64 * 1024 * 1024);
  assert.ok(statSync(f.stdout).size <= 64 * 1024 * 1024);
});

registerSuite({ component: 'operations', level: 'unit', tags: ['deterministic', 'evidence'] });
