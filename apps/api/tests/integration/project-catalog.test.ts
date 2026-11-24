import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { operatorMcpHttp, operatorMcpPlugin } from '../../../mcp/src/index.js';
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
    const { url, principal } = await platform(t);
    const selected = await exerciseCatalog(url, principal);
    assert.equal((await fetch(url + '/projects/' + selected, { method: 'DELETE' })).status, 200);
    assert.deepEqual(await (await fetch(url + '/projects')).json(), { entries: [] });
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
  assert.deepEqual(await (await fetch(url + '/projects')).json(), { entries: [project] });
  assert.deepEqual(await (await fetch(url + '/projects/' + project.id + '/reachability')).json(), {
    reachable: true,
    revision,
  });
  const spec = await (await fetch(url + '/projects/platform/openapi.json')).json();
  assert.equal(spec.paths['/projects'].post.operationId, 'projects.create');
  const other = await fetch(url + '/projects', {
    headers: { authorization: principal + '-other' },
  });
  assert.deepEqual(await other.json(), { entries: [] });
  return project.id as string;
}

async function platform(t: TestContext) {
  const client = new Client({ connectionString: databaseUrl });
  const context = await databaseContext(t, client);
  const principal = randomUUID();
  await context.use(dataPlugin(({ scope }) => scope.project === 'platform'));
  let targetRevision = revision;
  await context.use(
    catalogPlugin(
      client,
      verifyProject(principal, () => targetRevision),
    ),
  );
  await context.use(catalogDataPlugin);
  const authenticate = (request: Request, project: string) => ({
    principal: request.headers.get('authorization') ?? principal,
    project,
  });
  const { url, mcp } = await transports(t, context, authenticate);
  return {
    url,
    principal,
    mcp,
    advance() {
      targetRevision = '2'.repeat(40);
    },
  };
}

async function databaseContext(t: TestContext, client: Client) {
  await client.connect();
  t.after(() => client.end());
  const context = new Context();
  await context.use(databaseSetupPlugin(client));
  await context.databaseSetup.migrate();
  return context;
}

function verifyProject(principal: string, revision: () => string) {
  return async (
    { remote, credential }: { remote: string; credential?: string },
    operator: string,
  ) => {
    assert.equal(operator, principal);
    assert.equal(remote, 'https://github.com/example/project.git');
    if (credential !== 'trusted-private-binding') throw new Error('Binding unavailable');
    return { revision: revision(), credential };
  };
}

async function transports(
  t: TestContext,
  context: Context,
  authenticate: (request: Request, project: string) => { principal: string; project: string },
) {
  await context.use(apiPlugin(authenticate));
  const { server, url } = await serveApi(context.api);
  t.after(() => server.close());

  await context.use(operatorMcpPlugin);
  const mcp = await serveApi(operatorMcpHttp(context.operatorMcp, authenticate));
  t.after(() => mcp.server.close());
  return { url, mcp: mcp.url };
}

test(
  'REST and MCP conditional catalog updates compete on the same revision',
  { skip: !databaseUrl },
  async (t) => {
    const { url, principal, advance, mcp } = await platform(t);
    const id = await exerciseCatalog(url, principal);
    advance();
    const client = new McpClient({ name: 'catalog-race', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(mcp + '/projects/platform/mcp')),
    );
    t.after(() => client.close());
    const [rest, tooling] = await Promise.all([
      fetch(url + '/projects/' + id, {
        method: 'PATCH',
        headers: { 'if-match': '"' + revision + '"' },
      }),
      client.callTool({ name: 'refresh_project', arguments: { id, expectedRevision: revision } }),
    ]);
    assert.equal(Number(rest.ok) + Number(tooling.isError !== true), 1);
    const result = await fetch(url + '/projects/' + id);
    assert.equal((await result.json()).revision, '2'.repeat(40));
  },
);
