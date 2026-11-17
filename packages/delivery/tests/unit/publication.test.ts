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

/** Control staging observations and assert that provider gates receive retained identities. */
function scenario(pull?: PublishedPull, remote?: string, bases = [accepted.parent]) {
  const actions = fixture(pull, remote);
  const provider: Parameters<typeof publish>[1]['provider'] = {
    ...actions.provider,
    async remoteHead(branch) {
      const head = await actions.provider.remoteHead(branch);
      return branch === accepted.target ? (bases.length > 1 ? bases.shift() : bases[0]) : head;
    },
    async verify(...args) {
      const expected = [url, accepted.head, accepted.target];
      if (pull?.state === 'merged') expected.push('MERGED');
      assert.deepEqual(args, expected);
      await actions.provider.verify();
    },
    async merge(...args) {
      assert.deepEqual(args, [url, accepted.head, accepted.issue]);
      return actions.provider.merge();
    },
    async confirm(...args) {
      assert.deepEqual(args, [pull?.commit ?? 'integrated', accepted.candidate, accepted.target]);
      await actions.provider.confirm();
    },
  };
  return { ...actions, provider };
}

const resumedPull: PublishedPull = {
  url,
  head: accepted.head,
  target: accepted.target,
  state: 'open',
  commit: null,
};

for (const remote of [undefined, accepted.head]) {
  test(`DE-BASE: moved staging prevents initial publication with remote ${remote}`, async () => {
    const actions = scenario(undefined, remote, ['moved-base']);
    await assert.rejects(publish(accepted, actions), /reviewed staging base moved/);
    assert.deepEqual(actions.calls, ['observe PR', 'observe 10-task', 'observe staging']);
  });
}

test('DE-BASE: moved staging prevents merge of a resumed PR', async () => {
  const actions = scenario(resumedPull, accepted.head, ['moved-base']);
  await assert.rejects(publish(accepted, actions), /reviewed staging base moved/);
  assert.deepEqual(actions.calls, ['observe PR', 'observe 10-task', 'verify', 'observe staging']);
});

test('DE-BASE: staging movement after initial verification prevents merge', async () => {
  const actions = scenario(undefined, accepted.head, [accepted.parent, 'moved-base']);
  await assert.rejects(publish(accepted, actions), /reviewed staging base moved/);
  assert.deepEqual(actions.calls, [
    'observe PR',
    'observe 10-task',
    'observe staging',
    'open',
    'verify',
    'observe staging',
  ]);
});

test('DE-BASE: staging movement during resumed verification prevents merge', async () => {
  const bases = [accepted.parent];
  const actions = scenario(resumedPull, accepted.head, bases);
  const verify = actions.provider.verify;
  actions.provider.verify = async (...args) => {
    await verify(...args);
    bases[0] = 'moved-base';
  };
  await assert.rejects(publish(accepted, actions), /reviewed staging base moved/);
  assert.deepEqual(actions.calls, ['observe PR', 'observe 10-task', 'verify', 'observe staging']);
});

for (const state of ['open', 'merged'] as const) {
  for (const field of ['head', 'target'] as const) {
    test(`DE-IDENTITY: conflicting ${state} PR ${field} prevents mutation`, async () => {
      const pull = { ...resumedPull, state, commit: 'observed-merge', [field]: 'conflict' };
      const actions = scenario(pull, accepted.head);
      await assert.rejects(publish(accepted, actions), /does not match the retained candidate/);
      assert.deepEqual(actions.calls, ['observe PR']);
    });
  }
}

for (const remote of [undefined, 'conflicting-head']) {
  test(`DE-IDENTITY: resumed PR refuses remote branch ${remote}`, async () => {
    const actions = scenario(resumedPull, remote);
    await assert.rejects(publish(accepted, actions), /Remote publication branch changed/);
    assert.deepEqual(actions.calls, ['observe PR', 'observe 10-task']);
  });
}

test('DE-GATES: new publication returns the confirmed provider merge identity', async () => {
  const actions = scenario();
  assert.deepEqual(await publish(accepted, actions), { pr: url, commit: 'integrated' });
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

test('DE-GATES: resumed publication uses the observed PR identity at every gate', async () => {
  const observedUrl = 'https://github.com/example/target/pull/37';
  const actions = fixture({ ...resumedPull, url: observedUrl }, accepted.head);
  const provider: Parameters<typeof publish>[1]['provider'] = {
    ...actions.provider,
    async verify(...args) {
      assert.deepEqual(args, [observedUrl, accepted.head, accepted.target]);
      await actions.provider.verify();
    },
    async merge(...args) {
      assert.deepEqual(args, [observedUrl, accepted.head, accepted.issue]);
      return actions.provider.merge();
    },
    async confirm(...args) {
      assert.deepEqual(args, ['integrated', accepted.candidate, accepted.target]);
      await actions.provider.confirm();
    },
  };
  const result = await publish(accepted, { ...actions, provider });
  assert.deepEqual(result, { pr: observedUrl, commit: 'integrated' });
  assert.deepEqual(actions.calls, [
    'observe PR',
    'observe 10-task',
    'verify',
    'observe staging',
    'merge',
    'confirm',
  ]);
});

test('DE-GATES: reused merge verifies merged state and confirms the observed commit', async () => {
  const actions = scenario({ ...resumedPull, state: 'merged', commit: 'observed-merge' });
  assert.deepEqual(await publish(accepted, actions), { pr: url, commit: 'observed-merge' });
  assert.deepEqual(actions.calls, ['observe PR', 'verify', 'confirm']);
});

for (const merged of [false, true]) {
  test(`DE-GATES: verification failure prevents further effects with merged=${merged}`, async () => {
    const pull = merged
      ? { ...resumedPull, state: 'merged' as const, commit: 'observed-merge' }
      : resumedPull;
    const actions = scenario(pull, accepted.head);
    const verify = actions.provider.verify;
    const failure = new Error('Required checks or review failed');
    actions.provider.verify = async (...args) => {
      await verify(...args);
      throw failure;
    };
    await assert.rejects(publish(accepted, actions), (error) => error === failure);
    assert.deepEqual(
      actions.calls,
      merged ? ['observe PR', 'verify'] : ['observe PR', 'observe 10-task', 'verify'],
    );
  });

  test(`DE-GATES: failed tree confirmation rejects success with merged=${merged}`, async () => {
    const pull = merged
      ? { ...resumedPull, state: 'merged' as const, commit: 'observed-merge' }
      : resumedPull;
    const actions = scenario(pull, accepted.head);
    const confirm = actions.provider.confirm;
    const failure = new Error('Reviewed tree is absent from staging');
    actions.provider.confirm = async (...args) => {
      await confirm(...args);
      throw failure;
    };
    await assert.rejects(publish(accepted, actions), (error) => error === failure);
    assert.deepEqual(
      actions.calls,
      merged
        ? ['observe PR', 'verify', 'confirm']
        : ['observe PR', 'observe 10-task', 'verify', 'observe staging', 'merge', 'confirm'],
    );
  });
}

test('DE-GATES: pending verification prevents merge until the gate resolves', async () => {
  const actions = scenario(resumedPull, accepted.head);
  let resolve!: () => void;
  const promise = new Promise<void>((resume) => {
    resolve = resume;
  });
  let signalStarted!: () => void;
  const started = new Promise<void>((resume) => {
    signalStarted = resume;
  });
  const verify = actions.provider.verify;
  actions.provider.verify = async (...args) => {
    await verify(...args);
    signalStarted();
    await promise;
  };
  const publication = publish(accepted, actions);
  await started;
  try {
    assert.deepEqual(actions.calls, ['observe PR', 'observe 10-task', 'verify']);
  } finally {
    resolve();
    await publication;
  }
  assert.deepEqual(await publication, { pr: url, commit: 'integrated' });
});
