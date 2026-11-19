import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import {
  activities,
  DirectorResponseError,
  type DirectionResult,
  type Milestone,
} from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { decodeCodexAnswer } from '../../src/codex.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

/** Exercise actual provider decoding through existing caller loops and a real journal. */
class NativeResponseScenario {
  private readonly task;
  private calls = 0;

  /** Isolate controlled provider bytes and checked-input progress from the real repository. */
  constructor(
    t: TestContext,
    private readonly progress = false,
  ) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-native-finding-'));
    this.task = new StewardFixture(t, root).task;
    writeFileSync(join(root, 'fixture.txt'), 'initial');
  }

  /** Decode the same malformed answer with a fresh actual transcript artifact each time. */
  private reject(): never {
    const stdout = JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: 'not JSON' },
    });
    const log = this.task.store('codex.jsonl', stdout);
    decodeCodexAnswer(stdout, log);
    throw new Error('Expected malformed provider output');
  }

  /** Preserve the production Director wrapper and provide a finite fallback for the broken guard. */
  private async director(): Promise<DirectionResult> {
    this.calls++;
    if (this.calls > 2)
      return { kind: 'question', question: 'Unchanged finding was not held', evidence: [] };
    try {
      return this.reject();
    } catch (error) {
      assert(error instanceof Error);
      throw new DirectorResponseError(error.message, { cause: error });
    }
  }

  /** Keep unrelated execution and delivery boundaries unreachable in this planning-only scenario. */
  private services(): WorkflowServices {
    return {
      execution: { admit: async () => this.task, assemble: unavailable },
      direction: { plan: () => this.director(), revise: () => this.director() },
      agent: { execute: unavailable },
      verification: { assess: unavailable },
      delivery: { integrate: unavailable },
    };
  }

  /** Use the public Workflow to verify that wrapping does not turn log paths into new findings. */
  async runDirector() {
    const result = await new Workflow(this.services()).run(
      { directory: this.task.capture.source.root, goal: this.task.goal },
      { progress: () => {} },
      new AbortController().signal,
    );
    assert.equal(result.kind, 'blocked');
    assert.match(
      'reason' in result ? result.reason : '',
      /repeated an unchanged validation finding/,
    );
    assert.equal(this.calls, 2);
  }

  /** Simulate accepted single-file progress before a malformed reply, without changing acceptance. */
  private stewardReply() {
    this.calls++;
    if (this.calls > 2) return { kind: 'completed', edits: [], checks: [] };
    if (this.progress) {
      const current = readFileSync(join(this.task.worktree!, 'fixture.txt'), 'utf8');
      this.task.edits('owner', 'implementation', [
        {
          path: 'fixture.txt',
          expected: createHash('sha256').update(current).digest('hex'),
          content: String(this.calls),
        },
      ]);
    }
    return this.reject();
  }

  /** Exercise unchanged repetition and meaningful checked progress through the public steward path. */
  async runSteward(t: TestContext) {
    t.mock.method(this.task, 'activate', async () => this.stewardReply());
    const milestone: Milestone = {
      id: 'current',
      owner: 'owner',
      criteria: [{ id: 'accepted', description: 'Preserve the accepted outcome' }],
      steps: activities.map((activity) => ({ activity, checklist: [] })),
    };
    try {
      const result = await steward(
        new Agent(new Architecture()),
        this.task,
        milestone,
        'implementation',
        new AbortController().signal,
      );
      assert.equal(result.kind, this.progress ? 'completed' : 'blocked');
      assert.equal(this.calls, this.progress ? 3 : 2);
    } finally {
      this.task.close();
    }
  }
}

/** Fail if a response-format scenario reaches unrelated engineering or delivery effects. */
async function unavailable(): Promise<never> {
  throw new Error('Unexpected engineering or delivery effect');
}

test('Director holds one native finding through changing log paths and domain wrappers', async (t) => {
  await new NativeResponseScenario(t).runDirector();
});

test('steward holds unchanged malformed output across different transcript artifacts', async (t) => {
  await new NativeResponseScenario(t).runSteward(t);
});

test('checked-input progress permits the steward to repair the same native finding again', async (t) => {
  await new NativeResponseScenario(t, true).runSteward(t);
});
