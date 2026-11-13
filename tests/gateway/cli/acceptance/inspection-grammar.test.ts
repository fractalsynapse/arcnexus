import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/**
 * Pins the inspection grammar the activity model requires.
 *
 * Reserved position names live in the component slot, and there is no mode option: `inspect
 * [project] director [activity]` and `inspect [project] verifier [activity]` describe a position
 * addressing the project, while a bare component name addresses that component's steward. A mode
 * flag would put activity selection back into the caller's hands instead of the component's.
 */
class InspectionGrammarScenarios {
  /** A reserved slot resolves to that position's frame for the named activity. */
  reservedSlot(t: any): void {
    const f = new PackageCliFixture(t);
    f.register();
    const result = f.command(
      f.root,
      'inspect',
      'platform/package',
      'director',
      'research',
      '--json',
    );
    assert.equal(result.status, 0, result.stderr);
    const frame = JSON.parse(result.stdout);
    assert.equal(frame.mode, 'director');
    assert.equal(frame.activity, 'research');
    assert.match(String(frame.frame), /Position:/, 'the rendered frame names the position');
  }

  /** `--mode` is not an option the gateway accepts any more. */
  modeOptionRefused(t: any): void {
    const f = new PackageCliFixture(t);
    f.register();
    const result = f.command(f.root, 'inspect', 'sample', '--mode', 'steward');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unsupported inspection option: mode/);
  }

  /** Without an activity the command still lists the catalog index rather than failing. */
  indexView(t: any): void {
    const f = new PackageCliFixture(t);
    f.register();
    const result = f.command(f.root, 'inspect', 'platform/package');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /sample/, 'the index names the project components');
  }
}

const scenarios = new InspectionGrammarScenarios();

test('a reserved position name resolves the director frame', (t) => scenarios.reservedSlot(t));

test('the inspect command refuses the retired --mode option', (t) =>
  scenarios.modeOptionRefused(t));

test('inspection without an activity keeps the catalog index view', (t) => scenarios.indexView(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
