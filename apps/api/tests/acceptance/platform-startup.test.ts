import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from 'pg';
import { openPlatform } from '../../../../packages/platform/src/index.js';
import { databaseSetupPlugin } from '../../../db/src/index.js';
import { Context } from 'cordis';
import { createProject } from '../fixtures/project.js';

export const suite = { owner: 'api-app', level: 'acceptance', tags: ['postgresql'] } as const;

const url = process.env.ARC_TEST_DATABASE_URL;
const remote = 'https://github.com/arcnexus-fixtures/read-only.git';

test(
  'API and MCP platform scopes can share the catalog without exposing arbitrary worktrees',
  { skip: !url },
  async (t) => {
    const { token, platform } = await fixture(t);
    const request = new Request('http://arc.test/', {
      headers: { authorization: 'Bearer ' + token },
    });
    const scope = await platform.authenticate(request, 'platform');
    assert.ok(scope);
    const record = await platform.context.catalog.add(scope.principal, { remote });
    const project = await platform.authenticate(request, record.id);
    assert.ok(project);
    assert.equal(await platform.authenticate(request, randomUUID()), undefined);
    assert.equal(
      await platform.authenticate(new Request('http://arc.test/'), record.id),
      undefined,
    );
    assert.equal(
      ((await platform.context.data.invoke(project, 'goals', 'list', {})) as { revision: string })
        .revision,
      record.revision,
    );
  },
);

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'arc-platform-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, 'project');
  mkdirSync(directory);
  createProject(directory, remote);
  const token = randomUUID();
  const file = join(root, 'bindings.json');
  writeFileSync(
    file,
    JSON.stringify({ operator: randomUUID(), projects: [{ directory, remote }] }),
  );
  const database = new Client({ connectionString: url });
  await database.connect();
  t.after(() => database.end());
  const setup = new Context();
  await setup.use(databaseSetupPlugin(database));
  await setup.databaseSetup.migrate();
  const platform = await openPlatform({ database, file, token });
  return { token, platform };
}
