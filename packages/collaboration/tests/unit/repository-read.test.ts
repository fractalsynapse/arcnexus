import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBoundCommit } from '../../src/index.js';

export const suite = { owner: 'collaboration', level: 'unit', tags: ['github'] } as const;
const remote = 'https://github.com/example/private.git';
const revision = 'a'.repeat(40);

test('verifies the exact bound GitHub commit without forwarding the credential', async () => {
  await verifyBoundCommit(remote, revision, {
    token: 'fixture-token',
    async request(input, init) {
      assert.equal(input, 'https://api.github.com/repos/example/private/git/commits/' + revision);
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fixture-token');
      assert.equal(init?.redirect, 'error');
      return Response.json({ sha: revision });
    },
  });
});

test('rejects an unbound remote or a different provider commit', async () => {
  const request = async () => Response.json({ sha: 'b'.repeat(40) });
  await assert.rejects(
    verifyBoundCommit(remote, revision, { token: 'fixture-token', request }),
    /different commit/,
  );
  await assert.rejects(
    verifyBoundCommit('https://example.org/owner/repo.git', revision, {
      token: 'fixture-token',
      request,
    }),
    /Invalid GitHub commit binding/,
  );
});
