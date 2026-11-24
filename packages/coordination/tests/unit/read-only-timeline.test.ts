import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Coordination } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const remote = 'https://example.com/first.git';
const other = 'https://example.com/other.git';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-read-timeline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, coordination: new Coordination(root) };
}

test('unobserved projects return an empty timeline without initializing storage', (t) => {
  const { root, coordination } = fixture(t);
  assert.deepEqual(coordination.readTaskTimeline(remote, 'missing'), { events: [] });
  assert.deepEqual(readdirSync(root), []);
});

test('replay reads a consistent window of retained descendants during an active writer', (t) => {
  const { coordination } = fixture(t);
  const parent = coordination.admit(remote, 'Parent');
  assert.ok('record' in parent);
  const opened = parent.record({ message: 'Opening' });
  const child = parent.child('Plan', 'plan');
  assert.ok(child && 'record' in child);
  const tool = child.record({ tool: 'list-files' });
  const bounded = coordination.readTaskTimeline(remote, parent.taskID);
  const result = child.record({ toolResult: 'complete' });
  assert.equal(bounded.through, tool.sequence);
  assert.deepEqual(
    coordination.readTaskTimeline(remote, parent.taskID, {
      after: opened.sequence,
      through: bounded.through,
    }).events,
    [tool],
  );
  assert.deepEqual(
    coordination.readTaskTimeline(remote, parent.taskID, { after: bounded.through }).events,
    [result],
  );
  assert.deepEqual(coordination.admit(remote, 'Competing task'), {
    activeGoal: 'Parent',
    run: parent.run,
  });
  parent.close();
});

test('cursor validation bounds replay to the requested project and logical task', (t) => {
  const { coordination } = fixture(t);
  const parent = coordination.admit(remote, 'Parent');
  assert.ok('record' in parent);
  const opened = parent.record({ message: 'Opening' });
  const child = parent.child('Plan', 'plan');
  assert.ok(child && 'record' in child);
  assert.throws(
    () => coordination.readTaskTimeline(remote, child.taskID, { after: opened.sequence }),
    /cursor/,
  );
  assert.throws(
    () => coordination.readTaskTimeline(other, parent.taskID, { after: opened.sequence }),
    /cursor/,
  );
  assert.throws(
    () => coordination.readTaskTimeline(remote, parent.taskID, { after: '01' }),
    /cursor/,
  );
  parent.close();
});
