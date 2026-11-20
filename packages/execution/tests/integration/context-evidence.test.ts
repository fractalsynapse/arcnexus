import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import { readToolFile } from '../../src/tool-files.js';
import { StewardFixture } from '../fixtures/steward.js';
import { indexReferences } from '../fixtures/context-evidence.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const milestone: Milestone = {
  id: 'focused',
  owner: 'owner',
  criteria: [{ id: 'retained', description: 'Preserve evidence' }],
  steps: activities.map((activity) => ({ activity, checklist: [] })),
};

/** Exercise public Steward requests and mapped reads against a large real retained journal. */
class FocusedEvidence {
  readonly task;
  readonly originals: string[] = [];
  readonly requests: TaskContext[] = [];
  readonly indexes: string[] = [];

  /** Retain enough history to require paginated tool reads without invoking a provider. */
  constructor(t: TestContext) {
    this.task = new StewardFixture(
      t,
      mkdtempSync(join(tmpdir(), 'arcnexus-focused-evidence-')),
    ).task;
    for (let index = 0; index < 350; index++)
      this.originals.push(this.task.store('observation.log', `Actual observation ${index}`));
    this.originals.push(this.task.store('retained-evidence-not-an-index.log', 'Original incident'));
    t.after(() => this.task.close());
    t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, input: TaskContext) => {
        this.requests.push(input);
        assert.equal(input.evidence?.length, 1, 'Retained references belong in one readable index');
        assert.equal(typeof input.evidence?.[0], 'string');
        this.indexes.push(input.evidence![0] as string);
        return { kind: 'completed', edits: [], checks: [] };
      },
    );
  }

  /** Run the existing public activity without changing the accepted milestone. */
  run() {
    return steward(
      new Agent(new Architecture()),
      this.task,
      milestone,
      'implementation',
      new AbortController().signal,
    );
  }
}

test('Steward context bounds historical references while every original observation remains readable', async (t) => {
  const scenario = new FocusedEvidence(t);
  assert.equal((await scenario.run()).kind, 'completed');
  const input = scenario.requests[0]!;
  assert(
    Buffer.byteLength(JSON.stringify(input.evidence)) <
      Buffer.byteLength(JSON.stringify(scenario.originals)) / 10,
  );
  assert.deepEqual(indexReferences(scenario.task, scenario.indexes[0]!), scenario.originals);
  assert.equal(
    readToolFile(scenario.task, scenario.originals[349]!, 0).text,
    'Actual observation 349',
  );
  assert.match((input.assignment as { instructions: string }).instructions, /unfinished/i);
});

test('evidence indexes are immutable, reused unchanged and never recursively indexed', async (t) => {
  const scenario = new FocusedEvidence(t);
  await scenario.run();
  const before = readFileSync(scenario.indexes[0]!, 'utf8');
  await scenario.run();
  assert.equal(scenario.indexes[0], scenario.indexes[1]);
  const recent = scenario.task.store('new-observation.log', 'New actual observation');
  await scenario.run();
  assert.notEqual(scenario.indexes[0], scenario.indexes[2]);
  assert.equal(readFileSync(scenario.indexes[0]!, 'utf8'), before);
  assert.deepEqual(indexReferences(scenario.task, scenario.indexes[2]!), [
    ...scenario.originals,
    recent,
  ]);
  unlinkSync(scenario.indexes[2]!);
  await scenario.run();
  assert.notEqual(scenario.indexes[2], scenario.indexes[3]);
  assert.deepEqual(indexReferences(scenario.task, scenario.indexes[3]!), [
    ...scenario.originals,
    recent,
  ]);
});
