import assert from 'node:assert/strict';
import test from 'node:test';
import { Context } from 'cordis';
import { z } from 'zod';
import { dataOperation, dataPlugin, type DataResource } from '../../src/index.js';

export const suite = { owner: 'data', level: 'unit', tags: ['regression'] } as const;

const scope = { principal: 'operator', project: 'project-a' };
const records = {
  id: 'objectives',
  operations: {
    read: dataOperation(
      z.strictObject({ id: z.string() }),
      z.strictObject({ id: z.string(), project: z.string() }),
      (context, { id }) => ({ id, project: context.project }),
    ),
  },
} satisfies DataResource;

test('Cordis exposes the owner operation and its schema under the same authorized scope', async () => {
  const context = new Context();
  await context.use(dataPlugin((request) => request.scope.project === scope.project));
  const dispose = context.data.register(records);
  const read = await context.data.invoke(scope, records.id, 'read', { id: 'first' });
  assert.deepEqual(read, { id: 'first', project: 'project-a' });
  const description = await context.data.describe(scope);
  assert.deepEqual(
    description.map(({ resource, operation }) => [resource, operation]),
    [['objectives', 'read']],
  );
  assert.equal(description[0]?.input.type, 'object');
  await assert.rejects(
    context.data.invoke({ ...scope, project: 'project-b' }, records.id, 'read', { id: 'first' }),
    /not authorized/,
  );
  assert.deepEqual(await context.data.describe({ ...scope, project: 'project-b' }), []);
  assert.throws(() => context.data.register(records), /already registered/);
  dispose();
  await assert.rejects(
    context.data.invoke(scope, records.id, 'read', { id: 'first' }),
    /unavailable/,
  );
});

test('invalid requests and owner results fail their shared schemas', async () => {
  const context = new Context();
  await context.use(dataPlugin(() => true));
  context.data.register(records);
  await assert.rejects(
    context.data.invoke(scope, records.id, 'read', { id: 1 }),
    /expected string/,
  );
  context.data.register({
    id: 'invalid',
    operations: { read: dataOperation(z.unknown(), z.string(), () => 1 as unknown as string) },
  });
  await assert.rejects(context.data.invoke(scope, 'invalid', 'read', null), /expected string/);
});
