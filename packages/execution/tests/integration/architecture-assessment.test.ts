import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { ArchitectureFixture } from '../fixtures/architecture.js';
import type { HostTask } from '../../src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { decodeCodexAnswer } from '../../src/codex.js';
import type { CheckResult } from '../../src/check.js';
import { ArchitectVerificationFixture, audit } from '../fixtures/architect-verification.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const signal = new AbortController().signal;

/** Exercise the public Architecture assessment with real journals and a deterministic actor response. */
class AssessmentFixture extends ArchitectureFixture {
  readonly architecture = new Architecture();
  readonly agent = new Agent(this.architecture);

  /** Start without a pending proposal so each scenario exercises real assessment admission. */
  constructor(t: TestContext) {
    super(t, false);
  }

  /** Return cited source whose original bytes are part of this explicit generic capture. */
  noChange() {
    return {
      kind: 'no-change',
      summary: 'The declared requirement is aligned.',
      evidence: [{ path: 'contract.md', quote: '| SERVICE-1 | Original requirement |' }],
    };
  }

  /** Use the public application operation with the actual admitted host task. */
  assess() {
    return this.architecture.propose(this.agent, this.parent, undefined, signal);
  }
}

test('Architect repairs an invalid no-change citation in the same caller without Direction', async (t) => {
  const fixture = new AssessmentFixture(t);
  const inputs: unknown[] = [];
  t.mock.method(
    fixture.parent,
    'activate',
    async (...[_agent, selection, data]: Parameters<HostTask['activate']>) => {
      assert.deepEqual(selection, { component: 'architecture', activity: 'updating' });
      inputs.push(data);
      return inputs.length === 1 ? { ...fixture.noChange(), evidence: [] } : fixture.noChange();
    },
  );
  const result = await fixture.assess();
  assert.equal(result.kind, 'no-change');
  assert.equal(inputs.length, 2);
  assert.match(JSON.stringify(inputs[1]), /requires a summary and source citations/);
  assert.equal(readFileSync(join(fixture.workspace, 'contract.md'), 'utf8'), fixture.original);
  fixture.parent.cleanup();
});

test('pending Architect approval resumes the exact proposal without another actor call', async (t) => {
  const fixture = new AssessmentFixture(t);
  let calls = 0;
  t.mock.method(fixture.parent, 'activate', async () => {
    calls++;
    return {
      kind: 'proposal',
      purpose: 'Add an invariant',
      consequences: ['A new requirement'],
      implementation: [],
      changes: [
        { path: 'contract.md', content: fixture.original + '| SERVICE-2 | New requirement |\n' },
      ],
    };
  });
  await assert.rejects(fixture.assess(), /Architecture proposal/);
  const pending = fixture.parent
    .observations<{ architectureProposal?: { proposal: { id: string } } }>()
    .findLast(({ architectureProposal }) => architectureProposal)?.architectureProposal;
  fixture.parent.ask = async () => 'approve';
  const result = await fixture.assess();
  assert.equal(result.kind, 'approved');
  if (result.kind === 'approved') assert.equal(result.proposal.id, pending?.proposal.id);
  assert.equal(calls, 1);
  assert.equal(readFileSync(join(fixture.workspace, 'contract.md'), 'utf8'), fixture.original);
  fixture.parent.cleanup();
});

test('repeated unchanged Architect diagnostics hold durably instead of spinning', async (t) => {
  const fixture = new AssessmentFixture(t);
  let calls = 0;
  t.mock.method(fixture.parent, 'activate', async () => {
    calls++;
    return { kind: 'invalid' };
  });
  await assert.rejects(fixture.assess(), /repeated an unchanged finding/);
  assert.equal(calls, 2);
  fixture.parent.cleanup();
});

test('Architect native parse repair holds the same finding across changing transcript paths', async (t) => {
  const fixture = new AssessmentFixture(t);
  let calls = 0;
  t.mock.method(
    fixture.parent,
    'activate',
    async (...[_agent, _selection, data]: Parameters<HostTask['activate']>) => {
      calls++;
      if (calls > 2) return fixture.noChange();
      if (calls === 2) assert.match(JSON.stringify(data.assignment), /first-codex.jsonl/);
      const stdout = JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: 'not JSON' },
      });
      const log = fixture.parent.store(
        calls === 1 ? 'first-codex.jsonl' : 'second-codex.jsonl',
        stdout,
      );
      return decodeCodexAnswer(stdout, log);
    },
  );
  await assert.rejects(fixture.assess(), /repeated an unchanged finding.*second-codex.jsonl/);
  assert.equal(calls, 2);
});

test('Architect requires JSON explicitly and repairs distinct native findings without Direction', async (t) => {
  const fixture = new AssessmentFixture(t);
  let calls = 0;
  t.mock.method(
    fixture.parent,
    'activate',
    async (...[_agent, _selection, data]: Parameters<HostTask['activate']>) => {
      calls++;
      assert.match(JSON.stringify(data.assignment), /one JSON object.*fences.*YAML/);
      if (calls === 3) return fixture.noChange();
      const stdout =
        calls === 1
          ? ''
          : JSON.stringify({
              type: 'item.completed',
              item: { type: 'agent_message', text: 'not JSON' },
            });
      return decodeCodexAnswer(stdout, fixture.parent.store(`${calls}-codex.jsonl`, stdout));
    },
  );
  assert.equal((await fixture.assess()).kind, 'no-change');
  assert.equal(calls, 3);
});

for (const kind of ['proposal', 'no-change'] as const) {
  test('EX-27: Architect ' + kind + ' cannot omit a failing required check', async (t) => {
    const fixture = new ArchitectVerificationFixture(t);
    const task = await fixture.open();
    fixture.controlled(t, task, 37);
    fixture.respond(t, kind);
    await assert.rejects(
      fixture.architecture.propose(fixture.agent, task, undefined, signal),
      /declared-audit|exited 37|Uncovered/,
    );
    assertFailedCaller(fixture, task);
  });

  test('EX-27: Architect ' + kind + ' checks before assessment or approval', async (t) => {
    const fixture = new ArchitectVerificationFixture(t);
    const task = await fixture.open();
    fixture.controlled(t, task, 0);
    fixture.respond(t, kind);
    task.ask = async () => {
      assert(task.observations<any>().some((event) => event.check?.id === audit));
      return 'skip';
    };
    const result = await fixture.architecture.propose(fixture.agent, task, undefined, signal);
    assert.equal(result.kind, 'no-change');
    assert(
      task.observations<any>().some((event) => event.check?.status === 0),
      'a declaration or response alone cannot establish passing verification',
    );
    assert.equal(task.capture, task.config.capture);
  });
}

/** Require complete failure evidence at the accountable caller before either assessment is retained. */
function assertFailedCaller(
  fixture: ArchitectVerificationFixture,
  task: HostTask,
) {
  const checks = task
    .observations<{ check?: CheckResult }>()
    .flatMap((event) => event.check ?? []);
  assert(checks.length > 0, 'completion must execute the omitted check');
  assert(checks.every((check) => check.id === audit && check.status === 37));
  assert.match(
    readFileSync(checks[0]!.log, 'utf8'),
    /Uncovered literal path café\nComplete diagnostic/,
  );
  assert(
    !task
      .observations<any>()
      .some((event) => event.architectureProposal || event.architectureAssessment),
  );
  assert(
    fixture.inputs.some((input) => JSON.stringify(input.task).includes(checks[0]!.log)),
    'the accountable Architect must receive the actual failed check log',
  );
}
