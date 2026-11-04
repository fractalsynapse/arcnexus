import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { RefactorCheckpoint } from '../../../../dist/library/assignment/refactor-checkpoint.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises actual new characterization files rather than a preexisting authored file inventory. */
class RefactorCheckpointScenarios {
  /** New owned tests are frozen after passing checks; foreign tests do not enter this owner's evidence. */
  async firstSuite(t: TestContext): Promise<void> {
    const state = this.fixture(t);
    await new RefactorCheckpoint(state).prepare();
    assert.equal(state.specificationFinished, true);
    assert.equal(state.options.record.characterization, true);
    assert.deepEqual(
      state.frozen.map((file: any) => file.path),
      ['tests/unit/new.test.ts'],
    );
    const frozen = JSON.parse(readFileSync(join(state.dir, 'frozen-tests.json'), 'utf8'));
    assert.equal(Buffer.from(frozen[0].content, 'base64').toString(), 'New characterization');
    assert.equal(state.observed, 'characterization-before');
  }

  /** Provides disposable Git discovery and substitutes only the observed command boundary. */
  private fixture(t: TestContext): any {
    const dir = mkdtempSync(join(tmpdir(), 'arcnexus-refactor-sources-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const workspace = join(dir, 'candidate');
    execFileSync('git', ['init', '-q', workspace]);
    mkdirSync(join(workspace, 'tests/unit'), { recursive: true });
    mkdirSync(join(workspace, 'foreign/tests'), { recursive: true });
    writeFileSync(join(workspace, 'tests/unit/new.test.ts'), 'New characterization');
    writeFileSync(join(workspace, 'foreign/tests/other.test.ts'), 'Foreign characterization');
    const state: any = {
      dir,
      options: { record: { workspace }, signal: new AbortController().signal },
      component: { schemaVersion: 6, allowedWritePaths: ['tests'], tests: [], verification: [{}] },
      /** Represents an already validated checked-edit scope. */
      safe() {},
      /** Records the required checkpoint without launching a model or command in this unit case. */
      async checks(_checks: unknown, stage: string) {
        state.observed = stage;
      },
      /** Retains the successful checkpoint in the same in-memory state under test. */
      checkpoint() {},
    };
    return state;
  }
}

test('refactor freezes first new characterization through captured ownership and classification', (t) =>
  new RefactorCheckpointScenarios().firstSuite(t));

registerSuite({
  component: 'assignment',
  level: 'unit',
  tags: ['deterministic', 'specification-admission'],
});
