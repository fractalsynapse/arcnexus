import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import { githubAppReadToken } from '../../src/index.js';

export const suite = {
  owner: 'collaboration',
  level: 'unit',
  tags: ['github', 'repositories'],
} as const;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const remote = 'https://github.com/example/private-fixture.git';

test('a GitHub App resolves the exact repository installation and mints a Contents read token', async () => {
  const requests: string[] = [];
  const token = await githubAppReadToken(remote, {
    appId: '123',
    privateKey: key,
    request: installedApp(requests),
  });
  assert.deepEqual(requests, [
    'https://api.github.com/repos/example/private-fixture/installation',
    'https://api.github.com/app/installations/456/access_tokens',
  ]);
  assert.equal(token, 'installation-fixture');
});

function installedApp(requests: string[]): typeof fetch {
  return async (input, init) => {
    requests.push(String(input));
    const token = new Headers(init?.headers).get('authorization') ?? '';
    assert.match(token, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    assert.equal(init?.redirect, 'error');
    const [header, claim, signature] = token.slice('Bearer '.length).split('.');
    assert.ok(
      verify(
        'RSA-SHA256',
        Buffer.from(header + '.' + claim),
        publicKey,
        Buffer.from(signature!, 'base64url'),
      ),
    );
    if (requests.length === 1) {
      assert.equal(init?.method, 'GET');
      return Response.json({ id: 456 });
    }
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      repositories: ['private-fixture'],
      permissions: { contents: 'read' },
    });
    return Response.json({ token: 'installation-fixture' }, { status: 201 });
  };
}

test('a missing repository installation fails without minting a token', async () => {
  let calls = 0;
  await assert.rejects(
    githubAppReadToken(remote, {
      appId: '123',
      privateKey: key,
      async request() {
        calls += 1;
        return Response.json({ message: 'Not found' }, { status: 404 });
      },
    }),
    /no access to this repository/,
  );
  assert.equal(calls, 1);
});
