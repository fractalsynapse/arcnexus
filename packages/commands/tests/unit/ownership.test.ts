import assert from 'node:assert/strict';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Context } from 'cordis';
import { agentPlugin } from '../../../agent/src/index.js';
import { architecturePlugin, type OwnershipAudit } from '../../../architecture/src/index.js';
import { Workflow } from '../../../workflow/src/index.js';
import { commandsPlugin } from '../../src/index.js';
import { AuditProject, remote } from '../integration/audit-project.js';

export const suite = { owner: 'commands', level: 'unit', tags: ['regression'] } as const;

/** Reject every task lifecycle entry so an ownership query cannot silently admit work or invoke a provider. */
class ForbiddenWorkflow extends Workflow {
  readonly calls: string[] = [];
  private readonly reject = (): never => {
    this.calls.push('unexpected task lifecycle');
    assert.fail('Ownership inspection must not enter Workflow');
  };
  override run = this.reject;
  override update = this.reject;
  override round = this.reject;
  override refine = this.reject;
}

/** Invoke the installed public SDK without supplying terminal handles or task services. */
class OwnershipConsumer {
  readonly context = new Context();
  readonly workflow = new ForbiddenWorkflow();

  /** Compose the real Architecture and Agent plugins with a guarded Workflow dependency. */
  async mount() {
    await this.context.use(architecturePlugin);
    await this.context.use(agentPlugin);
    await this.context.use((scope: Context) => scope.provide('workflow', this.workflow));
    await this.context.use(commandsPlugin);
    assert.ok(this.context.commands, 'Commands must resolve through real Cordis injection');
  }

  /** Reach missing SDK behavior at runtime while keeping the pre-implementation TypeScript build valid. */
  audit(directory: string): OwnershipAudit {
    const commands = this.context.commands;
    assert.ok(
      'checkOwnership' in commands,
      'Commands.checkOwnership must expose the delivered Architecture ownership audit',
    );
    assert.equal(typeof commands.checkOwnership, 'function');
    const operation = commands.checkOwnership as Context['architecture']['checkOwnership'];
    return operation.call(commands, directory);
  }

  /** Make terminal reads, output and process exits observable failures during the structured call. */
  withoutTerminal(t: TestContext, directory: string) {
    const reject = (): never => assert.fail('Ownership SDK must not use the terminal');
    const mocks = [
      t.mock.method(process.stdout, 'write', reject),
      t.mock.method(process.stderr, 'write', reject),
      t.mock.method(process.stdin, 'read', reject),
      t.mock.method(process, 'exit', reject),
    ];
    try {
      return this.audit(directory);
    } finally {
      for (const method of mocks) method.mock.restore();
    }
  }
}

/** State the complete mixed result independently of either public service's implementation. */
function expectedAudit(project: AuditProject): OwnershipAudit {
  return {
    source: {
      kind: 'working-tree',
      root: project.root,
      remote,
      revision: project.capture.source.revision,
    },
    paths: [...project.tracked, ...project.candidatePaths].sort(),
    findings: [
      { kind: 'collision', path: 'shared/first.ts', owners: ['alpha', 'beta', 'zeta'] },
      { kind: 'collision', path: 'shared/second.ts', owners: ['alpha', 'beta', 'zeta'] },
      { kind: 'unowned', path: 'unowned/first.ts' },
      { kind: 'unowned', path: 'unowned/second.ts' },
    ],
  };
}

test('nonterminal SDK preserves every candidate finding, nested source identity and immutable authority', async (t) => {
  const project = new AuditProject(t);
  const consumer = new OwnershipConsumer();
  await consumer.mount();
  const expected = expectedAudit(project);
  const captured = JSON.stringify(project.capture);
  const before = project.snapshot();
  assert.deepEqual(consumer.context.architecture.checkOwnership(project.root), expected);
  const delegated = t.mock.method(consumer.context.architecture, 'checkOwnership');
  assert.deepEqual(consumer.withoutTerminal(t, project.root), expected);
  assert.deepEqual(consumer.withoutTerminal(t, join(project.root, 'nested')), expected);
  assert.deepEqual(
    delegated.mock.calls.map((call) => call.arguments),
    [[project.root], [join(project.root, 'nested')]],
  );
  assert.deepEqual(project.snapshot(), before);
  assert.equal(JSON.stringify(project.capture), captured);
  assert.deepEqual(
    consumer.context.architecture.capture(project.root).components,
    project.capture.components,
  );
  assert.deepEqual(consumer.workflow.calls, []);
});

test('nonterminal SDK preserves Architecture validation errors instead of fabricating a clean audit', async (t) => {
  const project = new AuditProject(t);
  const consumer = new OwnershipConsumer();
  await consumer.mount();
  project.write('.arc/architecture/components/zeta.yaml', 'owns: [unterminated\n');
  const before = project.snapshot();
  for (const directory of [project.root, join(project.root, 'missing')]) {
    let original: unknown;
    try {
      consumer.context.architecture.checkOwnership(directory);
    } catch (error) {
      original = error;
    }
    assert.ok(original instanceof Error, 'Fixture must reach a genuine Architecture source error');
    assert.throws(() => consumer.withoutTerminal(t, directory), {
      name: original.name,
      message: original.message,
    });
  }
  assert.deepEqual(project.snapshot(), before);
  assert.deepEqual(consumer.workflow.calls, []);
});
