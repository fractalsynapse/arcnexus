import assert from 'node:assert/strict';
import test from 'node:test';
import { team } from '../../../team/src/index.js';
import { validateCapture, type Capture } from '../../src/index.js';
import { OwnershipProject, collisionPaths, uncoveredPaths } from './ownership-project.js';

export const suite = { owner: 'architecture', level: 'integration', tags: ['regression'] } as const;

/** Read the caller-visible refusal while rejecting success and non-ownership setup errors. */
function ownershipDiagnostic(capture: Capture): string {
  let diagnostic: string | undefined;
  assert.throws(
    () => validateCapture(capture),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      diagnostic = error.message;
      assert.match(diagnostic, /Architecture ownership/);
      return true;
    },
  );
  assert.ok(diagnostic);
  return diagnostic;
}

/** Check independent expected paths and owner identities without prescribing error punctuation. */
function assertComplete(diagnostic: string, paths: readonly string[], owners: readonly string[]) {
  for (const path of paths)
    assert.ok(diagnostic.includes(path), `Missing path ${path}: ${diagnostic}`);
  for (const id of owners)
    assert.match(diagnostic, new RegExp(`\\b${id}\\b`), `Missing owner ${id}: ${diagnostic}`);
}

test('ARC-3: uniquely owned committed inventory passes the complete public validator', (t) => {
  const { capture } = new OwnershipProject(t, 'unique');
  const before = JSON.stringify(capture);
  assert.doesNotThrow(() => validateCapture(capture));
  assert.doesNotThrow(() => validateCapture(capture));
  assert.equal(JSON.stringify(capture), before);
});

test('ARC-3: ownership refusal names every uncovered maintained resource', (t) => {
  const { capture } = new OwnershipProject(t, 'uncovered');
  assertComplete(ownershipDiagnostic(capture), uncoveredPaths, []);
});

test('ARC-4: each collision names all owners, including the owner without Testing', (t) => {
  const { capture } = new OwnershipProject(t, 'collisions');
  assert.deepEqual(
    team.list(capture.components, { activity: 'testing' }).map(({ id }) => id),
    ['alpha', 'zeta'],
  );
  for (const path of collisionPaths) {
    const singleResource = { ...capture, source: { ...capture.source, paths: [path] } };
    assertComplete(ownershipDiagnostic(singleResource), [path], ['alpha', 'beta', 'zeta']);
  }
  assertComplete(ownershipDiagnostic(capture), collisionPaths, ['alpha', 'beta', 'zeta']);
});

test('ARC-3/ARC-4: one refusal retains uncovered resources and every collision together', (t) => {
  const { capture } = new OwnershipProject(t, 'mixed');
  const diagnostic = ownershipDiagnostic(capture);
  assertComplete(diagnostic, [...collisionPaths, ...uncoveredPaths], ['alpha', 'beta', 'zeta']);
  assert.match(diagnostic, /unowned/);
  assert.match(diagnostic, /collision/);
});

test('ARC-7/ARC-16: unchanged capture diagnostics and definitions remain identical across calls', (t) => {
  const { capture } = new OwnershipProject(t, 'mixed');
  const before = JSON.stringify(capture);
  const first = ownershipDiagnostic(capture);
  assert.equal(ownershipDiagnostic(capture), first);
  assert.equal(ownershipDiagnostic(capture), first);
  assert.equal(JSON.stringify(capture), before);
  assert.ok(Object.isFrozen(capture.source.paths));
  for (const component of Object.values(capture.components)) {
    assert.ok(Object.isFrozen(component));
    assert.ok(Object.isFrozen(component.owns));
  }
});
