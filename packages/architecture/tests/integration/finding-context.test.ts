import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Agent } from '../../../agent/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import { Architecture, type Capture, type TaskContext } from '../../src/index.js';

export const suite = { owner: 'architecture', level: 'integration', tags: ['recovery'] } as const;
const remote = 'https://example.com/finding-context.git';
const diagnostic = 'Exact technical diagnostic: ' + 'Ω'.repeat(50000);
const question = 'Approve exact guide bytes: ' + 'x'.repeat(20000);
const source = { path: 'docs/charter.md', quote: 'Human guidance establishes authority.' };

/** Exercise real retained findings and bounded artifact reads through public Architecture. */
class FindingContextScenario {
  readonly task: HostTask;
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-finding-context-'));
  private readonly coordination = new Coordination(this.root);

  private readonly capture = {
    project: { architect: { component: 'architecture', activity: 'updating' } },
    source: {
      root: this.root,
      revision: 'fixture',
      remote,
      paths: [source.path],
      read: () => source.quote,
    },
  } as unknown as Capture;

  /** Preserve a real human pause, technical block and repair before admitting the assessment. */
  constructor(t: TestContext) {
    this.seed();
    const journal = this.coordination.admit(remote, 'Assess prior findings');
    assert('close' in journal);
    this.task = new HostTask(
      {
        capture: this.capture,
        common: this.root,
        storage: this.root,
        executable: '',
        base: 'staging',
        fresh: true,
      },
      journal.goal,
      journal,
    );
    this.task.worktree = this.root;
    t.after(() => {
      this.task.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Record actual terminal states rather than rewriting a paused attempt as successful. */
  private seed() {
    const paused = this.coordination.admit(remote, 'Review guides');
    assert('close' in paused);
    paused.record({
      clarification: { scope: 'exact-proposal', question, evidence: 'question.json' },
    });
    paused.finish({ kind: 'blocked', reason: question, evidence: ['question.json'] });
    paused.close();
    const failed = this.coordination.admit(remote, 'Repair implementation');
    assert('close' in failed);
    failed.record({
      stewardRepair: {
        scope: { owner: 'worker', activity: 'implementation' },
        diagnostic,
        evidence: 'failed-check.log',
      },
    });
    failed.finish({
      kind: 'blocked',
      reason: 'A real external prerequisite is unavailable',
      evidence: ['external.log'],
    });
    failed.close();
  }

  /** Read exact retained history through the same bounded source operation as the actor. */
  read(path: string) {
    let offset: number | null = 0;
    let text = '';
    do {
      const result = this.task.readFile(path, offset);
      text += result.text;
      offset = result.nextOffset;
    } while (offset !== null);
    return text;
  }

  /** Capture the artifact reference supplied to the actual Architect capability. */
  async assess(t: TestContext) {
    let indexPath = '';
    t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => {
        indexPath = String((data.assignment as { findings: string }).findings);
        return {
          kind: 'no-change',
          summary: 'The existing architecture covers this observation',
          evidence: [source],
        };
      },
    );
    await new Architecture().propose({} as Agent, this.task, undefined, AbortSignal.timeout(5000));
    return this.read(indexPath);
  }
}

test('expected human pauses stay durable without becoming technical findings', (t) => {
  const fixture = new FindingContextScenario(t);
  const findings = fixture.task.journal.findings();
  assert.equal(findings.length, 2);
  assert(!JSON.stringify(findings).includes(question));
  assert(JSON.stringify(findings).includes(diagnostic));
});

test('Architect receives explicit previews and a readable complete observation history', async (t) => {
  const fixture = new FindingContextScenario(t);
  const input = await fixture.assess(t);
  assert(
    input.length < 5000,
    'The initial finding index must not inline large historical observations',
  );
  const index = JSON.parse(input) as {
    history: string;
    findings: { id: number; preview: string; characters: number }[];
  };
  assert.equal(index.findings.length, 2);
  const repair = index.findings.find(({ characters }) => characters === diagnostic.length);
  assert(repair);
  assert(diagnostic.startsWith(repair.preview));
  assert(repair.preview.length < diagnostic.length);
  assert(fixture.task.readFile(index.history).nextOffset, 'Full history uses bounded reads');
  const retained = JSON.parse(fixture.read(index.history)) as {
    id: number;
    observation: unknown;
  }[];
  assert(JSON.stringify(retained.find(({ id }) => id === repair.id)).includes(diagnostic));
});
