import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { managedRepository, type CheckoutGit } from '../../src/index.js';

export const suite = {
  owner: 'collaboration',
  level: 'unit',
  tags: ['github', 'repositories'],
} as const;

test('a managed private checkout scopes its credential and retains each verified pin', async (t) => {
  const parent = await mkdtemp(join(tmpdir(), 'arc-managed-checkout-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const directory = join(parent, 'project');
  const remote = 'https://github.com/example/private.git';
  const token = 'fixture-read-token';
  const calls: string[] = [];
  let revision = 'a'.repeat(40);
  const git: CheckoutGit = async (args, cwd, config) => {
    assert.ok(!args.join(' ').includes(token));
    assert.ok(!cwd.includes(token));
    assert.equal(config['http.followRedirects'], 'false');
    const header = config['http.' + remote + '.extraHeader'];
    assert.ok(header?.includes(Buffer.from('x-access-token:' + token).toString('base64')));
    calls.push(args[0]!);
    if (args[0] === 'clone') await mkdir(args.at(-1)!);
    if (args[0] === 'config') return remote;
    if (args[0] === 'rev-parse') return revision;
    return '';
  };
  assert.equal(await managedRepository({ directory, remote, token }, git), revision);
  revision = 'b'.repeat(40);
  assert.equal(await managedRepository({ directory, remote, token }, git), revision);
  assert.equal(calls.filter((command) => command === 'clone').length, 1);
  assert.equal(calls.filter((command) => command === 'fetch').length, 2);
});
