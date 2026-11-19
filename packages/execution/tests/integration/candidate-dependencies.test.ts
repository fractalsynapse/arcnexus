import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DependencyFixture } from '../fixtures/dependencies.js';

const native = { skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1' };

test(
  'confined checks use changed candidate dependencies and retain install evidence',
  native,
  async (t) => {
    const fixture = new DependencyFixture(t);
    const signal = new AbortController().signal;
    const first = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(first.status, 0, readFileSync(first.log, 'utf8'));
    assert.equal(readFileSync(first.log, 'utf8'), '1.0.0\n');
    assert(fixture.unchanged());
    const repeated = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(repeated.log, first.log);
    fixture.update('2.0.0');
    const changed = await fixture.task.check('fixture-check', signal, fixture.scope);
    assert.equal(changed.status, 0, readFileSync(changed.log, 'utf8'));
    assert.equal(readFileSync(changed.log, 'utf8'), '2.0.0\n');
    assert(fixture.unchanged());
    verifyInstalls(fixture);
  },
);

/** Check that actual dependency preparation remains separate from requested test evidence. */
function verifyInstalls(fixture: DependencyFixture) {
  const events = fixture.task.observations<{
    dependencyPreparation?: { status: number; args: string[]; log: string };
  }>();
  const installs = events.flatMap((event) =>
    event.dependencyPreparation ? [event.dependencyPreparation] : [],
  );
  assert.equal(installs.length, 2);
  assert(
    installs.every(
      ({ status, args, log }) =>
        status === 0 &&
        args.includes('--offline') &&
        args.includes('--ignore-scripts') &&
        readFileSync(log, 'utf8').includes('added 1 package'),
    ),
  );
}

test(
  'an inconsistent candidate lock returns the actual prerequisite failure without running the check',
  native,
  async (t) => {
    const fixture = new DependencyFixture(t);
    fixture.mismatch();
    const result = await fixture.task.check(
      'fixture-check',
      new AbortController().signal,
      fixture.scope,
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.command, '/usr/bin/npm');
    assert.equal(result.args[0], 'ci');
    assert.match(result.reason!, /dependency|prerequisite/i);
    assert.match(readFileSync(result.log, 'utf8'), /npm ERR!/);
    assert.doesNotMatch(readFileSync(result.log, 'utf8'), /ambient/);
    assert(fixture.unchanged());
  },
);

test(
  'dependency failure cannot satisfy expected-red and the caller can correct it in the same run',
  native,
  async (t) => {
    const fixture = new DependencyFixture(t);
    fixture.mismatch();
    const scope = { ...fixture.scope, expected: 'fail' as const };
    const failure = await fixture.task.check('fixture-check', new AbortController().signal, scope);
    assert.equal(failure.prerequisite, 'dependencies');
    assert.equal(fixture.task.pendingCheck(scope)?.log, failure.log);
    fixture.update('2.0.0');
    const repaired = await fixture.task.check(
      'fixture-check',
      new AbortController().signal,
      fixture.scope,
    );
    assert.equal(repaired.status, 0, readFileSync(repaired.log, 'utf8'));
    assert.equal(readFileSync(repaired.log, 'utf8'), '2.0.0\n');
    assert(fixture.unchanged());
  },
);

test(
  'interrupted preparation is not reused and restart reconstructs dependencies before checking',
  native,
  async (t) => {
    const fixture = new DependencyFixture(t);
    const controller = new AbortController();
    const checking = fixture.task.check('fixture-check', controller.signal, fixture.scope);
    await delay(1);
    controller.abort();
    await assert.rejects(checking, { name: 'AbortError' });
    assert(fixture.unchanged());
    fixture.restart({
      id: 'fixture-check',
      category: 'build',
      command: '/usr/bin/node',
      network: false,
      args: ['-e', "console.log(require('sample/package.json').version)"],
    });
    const result = await fixture.task.check(
      'fixture-check',
      new AbortController().signal,
      fixture.scope,
    );
    assert.equal(result.status, 0, readFileSync(result.log, 'utf8'));
    assert.equal(readFileSync(result.log, 'utf8'), '1.0.0\n');
    assert(!existsSync(join(fixture.task.worktree!, 'node_modules')));
  },
);
