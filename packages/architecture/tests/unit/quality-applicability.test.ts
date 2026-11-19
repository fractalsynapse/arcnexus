import assert from 'node:assert/strict';
import test from 'node:test';
import { Architecture, type Capture } from '../../src/index.js';
import { Agent } from '../../../agent/src/index.js';

/** Create an isolated captured activity without changing the real catalog. */
function fixture(operation: Record<string, unknown>): Capture {
  return {
    source: { revision: 'base', paths: [], read: () => '' },
    project: {
      id: 'fixture',
      director: { component: 'other', activity: 'planning' },
      verifier: { component: 'other', activity: 'review' },
      contractRegistry: 'registry.yaml',
    },
    components: {
      sample: {
        id: 'sample',
        purpose: 'Fixture',
        owns: ['packages/sample'],
        activities: {
          testing: {
            role: 'designer',
            profile: 'test',
            instructions: [],
            standards: [],
            operations: ['quality'],
          },
        },
      },
    },
    roles: { designer: { id: 'designer' } },
    profiles: {
      test: { id: 'test', model: 'fixture', reasoning: 'low', webSearch: 'disabled', operationCategories: ['check'] },
    },
    operations: { quality: { id: 'quality', category: 'check', ...operation } },
    standards: {},
    contracts: [],
  } as unknown as Capture;
}

const selection = { component: 'sample', activity: 'testing' };
const check = { tool: 'check', command: 'npm', args: ['run', 'format:check', { context: 'owner' }] };

for (const applicability of ['owner-format-files', 'owner-lint-files']) {
  test(`public request accepts ${applicability} for a bound check`, () => {
    const capture = fixture({ ...check, applicability });
    const before = structuredClone(capture.operations);
    const request = new Architecture().request(capture, selection);
    assert.equal(request.request.options.tools[0]?.name, 'quality');
    assert.deepEqual(capture.operations, before);
  });
}

test('public request rejects an invalid applicability declaration', () => {
  assert.throws(() =>
    new Architecture().request(fixture({ ...check, applicability: 'owner-unknown-files' }), selection),
  );
});

test('public request rejects a check without an implementation', () => {
  assert.throws(() =>
    new Architecture().request(fixture({ tool: 'check', applicability: 'owner-format-files' }), selection),
  );
});

test('public request rejects an unavailable handler', () => {
  assert.throws(() =>
    new Architecture().request(fixture({ ...check, tool: 'missing' }), selection),
  );
});

test('public request rejects an unresolved operation', () => {
  const capture = fixture(check);
  const operations = { ...capture.operations };
  delete operations.quality;
  assert.throws(() => new Architecture().request({ ...capture, operations }, selection));
});
