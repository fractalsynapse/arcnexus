import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { executablePath } from '../../../../dist/library/operations/executable.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks host executable selection independently of shell interpolation or a particular Node installation. */
class ExecutableScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-executable-'));

  /** Keeps executable candidates isolated from real machine tool bindings. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    for (const name of ['first', 'second']) mkdirSync(join(this.root, name));
  }

  /** Creates a regular executable marker without ever executing its contents. */
  program(directory: string, name = 'tool'): string {
    const path = join(this.root, directory, name);
    writeFileSync(path, 'captured tool marker', { mode: 0o700 });
    return path;
  }

  /** Uses the first executable match, skipping non-executable files and directories. */
  precedence(): void {
    const first = this.program('first');
    const second = this.program('second');
    const path = ['first', 'second'].map((d) => join(this.root, d)).join(delimiter);
    assert.equal(executablePath('tool', this.root, path), first);
    chmodSync(first, 0o600);
    assert.equal(executablePath('tool', this.root, path), second);
    rmSync(first);
    mkdirSync(first);
    assert.equal(executablePath('tool', this.root, path), second);
  }

  /** Explicit paths ignore PATH shadowing and relative declarations resolve from the operation cwd. */
  explicit(): void {
    const selected = this.program('first');
    this.program('second');
    const path = join(this.root, 'second');
    assert.equal(executablePath(selected, this.root, path), selected);
    assert.equal(executablePath('./tool', join(this.root, 'first'), path), selected);
    symlinkSync(selected, join(this.root, 'alias'));
    assert.equal(executablePath('./alias', this.root, path), join(this.root, 'alias'));
  }

  /** Keeps executable aliases intact for programs whose behavior depends on argv0 or a virtual environment. */
  alias(): void {
    const alias = join(this.root, 'first', 'node-alias');
    symlinkSync(process.execPath, alias);
    const selected = executablePath('node-alias', this.root, join(this.root, 'first'));
    const result = spawnSync(selected, ['-p', 'process.argv0'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), alias);
  }

  /** Missing programs and missing lookup context fail before any sandbox or subprocess is started. */
  missing(): void {
    assert.throws(
      () => executablePath('absent', this.root, this.root),
      /Cannot resolve executable/,
    );
    assert.throws(() => executablePath('tool', this.root, ''), /requires an execution PATH/);
    assert.throws(
      () => executablePath('tool; touch marker', this.root, this.root),
      /Cannot resolve/,
    );
  }
}

test('executable lookup preserves PATH precedence without selecting non-executable entries', (t) =>
  new ExecutableScenario(t).precedence());

test('explicit and relative operation paths retain their declared selection', (t) =>
  new ExecutableScenario(t).explicit());

test('executable aliases preserve their invocation identity', (t) =>
  new ExecutableScenario(t).alias());

test('unresolvable operations fail before dispatch without shell interpretation', (t) =>
  new ExecutableScenario(t).missing());

registerSuite({ component: 'operations', level: 'unit', tags: ['deterministic', 'confinement'] });
