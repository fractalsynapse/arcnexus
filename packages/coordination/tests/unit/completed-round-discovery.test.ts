import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Coordination, Journal, type JournalEvent } from '../../src/index.js';
import type { CompletedRefinementRound } from '../../../workflow/src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const remote = 'https://example.invalid/round-discovery.git';
const goal = 'Continuous refinement';

/** Admit a foreground refinement cycle in the selected verified project. */
function admit(store: Coordination, project = remote) {
  const journal = store.admit(project, goal, true, 'refine', true);
  assert(journal instanceof Journal);
  return journal;
}

/** Admit an ordinary child sharing its parent's writer. */
function child(parent: Journal, name: string, scope: string) {
  const journal = parent.child(name, scope);
  assert(journal instanceof Journal);
  return journal;
}

/** Select through the proposed public method while retaining a compilable pre-implementation red. */
function completedRounds(journal: Journal): JournalEvent[] {
  const select: unknown = Reflect.get(journal, 'completedRounds');
  assert.equal(typeof select, 'function', 'Journal.completedRounds must expose completed rounds');
  return Reflect.apply(select as () => JournalEvent[], journal, []);
}

/** Record the actual Workflow handoff shape and preserve its canonical journal frame. */
function completed(journal: Journal, round: number, suffix: string) {
  const marker: CompletedRefinementRound = {
    invocation: journal.taskID,
    round: String(round),
    report: `/evidence/report-${suffix}.md`,
    findings: [`finding-${suffix}`, `answer-${suffix}`],
    measurements: [`usage-${suffix}`],
    evidence: [`/evidence/origin-${suffix}.json`],
  };
  journal.record({ artifact: marker.report });
  journal.record({ artifact: marker.evidence[0] });
  return journal.record({ completedRound: marker });
}

/** Record distinct original details and exercise the existing child-history readers. */
function phase(root: Journal, suffix: string) {
  const session = child(root, 'Plan', 'round:1:plan');
  const observation = {
    finding: `finding-${suffix}`,
    answer: `First line ${suffix}\n\nComplete answer ${suffix}`,
    profile: suffix,
    usage: { input: suffix === 'first' ? 123 : 456 },
  };
  session.record(observation);
  session.finish({ kind: 'planned' });
  assert(root.childEvents('Plan', 'round:1:plan').includes(observation) === false);
  assert(
    root
      .childEvents('Plan', 'round:1:plan')
      .some((event) => JSON.stringify(event).includes(observation.answer.replaceAll('\n', '\\n'))),
  );
  assert(
    root
      .childTimeline('Plan', 'round:1:plan')
      .some((event) => JSON.stringify(event.observation).includes(observation.finding)),
  );
}

/** Populate two completed rounds across reopened attempts. */
function priorRounds(store: Coordination) {
  const first = admit(store);
  phase(first, 'first');
  first.record({ failure: 'retained failure' });
  const one = completed(first, 1, 'first');
  first.finish({ kind: 'cancelled' });
  first.close();

  const resumed = admit(store);
  assert.equal(resumed.taskID, first.taskID);
  phase(resumed, 'resumed');
  const two = completed(resumed, 2, 'resumed');
  resumed.record({ refinement: { round: 3, phase: 'run' } });
  resumed.finish({ kind: 'refined' });
  resumed.close();

  return [one, two] as const;
}

/** Check project-wide selection from an ordinary child of a later invocation. */
function assertDiscovery(store: Coordination, one: JournalEvent, two: JournalEvent) {
  const later = admit(store);
  assert.notEqual(later.taskID, one.taskID);
  const observer = child(later, 'Architect', 'round:1:architect');
  observer.record({ artifact: '/evidence/incomplete-report.md' });
  observer.record({ unrelated: { completedRound: { round: 99 } } });
  assert.deepEqual(store.admit(remote, 'Competing root'), {
    activeGoal: goal,
    run: later.run,
  });
  const foreign = admit(store, 'https://example.invalid/other-project.git');
  completed(foreign, 1, 'foreign');
  foreign.finish({ kind: 'refined' });
  foreign.close();

  const selected = completedRounds(observer);
  assert.deepEqual(selected, [one, two]);
  assert.equal(new Set(selected.map((event) => event.sequence)).size, selected.length);
  assert(BigInt(one.sequence) < BigInt(two.sequence));
  assert(observer.artifactRecorded('/evidence/report-first.md'));
  assert(observer.artifactRecorded('/evidence/origin-resumed.json'));
  assert(!observer.artifactRecorded('/evidence/report-foreign.md'));
  assert(!observer.artifactRecorded('/evidence/unregistered.json'));
  assert.deepEqual(completedRounds(observer), selected);
  observer.finish({ kind: 'planned' });
  later.finish({ kind: 'cancelled' });
  later.close();
}

test('completed rounds survive attempts and remain discoverable by later project children', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-round-discovery-'));
  const store = new Coordination(directory);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const [one, two] = priorRounds(store);
  assertDiscovery(store, one, two);
  const reopened = admit(store);
  assert.deepEqual(completedRounds(reopened), [one, two]);
  reopened.finish({ kind: 'refined' });
  reopened.close();
});
