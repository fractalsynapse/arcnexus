import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Context } from 'cordis';
import { dataPlugin } from '../../../data/src/index.js';
import { coordinationDataPlugin, coordinationPlugin } from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const scope = { project: 'one', principal: 'operator' };
const remote = 'https://example.com/one.git';

test('the Data timeline exposes complete replay and refuses foreign cursors', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-data-timeline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const context = new Context();
  await context.use(coordinationPlugin(root));
  await context.use(dataPlugin(() => true));
  await context.use(coordinationDataPlugin(() => remote));
  const journal = context.coordination.admit(remote, 'Plan');
  assert.ok('record' in journal);
  t.after(() => journal.close());
  const { taskID: execution, sequence } = journal.record({
    message: 'Complete Planner observation',
  });
  const through = { project: scope.project, execution, sequence };
  assert.deepEqual(
    await context.data.invoke(scope, 'execution-events', 'read', { execution, after: through }),
    {
      events: [],
      through,
    },
  );
  await assert.rejects(
    context.data.invoke({ ...scope, project: 'two' }, 'execution-events', 'read', {
      execution,
      after: through,
    }),
    /cursor/,
  );
  assert.equal((await context.data.describe(scope))[0]?.resource, 'execution-events');
});
