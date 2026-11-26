import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { JournalEvent } from '../../../coordination/src/index.js';
import { RoundConsumptionFixture } from '../../../execution/tests/fixtures/round-consumption.js';
import type { CompletedRefinementRound, TaskObserver } from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'integration', tags: ['regression'] } as const;

/** Collect real host gates and assessments without manufacturing journal decisions or positions. */
class Gates implements TaskObserver {
  readonly questions: string[] = [];
  readonly actors: string[] = [];
  readonly rounds: CompletedRefinementRound[] = [];
  readonly invocations = new Set<string>();

  /** Simulate an interactive decline or an unavailable operator. */
  constructor(private readonly decline = false) {}

  /** Leave unanswered gates pending and preserve the complete exact proposal shown to the human. */
  async answer(question: string) {
    this.questions.push(question);
    return this.decline ? 'skip' : undefined;
  }

  /** Progress remains persisted by the real Workflow observer. */
  progress() {}

  /** Observe actual native assessments, completed rounds and the durable parent identity. */
  event(event: JournalEvent) {
    const observation = event.observation as Record<string, any>;
    if (observation.nativeEvent?.event?.type === 'fixture.guide-assessment')
      this.actors.push((event.detail as { event: { component: string } }).event.component);
    if (observation.refinement) this.invocations.add(observation.refinement.invocation);
    if (observation.completedRound) this.rounds.push(observation.completedRound);
  }
}

/** Install an explicit controlled provider without editing the committed authority or source. */
function provider(fixture: RoundConsumptionFixture) {
  const executable = fixture.install('guide-gates');
  const source = readFileSync(
    fileURLToPath(new URL('../fixtures/refinement-gates-provider.js', import.meta.url)),
    'utf8',
  );
  writeFileSync(executable, source.replace(/^#![^\n]*/, '#!' + process.execPath));
}

/** Run each attempt through freshly composed services over the same Git and SQLite state. */
function refine(fixture: RoundConsumptionFixture, observer: Gates) {
  return fixture.reopen().refine(fixture.root, '1', observer, new AbortController().signal);
}

/** A declined proposal leaves accepted authority and the captured standing goal unchanged. */
function assertUnchanged(fixture: RoundConsumptionFixture, revision: string) {
  assert.equal(fixture.git('rev-parse', 'HEAD'), revision);
  assert.equal(fixture.git('status', '--porcelain'), '');
  assert.match(
    readFileSync(fixture.root + '/.arc/goals/baseline.md', 'utf8'),
    /Preserve the baseline/,
  );
  assert.equal(
    readFileSync(fixture.root + '/.arc/architecture/plan-template.md', 'utf8'),
    'Use the normal five ordered activities.\n',
  );
}

test('the pending architecture gate reopens the same round without repeating Plan', async (t) => {
  const fixture = new RoundConsumptionFixture(t);
  provider(fixture);
  const revision = fixture.git('rev-parse', 'HEAD');
  const waiting = new Gates();
  const first = await refine(fixture, waiting);
  assert.equal(first.kind, 'blocked', JSON.stringify(first));
  assert.deepEqual(waiting.actors, ['planner', 'architecture']);
  assert.equal(waiting.questions.length, 1);
  assert.equal(waiting.rounds.length, 0);
  const run = new Gates(true);
  const resumed = await refine(fixture, run);
  assert.equal(resumed.kind, 'planned', JSON.stringify(resumed));
  assert.deepEqual(run.actors, ['direction']);
  assert.deepEqual(run.questions, waiting.questions);
  assert.deepEqual([...run.invocations], [...waiting.invocations]);
  assert.equal(run.rounds.length, 1);
  assertUnchanged(fixture, revision);
  assertReport(run.rounds[0]!);
});

/** Resolve the report to the actual declined decisions and retained original proposal intent. */
function assertReport(completion: CompletedRefinementRound) {
  const report = readFileSync(completion.report, 'utf8');
  assert.match(report, /Goal mapping completed with no inventory changes/);
  assert.match(report, /architectureDecision/);
  assert.match(report, /declined/);
  assert.match(report, /Explain evidence retention in the accepted plan template/);
  assert.match(report, /Direction assessed the retained baseline/);
}

test('an interactive architecture decline proceeds to the retained goal', async (t) => {
  const fixture = new RoundConsumptionFixture(t);
  provider(fixture);
  const revision = fixture.git('rev-parse', 'HEAD');
  const observed = new Gates(true);
  const outcome = await refine(fixture, observed);
  assert.equal(outcome.kind, 'planned', JSON.stringify(outcome));
  assert.deepEqual(observed.actors, ['planner', 'architecture', 'direction']);
  assert.equal(observed.questions.length, 1);
  assert.equal(observed.rounds.length, 1);
  assertUnchanged(fixture, revision);
  assertReport(observed.rounds[0]!);
});
