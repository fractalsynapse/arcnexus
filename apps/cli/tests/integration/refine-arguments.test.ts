import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

/** Exercise the built entry point without a project or access to a provider. */
class RefineArguments {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-refine-args-'));

  /** Invoke the real executable from an isolated directory. */
  run(args: string[]) {
    return spawnSync(process.execPath, [cli, ...args], {
      cwd: this.directory,
      encoding: 'utf8',
    });
  }

  /** Remove the isolated directory after the scenario. */
  close() {
    rmSync(this.directory, { recursive: true, force: true });
  }
}

test('GW-29: refinement accepts default and positive rounds with either JSON placement', (t) => {
  const scenario = new RefineArguments();
  t.after(() => scenario.close());
  for (const args of [
    ['refine'],
    ['refine', '--rounds', '2'],
    ['--json', 'refine', '--rounds', '9007199254740992'],
    ['refine', '--rounds', '3', '--json'],
  ]) {
    const result = scenario.run(args);
    assert.equal(result.error, undefined, args.join(' '));
    assert.doesNotMatch(result.stderr, /Command unavailable|Usage: arcnexus refine/, args.join(' '));
  }
});

test('GW-29: malformed refinement arguments fail before admission', (t) => {
  const scenario = new RefineArguments();
  t.after(() => scenario.close());
  for (const args of [
    ['refine', '--rounds'],
    ['refine', '--rounds', '0'],
    ['refine', '--rounds', '-1'],
    ['refine', '--rounds', '1.5'],
    ['refine', '--rounds', 'abc'],
    ['refine', '--rounds', '1', '--rounds', '2'],
    ['refine', '--json', '--rounds', '1'],
    ['--json', 'refine', '--json'],
    ['refine', 'extra'],
    ['refine', '--other'],
  ]) {
    const result = scenario.run(args);
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.stdout, '', args.join(' '));
    assert.match(result.stderr, /Usage: arcnexus refine|Use --json once/, args.join(' '));
  }
});
