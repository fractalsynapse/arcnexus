import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PreparedRecoveryFixture, answer, checked } from '../fixtures/prepared-publication.js';
import { PublicationProvider } from '../fixtures/publication-provider.js';

export const suite = { owner: 'delivery', level: 'integration', tags: ['regression'] } as const;

/** Secure actual checked bytes and a human answer before starting final publication. */
async function prepared(fixture: PreparedRecoveryFixture) {
  const result = await fixture.run();
  assert.equal(result.kind, 'failed');
  assert.match(result.reason, /Interrupted after checked receipt and verbatim answer/);
  const task = fixture.tasks[0]!;
  const history = fixture.observed.at(-1)!;
  assert.equal(fixture.git('show', '7-task:checked.txt') + '\n', checked);
  assert(history.some((event) => JSON.stringify(event).includes(answer.replace(/\n/g, '\\n'))));
  return { task: task.taskID, history, checkpoint: fixture.git('rev-parse', '7-task') };
}

/** Assert exact durable inputs, rather than accepting a generic merged status as recovery. */
function preserved(
  fixture: PreparedRecoveryFixture,
  original: Awaited<ReturnType<typeof prepared>>,
) {
  assert(fixture.tasks.every((task) => task.taskID === original.task));
  for (const history of fixture.observed) {
    const issues = history.flatMap((event) => {
      const record = event as { issue?: string; publication?: { issue: string } };
      return [record.issue, record.publication?.issue].filter(Boolean);
    });
    assert(issues.length && issues.every((issue) => issue === '7'));
  }
  assert.equal(fixture.issues, 1);
  assert.equal(fixture.plans, 1);
  assert.deepEqual(fixture.prompts, ['Which requirement must recovery preserve?']);
  assert.equal(fixture.git('show', '7-task:checked.txt') + '\n', checked);
  const history = fixture.observed.at(-1)!;
  for (const event of original.history)
    assert(history.some((current) => JSON.stringify(current) === JSON.stringify(event)));
  assert.equal(fixture.git('merge-base', '7-task', original.checkpoint), original.checkpoint);
}

for (const effect of ['push', 'open', 'merge'] as const) {
  test('lost ' + effect + ' response resumes final delivery with one issue and PR', async (t) => {
    const fixture = new PreparedRecoveryFixture(t);
    const provider = new PublicationProvider(fixture, t);
    const original = await prepared(fixture);
    if (effect === 'push') provider.head = undefined;
    provider.lose = effect;
    const lost = await fixture.run();
    assert.equal(lost.kind, 'failed', JSON.stringify(lost));
    assert.match(lost.reason, new RegExp('Lost ' + effect));
    const merged = effect === 'merge' ? provider.pull?.commit : undefined;
    if (merged) fixture.advance('after-merge.txt', 'Later independent staging work\n');
    const offset = provider.calls.length;
    const recovered = await fixture.run();
    assert.equal(recovered.kind, 'merged', JSON.stringify(recovered));
    assert(recovered.kind === 'merged');
    assert.equal(recovered.commit, provider.pull?.commit);
    if (merged) historicalMerge(fixture, provider, offset, merged, recovered.commit);
    assert.equal(provider.opened, 1);
    assert.equal(provider.merged, 1);
    assert.equal(provider.calls[offset], 'observe PR 7-task');
    if (effect !== 'merge') assert(provider.calls.slice(offset).includes('observe branch 7-task'));
    assert(!provider.calls.slice(offset).some((call) => call.startsWith(effect + ' ')));
    preserved(fixture, original);
  });
}

test('outdated open PR is reconciled to fresh recovered acceptance and the same delivery', async (t) => {
  const fixture = new PreparedRecoveryFixture(t);
  const provider = new PublicationProvider(fixture, t);
  const original = await prepared(fixture);
  provider.lose = 'open';
  assert.equal((await fixture.run()).kind, 'failed');
  const prior = structuredClone(provider.pull);
  const reviewed = fixture.reviews.length;
  const { staging } = fixture.advance();
  const offset = provider.calls.length;
  const result = await fixture.run();
  assert.equal(result.kind, 'merged', JSON.stringify(result));
  assert(result.kind === 'merged');
  recoveredMerge(fixture, provider, prior?.url, reviewed, result.commit, staging);
  assert.equal(provider.calls[offset], 'observe PR 7-task');
  const resumed = provider.calls.slice(offset);
  const observed = resumed.indexOf('observe branch 7-task');
  const pushed = resumed.findIndex((call) => call.startsWith('push '));
  assert(observed >= 0 && pushed > observed);
  preserved(fixture, original);
});

for (const conflict of ['head', 'target', 'branch', 'unavailable', 'branch-unavailable'] as const) {
  test('retained publication ' + conflict + ' refuses effects and retains evidence', async (t) => {
    const fixture = new PreparedRecoveryFixture(t);
    const provider = new PublicationProvider(fixture, t);
    const original = await prepared(fixture);
    provider.lose = 'open';
    assert.equal((await fixture.run()).kind, 'failed');
    if (conflict === 'unavailable') provider.unavailable = true;
    else if (conflict === 'branch-unavailable') provider.branchUnavailable = true;
    else if (conflict === 'branch') provider.head = 'unrelated-branch-head';
    else provider.pull = { ...provider.pull!, [conflict]: 'unrelated-identity' };
    const offset = provider.calls.length;
    const result = await fixture.run();
    assert.equal(result.kind, 'failed', JSON.stringify(result));
    assert.match(result.reason, /unavailable|match|changed|conflict/i);
    assert(provider.calls.slice(offset).every((call) => call.startsWith('observe ')));
    assert.equal(provider.opened, 1);
    assert.equal(provider.merged, 0);
    assert(result.evidence.length);
    if (conflict.includes('unavailable')) unavailableEvidence(result.evidence);
    if (conflict === 'branch-unavailable') {
      assert.deepEqual(provider.calls.slice(offset), ['observe PR 7-task', 'observe branch 7-task']);
      retainedHold(fixture, provider, result.evidence);
    }
    for (const path of result.evidence) assert.doesNotThrow(() => readFileSync(path));
    preserved(fixture, original);
  });
}

test('another staging movement during recovered provider verification prevents merge', async (t) => {
  const fixture = new PreparedRecoveryFixture(t);
  const provider = new PublicationProvider(fixture, t);
  await prepared(fixture);
  provider.moveDuringVerify = true;
  const result = await fixture.run();
  assert.equal(result.kind, 'failed', JSON.stringify(result));
  assert.match(result.reason, /reviewed staging base moved/);
  assert.equal(provider.merged, 0);
  assert.equal(provider.opened, 1);
});

/** Reject duplicate publication, missing fresh review and publication of the wrong tree or parent. */
function recoveredMerge(
  fixture: PreparedRecoveryFixture,
  provider: PublicationProvider,
  url: string | undefined,
  reviews: number,
  commit: string,
  staging: string,
) {
  assert.equal(provider.pull?.url, url);
  assert.equal(provider.opened, 1);
  assert.equal(provider.merged, 1);
  assert(fixture.reviews.length > reviews, 'Recovered candidate requires independent reassessment');
  recoveredAcceptance(fixture, staging, commit);
  assert.equal(fixture.git('rev-parse', commit + '^'), staging);
  assert.equal(
    fixture.git('rev-parse', commit + '^{tree}'),
    fixture.git('rev-parse', '7-task^{tree}'),
  );
}

/** Bind recovered checks and independent acceptance to the resulting tree and newly captured base. */
function recoveredAcceptance(fixture: PreparedRecoveryFixture, staging: string, commit: string) {
  const history = fixture.observed.at(-1)! as Array<{
    verification?: {
      identity: import('../../../verification/src/index.js').VerificationIdentity;
      checks: Array<{ id: string; status: number }>;
    };
    verdict?: import('../../../verification/src/index.js').Verdict;
  }>;
  const prior = history.find((event) => event.verification)?.verification;
  const assessment = history.findLast((event) => event.verification)?.verification;
  const verdict = history.findLast((event) => event.verdict)?.verdict;
  assert(assessment && verdict?.kind === 'accepted');
  assert.equal(assessment.identity.tree, fixture.git('rev-parse', commit + '^{tree}'));
  assert.equal(assessment.identity.base, staging);
  assert.notEqual(assessment.identity.capture, prior?.identity.capture);
  assert.equal(assessment.identity.acceptance, prior?.identity.acceptance);
  assert.notEqual(assessment.identity.inputs, prior?.identity.inputs);
  assert.deepEqual(verdict.verification, assessment.identity);
  assert.deepEqual(verdict.criteria, ['continuity']);
  assert.deepEqual(
    assessment.checks.map(({ id, status }) => ({ id, status })),
    [
      { id: 'fixture-check', status: 0 },
      { id: 'current-check', status: 0 },
    ],
  );
}

/** Distinguish the newest unavailable observation from the retained lost-effect diagnostic. */
function unavailableEvidence(evidence: readonly string[]) {
  const diagnostic = evidence.findLast((path) => path.endsWith('publication-provider-failure.log'));
  assert(diagnostic, 'Unavailable provider facts require retained complete diagnostics');
  const log = readFileSync(diagnostic, 'utf8');
  assert(log.includes('Complete provider observation stdout\n  retained detail\n'));
  assert(log.includes('Complete provider observation stderr\n  restore credentials\n'));
}

/** Confirm the historical merge after staging advances without replaying any external effect. */
function historicalMerge(
  fixture: PreparedRecoveryFixture,
  provider: PublicationProvider,
  offset: number,
  merged: string,
  recovered: string,
) {
  assert.equal(recovered, merged);
  assert.notEqual(fixture.git('rev-parse', 'staging'), merged);
  assert.equal(fixture.git('merge-base', merged, 'staging'), merged);
  assert.deepEqual(provider.calls.slice(offset), [
    'observe PR 7-task',
    'observe PR 7-task',
    'verify ' + provider.pull!.head,
    'confirm ' + merged,
  ]);
}

/** Require the current prerequisite to retain the observed PR and complete diagnostic artifact. */
function retainedHold(
  fixture: PreparedRecoveryFixture,
  provider: PublicationProvider,
  evidence: readonly string[],
) {
  const history = fixture.observed.at(-1)! as Array<{
    publicationObserved?: { pull?: unknown };
    publicationHold?: { diagnostic: string; requiredAction: string; evidence: string[] };
  }>;
  assert.deepEqual(
    history.findLast((event) => event.publicationObserved?.pull)?.publicationObserved?.pull,
    provider.pull,
  );
  const hold = history.findLast((event) => event.publicationHold)?.publicationHold;
  assert(hold);
  assert.match(hold.diagnostic, /Issue-branch facts unavailable/);
  assert.equal(
    hold.requiredAction,
    'Resolve the provider diagnostic and observe PR and issue-branch facts before retrying effects',
  );
  assert(hold.evidence.every((path) => evidence.includes(path)));
}

test('staging moves again after outdated PR recovery obtains fresh acceptance', async (t) => {
  const fixture = new PreparedRecoveryFixture(t);
  const provider = new PublicationProvider(fixture, t);
  const original = await prepared(fixture);
  provider.lose = 'open';
  assert.equal((await fixture.run()).kind, 'failed');
  const prior = structuredClone(provider.pull);
  const reviews = fixture.reviews.length;
  const { staging } = fixture.advance();
  provider.moveDuringVerify = true;
  const offset = provider.calls.length;
  const result = await fixture.run();
  assert.equal(result.kind, 'failed', JSON.stringify(result));
  assert.match(result.reason, /reviewed staging base moved/);
  assert(fixture.reviews.length > reviews);
  recoveredAcceptance(fixture, staging, provider.head!);
  assert.notEqual(fixture.git('rev-parse', 'staging'), staging);
  assert.equal(provider.pull?.url, prior?.url);
  assert.equal(provider.opened, 1);
  assert.equal(provider.merged, 0);
  const calls = provider.calls.slice(offset);
  assert.equal(calls[0], 'observe PR 7-task');
  assert(
    calls.indexOf('observe branch 7-task') < calls.findIndex((call) => call.startsWith('push ')),
  );
  assert(!calls.some((call) => call.startsWith('merge ') || call.startsWith('open ')));
  preserved(fixture, original);
});
