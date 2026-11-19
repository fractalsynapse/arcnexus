import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Architecture, type Capture } from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import type { TaskInput, TaskOutcome } from '../../../workflow/src/index.js';
import { Execution, HostTask } from '../../src/index.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['admission'] } as const;
const remote = 'https://github.com/example/fixture.git';
const signal = new AbortController().signal;

interface ChildAdmission {
  admitChild(
    input: TaskInput,
    parent: Journal,
    scope: string,
    signal: AbortSignal,
  ): Promise<HostTask | TaskOutcome>;
}

/** Exercise the public Execution admission boundary against a clean local Git source. */
class AdmissionScenario {
  readonly root: string;
  readonly coordination: Coordination;
  readonly execution: ChildAdmission;
  readonly parent: Journal;
  private readonly capture: Capture;

  /** Create a clean repository, staging remote and host executable binding. */
  constructor(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'execution-child-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    this.root = join(directory, 'project');
    this.initialize();
    this.capture = this.authority();
    const architecture = new Architecture();
    t.mock.method(architecture, 'capture', () => this.capture);
    this.coordination = new Coordination(join(directory, 'state'));
    this.execution = new Execution(
      architecture,
      this.coordination,
      join(directory, 'state'),
    ) as unknown as ChildAdmission;
    const parent = this.coordination.admit(remote, 'Architect phase');
    assert(parent instanceof Journal);
    this.parent = parent;
  }

  /** Admit an ordinary task under the retained phase writer. */
  async admit(goal: string, scope = goal) {
    return this.execution.admitChild({ directory: this.root, goal }, this.parent, scope, signal);
  }

  /** Run Git in the fixture repository. */
  private git(...args: string[]) {
    return execFileSync('git', args, { cwd: this.root, encoding: 'utf8' }).trim();
  }
}

test('child admission retains the parent lane across sequential ordinary sessions', async (t) => {
  const fixture = new AdmissionScenario(t);
  const first = await fixture.admit('First prerequisite');
  assert(first instanceof HostTask);
  assert.equal(first.capture.source.root, fixture.root);
  const sibling = await fixture.admit('Second prerequisite');
  assert(!(sibling instanceof HostTask));
  assert.equal(sibling.kind, 'invalid');
  assert('reason' in sibling);
  assert.match(sibling.reason, /First prerequisite/);
  const competing = fixture.coordination.admit(remote, 'Standalone');
  assert('activeGoal' in competing);
  assert.equal(competing.activeGoal, 'Architect phase');
  first.finish({ kind: 'failed', reason: 'fixture', evidence: [] });
  first.close();
  fixture.parent.record({ phase: 'still active' });
  const second = await fixture.admit('Second prerequisite');
  assert(second instanceof HostTask);
  second.finish({ kind: 'merged', commit: 'fixture', evidence: [] });
  second.close();
  fixture.parent.finish({ kind: 'completed' });
  fixture.parent.close();
});

test('a repeated child retains its identity and interrupted observations', async (t) => {
  const fixture = new AdmissionScenario(t);
  const first = await fixture.admit('Prerequisite', 'prerequisite-1');
  assert(first instanceof HostTask);
  const observations = [
    { issue: '7', branch: '7-task', confirmed: 'checkpoint' },
    { answer: { question: 'scope', answer: 'complete' } },
    { edits: [{ path: 'owned.txt', after: 'digest' }] },
    { check: { status: 1, log: 'failed.log' } },
    { publication: { branch: '7-task', head: 'checkpoint' } },
  ];
  for (const observation of observations) first.note(observation);
  first.finish({ kind: 'cancelled', reason: 'interrupted', evidence: ['failed.log'] });
  first.close();
  const resumed = await fixture.admit('Prerequisite', 'prerequisite-1');
  assert(resumed instanceof HostTask);
  assert.equal(resumed.taskID, first.taskID);
  for (const observation of observations)
    assert.deepEqual(
      resumed.observations().find((event) => JSON.stringify(event) === JSON.stringify(observation)),
      observation,
    );
  resumed.finish({ kind: 'failed', reason: 'fixture', evidence: [] });
  resumed.close();
  fixture.parent.finish({ kind: 'completed' });
  fixture.parent.close();
});

test('child admission performs normal preflight before claiming a journal', async (t) => {
  const fixture = new AdmissionScenario(t);
  writeFileSync(join(fixture.root, 'dirty.txt'), 'dirty');
  const result = await fixture.admit('Prerequisite');
  assert(!(result instanceof HostTask));
  assert.equal(result.kind, 'invalid');
  assert('reason' in result);
  assert.match(result.reason, /clean working tree/);
  fixture.parent.finish({ kind: 'completed' });
  fixture.parent.close();
});
