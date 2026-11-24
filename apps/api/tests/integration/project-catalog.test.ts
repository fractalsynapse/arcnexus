import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Context } from 'cordis';
import { Client } from 'pg';
import { catalogDataPlugin, catalogPlugin } from '../../../../packages/catalog/src/index.js';
import { dataPlugin } from '../../../../packages/data/src/index.js';
import { databaseSetupPlugin } from '../../../db/src/index.js';
import { apiPlugin, serveApi } from '../../src/index.js';

export const suite = { owner: 'api-app', level: 'integration', tags: ['postgresql'] } as const;

const databaseUrl = process.env.ARC_TEST_DATABASE_URL;
const revision = '1'.repeat(40);

test(
  'an operator imports a checked GitHub project and removal retires its selection',
  { skip: !databaseUrl },
  async (t) => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    t.after(() => client.end());
    const context = new Context();
    const principal = randomUUID();
    await context.use(databaseSetupPlugin(client));
    await context.databaseSetup.migrate();
    await context.use(dataPlugin(({ scope }) => scope.project === 'platform'));
    await context.use(
      catalogPlugin(client, async ({ remote, credential }, operator) => {
        assert.equal(operator, principal);
        assert.equal(remote, 'https://github.com/example/project.git');
        if (credential !== 'trusted-private-binding') throw new Error('Binding unavailable');
        return revision;
      }),
    );
    await context.use(catalogDataPlugin);
    await context.use(
      apiPlugin((request, project) => ({
        principal: request.headers.get('authorization') ?? principal,
        project,
      })),
    );
    const { server, url } = await serveApi(context.api);
    t.after(() => server.close());
    const selected = await exerciseCatalog(url, principal);
    assert.equal((await fetch(url + '/projects/' + selected, { method: 'DELETE' })).status, 200);
    assert.deepEqual(await (await fetch(url + '/projects')).json(), []);
  },
);

async function exerciseCatalog(url: string, principal: string) {
  const request = (remote: string, credential: string) =>
    fetch(url + '/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ remote, credential }),
    });
  assert.equal(
    (await request('https://example.com/example/project.git', 'trusted-private-binding')).status,
    400,
  );
  assert.equal((await request('https://github.com/example/project.git', 'wrong')).status, 409);
  const response = await request('https://github.com/example/project', 'trusted-private-binding');
  assert.equal(response.status, 201);
  const project = await response.json();
  assert.equal(project.revision, revision);
  assert.equal(project.credential, undefined);
  assert.deepEqual(await (await fetch(url + '/projects')).json(), [project]);
  const spec = await (await fetch(url + '/projects/platform/openapi.json')).json();
  assert.equal(spec.paths['/projects'].post.operationId, 'projects.create');
  const other = await fetch(url + '/projects', {
    headers: { authorization: principal + '-other' },
  });
  assert.deepEqual(await other.json(), []);
  return project.id as string;
}
