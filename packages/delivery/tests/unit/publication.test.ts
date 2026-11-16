import assert from 'node:assert/strict';
import test from 'node:test';
import { publish, type Publication } from '../../src/index.js';
import type { PublishedPull } from '../../../collaboration/src/index.js';

const accepted: Publication = {
  target: 'staging',
  branch: '10-task',
  head: 'accepted-head',
  issue: '10',
  candidate: 'tree',
  parent: 'reviewed-base',
};
const url = 'https://github.com/example/target/pull/20';

/** Record the exact provider calls without access to live GitHub. */
function fixture(pull?: PublishedPull, remoteBranch?: string) {
  const calls: string[] = [];
  const effect =
    <T>(name: string, output: T) =>
    async () => {
      calls.push(name);
      return output;
    };
  const provider = {
    publication: effect('observe PR', pull),
    async remoteHead(branch: string) {
      calls.push(`observe ${branch}`);
      return branch === 'staging' ? accepted.parent : remoteBranch;
    },
    push: effect('push', undefined),
    pull: effect('open', url),
    verify: effect('verify', undefined),
    merge: effect('merge', 'integrated'),
    confirm: effect('confirm', undefined),
  };
  return {
    calls,
    provider,
    worktree: '/fixture/worktree',
    goal: 'Deliver the goal',
    validateLocal: () => calls.push('validate'),
    record() {},
  };
}

test('DE-5: a missing push is attempted only after remote absence is observed', async () => {
  const actions = fixture();
  await publish(accepted, actions);
  assert.deepEqual(actions.calls, [
    'observe PR',
    'observe 10-task',
    'observe staging',
    'validate',
    'push',
    'open',
    'verify',
    'observe staging',
    'merge',
    'confirm',
  ]);
});

test('DE-5: reuse a push or an open PR after a lost provider response', async () => {
  const pushed = fixture(undefined, accepted.head);
  await publish(accepted, pushed);
  assert.deepEqual(pushed.calls, [
    'observe PR',
    'observe 10-task',
    'observe staging',
    'open',
    'verify',
    'observe staging',
    'merge',
    'confirm',
  ]);
  const opened = fixture(
    { url, head: accepted.head, target: accepted.target, state: 'open', commit: null },
    accepted.head,
  );
  await publish(accepted, opened);
  assert.deepEqual(opened.calls, [
    'observe PR',
    'observe 10-task',
    'verify',
    'observe staging',
    'merge',
    'confirm',
  ]);
});

test('DE-5: a closed retained PR is rejected after observation without mutation', async () => {
  const actions = fixture({
    url,
    head: accepted.head,
    target: accepted.target,
    state: 'closed',
    commit: null,
  });
  await assert.rejects(publish(accepted, actions), /Retained pull request cannot be resumed/);
  assert.deepEqual(actions.calls, ['observe PR']);
});

test('DE-6: confirm an already merged candidate without any mutation', async () => {
  const actions = fixture({
    url,
    head: accepted.head,
    target: accepted.target,
    state: 'merged',
    commit: 'integrated',
  });
  assert.deepEqual(await publish(accepted, actions), { pr: url, commit: 'integrated' });
  assert.deepEqual(actions.calls, ['observe PR', 'verify', 'confirm']);
});

test('DE-5: conflicting publication identities and unavailable reads stop before mutation', async () => {
  const conflict = fixture(undefined, 'different-head');
  await assert.rejects(publish(accepted, conflict), /branch changed/);
  assert.deepEqual(conflict.calls, ['observe PR', 'observe 10-task']);
  const unavailable = fixture();
  unavailable.provider.publication = async () => {
    throw new Error('GitHub unavailable');
  };
  await assert.rejects(publish(accepted, unavailable), /unavailable/);
  assert.deepEqual(unavailable.calls, []);
});
