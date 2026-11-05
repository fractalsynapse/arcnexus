import type { Component } from '../../../../dist/library/architecture/components.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { OwnerRetrieval } from '../../../../dist/library/task-intake/retrieval.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

/** Checks lexical selection across executable owner types without granting authority. */
class RetrievalTests {
  /** Verifies that task retrieval includes release owners with relevant responsibility. */
  includesRelease(): void {
    const owner: any = {
      id: 'release',
      type: 'release',
      purpose: 'Verify release distribution',
      interfaces: [],
      allowedWritePaths: ['.github/workflows'],
      relatedIds: [],
    };
    const matches = new OwnerRetrieval([owner]).select('Verify release distribution');
    assert.equal(matches[0]?.id, 'release');
    assert.ok(matches[0]!.reasons.some((reason) => reason.includes('release')));
  }

  /** Every relevant owner remains visible even when many components share a responsibility. */
  allMatches(): void {
    const owners = Array.from({ length: 21 }, (_, i) => ({
      id: 'owner-' + i,
      type: 'library',
      purpose: 'Migration',
    }));
    const retrieval = new OwnerRetrieval(owners as Component[]);
    assert.deepEqual(
      retrieval.select('migration').map((entry) => entry.id),
      owners.map((owner) => owner.id).sort((a, b) => a.localeCompare(b)),
    );
    assert.deepEqual(retrieval.select('unrelated'), []);
  }
}

const suite = new RetrievalTests();

test('task retrieval includes release owners with relevant responsibility', () =>
  suite.includesRelease());

test('task retrieval ranks every relevant owner without padding or truncation', () =>
  suite.allMatches());

registerSuite({ component: 'task-intake', level: 'unit', tags: ['deterministic'] });
