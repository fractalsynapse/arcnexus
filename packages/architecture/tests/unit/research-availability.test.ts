import assert from 'node:assert/strict';
import test from 'node:test';
import { Architecture, canResearch, type Capture } from '../../src/index.js';

/** Supply only the explicit declaration fields consumed by research capability resolution. */
function researchCapture(operations: string[] | undefined, extra: Record<string, unknown> = {}) {
  return {
    project: {},
    components: {
      worker: {
        id: 'worker',
        activities: {
          research: { profile: 'model', operations, ...extra },
        },
      },
    },
    operations: {
      read: { kind: 'tool', tool: 'read' },
      list: { kind: 'tool', tool: 'list' },
      edit: { kind: 'tool', tool: 'edit' },
      check: { kind: 'tool', tool: 'check' },
      command: { command: 'node', tool: 'read' },
    },
  } as unknown as Capture;
}

for (const operations of [[], ['read', 'list']]) {
  test(`model research admits declared read-only mappings: ${JSON.stringify(operations)}`, () => {
    assert.equal(canResearch(researchCapture(operations), 'worker'), true);
  });
}

for (const operations of [undefined, ['missing'], ['edit'], ['check'], ['command']]) {
  test(`research refuses unmapped or effectful operations: ${JSON.stringify(operations)}`, () => {
    const capture = researchCapture(operations);
    assert.equal(canResearch(capture, 'worker'), false);
    assert.throws(
      () => new Architecture().request(capture, { component: 'worker', activity: 'research' }),
      /read-only/,
    );
  });
}

test('research requires a model profile and refuses command executors', () => {
  assert.equal(canResearch(researchCapture([], { executor: 'host' }), 'worker'), false);
  assert.equal(canResearch(researchCapture([], { profile: undefined }), 'worker'), false);
  assert.equal(canResearch(researchCapture([]), 'missing'), false);
});
