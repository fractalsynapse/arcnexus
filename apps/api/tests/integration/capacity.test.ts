import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import { Context } from 'cordis';
import { Client } from 'pg';
import { capacityPlugin } from '../../../../packages/capacity/src/index.js';
import { databaseSetupPlugin } from '../../../db/src/index.js';
import { launcherPlugin } from '../../../launcher/src/index.js';
import { capacityApiPlugin, serveApi } from '../../src/index.js';

export const suite = { owner: 'api-app', level: 'integration', tags: ['postgresql'] } as const;

const databaseUrl = process.env.ARC_TEST_DATABASE_URL;

async function platform(t: TestContext) {
  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  t.after(() => database.end());
  const context = new Context();
  const operator = randomUUID();
  await context.use(databaseSetupPlugin(database));
  await context.databaseSetup.migrate();
  await context.use(capacityPlugin(database));
  await context.use(
    capacityApiPlugin((request) => request.headers.get('authorization') ?? undefined),
  );
  await context.use(launcherPlugin);
  const { url, server } = await serveApi(context.capacityApi);
  t.after(() => server.close());
  const request = (path: string, method: string, body?: object, identity: string = operator) =>
    fetch(url + path, {
      method,
      headers: { authorization: identity, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });
  return { url, request, launcher: context.launcher };
}

test(
  'one code enrolls a launcher and only its operator can admit or revoke it',
  { skip: !databaseUrl },
  async (t) => {
    const { url, request, launcher } = await platform(t);
    const root = '/capacity-providers';
    assert.equal((await fetch(url + root)).status, 401);
    const issued = await request(root + '/codes', 'POST');
    assert.equal(issued.status, 201);
    const { code } = (await issued.json()) as { code: string };
    const results = await Promise.allSettled(
      [1, 2].map(() => launcher.enroll(url, code, 'Fixture', 'Linux')),
    );
    const enrolled = results.filter((result) => result.status === 'fulfilled');
    assert.equal(enrolled.length, 1);
    const identity = enrolled[0]!.value;
    assert.equal((await launcher.status(url, identity)).state, 'pending');
    const path = root + '/' + identity.id;
    assert.equal((await request(path, 'PATCH', { state: 'admitted' }, 'other')).status, 400);
    assert.equal((await request(path, 'PATCH', { state: 'admitted' })).status, 200);
    assert.equal((await launcher.status(url, identity)).state, 'admitted');
    assert.equal((await request(path, 'PATCH', { state: 'revoked' })).status, 200);
    await assert.rejects(launcher.status(url, identity), /authorization unavailable/);
  },
);
