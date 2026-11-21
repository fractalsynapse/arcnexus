import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type Capture } from '../../../architecture/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import type { Plan } from '../../../direction/src/index.js';
import { HostTask } from '../../../execution/src/index.js';
import { verify } from '../../src/index.js';

export const suite = { owner: 'verification', level: 'integration', tags: ['regression'] } as const;

/** Keep real journal, check receipts and independent assessment while controlling external execution only. */
class ScopeVerification {
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-quality-verification-'));
  private readonly capture = {
    source: {
      root: join(this.root, 'project'),
      remote: 'https://github.com/example/project.git',
      revision: 'baseline',
    },
    project: {
      verifier: { component: 'auditor', activity: 'assessment' },
      checks: { acceptance: ['required'] },
    },
    components: {},
    operations: {},
  } as unknown as Capture;

  readonly task: HostTask;
  readonly candidate = { digest: 'candidate', evidence: [] };
  readonly plan = {
    focus: {},
    milestones: [
      {
        id: 'change',
        owner: 'service',
        criteria: [{ id: 'works', description: 'Required checks establish the candidate' }],
        steps: [],
      },
    ],
  } as unknown as Plan;

  /** Observe a zero process exit independently of whether its host-validated scope is valid. */
  constructor(context: TestContext, diagnostic?: string) {
    const root = this.root;
    const capture = this.capture;
    mkdirSync(capture.source.root);
    const journal = new Coordination(join(root, 'state')).admit(
      capture.source.remote,
      'Verify scope',
    );
    assert(journal instanceof Journal);
    this.task = new HostTask(
      {
        capture,
        common: '',
        executable: '',
        base: 'staging',
        fresh: true,
        storage: join(root, 'state'),
      },
      'Verify scope',
      journal,
    );
    context.after(() => {
      this.task.close();
      rmSync(root, { recursive: true, force: true });
    });
    this.control(context, diagnostic);
  }

  /** Preserve command status and actual evidence; the fake Reviewer deliberately accepts all engineering criteria. */
  private control(context: TestContext, diagnostic?: string) {
    context.mock.method(this.task, 'check', async (id: string) => {
      const log = this.task.store('check.log', diagnostic ?? 'Controlled valid scope');
      const result = {
        id,
        command: 'controlled',
        args: [],
        cwd: this.task.capture.source.root,
        durationMs: 0,
        log,
        status: 0,
        diagnostic,
      };
      this.task.note({ check: result });
      return result;
    });
    context.mock.method(
      this.task,
      'activate',
      async (...[, , data]: Parameters<HostTask['activate']>) => ({
        ...(data.assignment as { accepted: Record<string, unknown> }).accepted,
        criteria: ['works'],
        evidence: [...this.task.evidence],
      }),
    );
  }

  /** Exercise the public final gate, not a replicated predicate or a fake verifier. */
  run() {
    return verify(
      new Agent(new Architecture()),
      this.task,
      this.plan,
      this.candidate,
      new AbortController().signal,
    );
  }
}

test('independent acceptance cannot override a required check scope diagnostic at exit zero', async (context) => {
  const scenario = new ScopeVerification(
    context,
    'Quality ownership differs from captured authority',
  );
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'blocked');
  assert.match(outcome.kind === 'blocked' ? outcome.reason : '', /checks failed/);
});

test('valid passing check scope retains independent candidate acceptance', async (context) => {
  const scenario = new ScopeVerification(context);
  assert.equal((await scenario.run()).kind, 'accepted');
});
