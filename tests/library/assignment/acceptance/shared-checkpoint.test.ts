import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { SessionState } from '../../../../dist/library/assignment/session-state.js';
import {
  normalizeOperation,
  OperationArguments,
} from '../../../../dist/library/operations/operation-definition.js';
import type { Operation } from '../../../../dist/library/operations/operations.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises assignment checkpoint dispatch with actual confined Node commands and retained evidence. */
class SharedCheckpointScenarios {
  /** Prerequisites run once per checkpoint, and a later failure retains earlier completed results. */
  async execution(t: TestContext): Promise<void> {
    const { state, workspace, operations } = this.fixture(t);
    const checks = Reflect.get(state, 'checks');
    assert.equal(typeof checks, 'function');
    await checks.call(state, operations, 'baseline');
    assert.equal(readFileSync(join(workspace, 'generated/count'), 'utf8'), 'x');
    assert.equal(state.options.record.commands.length, 2);
    await assert.rejects(checks.call(state, operations, 'verification'), /Command failed/);
    assert.equal(readFileSync(join(workspace, 'generated/count'), 'utf8'), 'xx');
    assert.equal(state.options.record.commands.length, 4);
    assert.equal(state.options.record.commands.at(-1)!.exitCode, 1);
    assert.equal(state.options.record.commands.at(-1)!.stage, 'verification');
  }

  /** Creates the host session shell around a captured owner without model or source-edit privileges. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-session-checks-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const workspace = join(root, 'source');
    mkdirSync(workspace);
    mkdirSync(join(root, 'runs/run'), { recursive: true });
    assert.equal(spawnSync('git', ['init', '-q', workspace]).status, 0);
    const operations = [
      this.operation('prepare', "require('fs').appendFileSync('generated/count','x')"),
      this.operation(
        'check',
        "if(require('fs').readFileSync('generated/count','utf8')!=='x')process.exit(1)",
        ['prepare'],
      ),
    ];
    const owner = {
      id: 'owner',
      repository: 'sample',
      access: { readPaths: ['.'] },
      allowedWritePaths: ['src'],
      operationPlan: { verify: operations },
    };
    return { state: this.session(root, workspace, owner), workspace, operations };
  }

  /** Supplies captured authority and persistent journal state for the actual assignment dispatch method. */
  private session(root: string, workspace: string, owner: unknown): SessionState {
    return Object.assign(Object.create(SessionState.prototype), {
      component: { schemaVersion: 5 },
      dir: join(root, 'runs/run'),
      turns: [],
      activities: [],
      options: {
        root,
        signal: new AbortController().signal,
        record: {
          id: 'run',
          workspace,
          commands: [],
          commonDir: join(workspace, '.git'),
          bindings: { tools: { codex: process.env.ARCNEXUS_TEST_CODEX } },
          resolvedAssignment: { context: [owner], initialization: { catalog: [owner] } },
        },
      },
    }) as SessionState;
  }

  /** Captures finite operations whose only writes are untracked generated output. */
  private operation(id: string, script: string, prerequisites: string[] = []) {
    return new OperationArguments().capture(
      normalizeOperation({
        schemaVersion: 4,
        id,
        purpose: 'Check captured behavior',
        repository: 'sample',
        kind: 'command',
        command: process.execPath,
        args: ['-e', script],
        cwd: '.',
        prerequisites,
        category: 'unit-test',
        activities: ['testing'],
        generatedDirectories: ['generated'],
        artifacts: [],
        probes: [],
      }),
      { ownerId: 'owner', ownedPaths: ['src'], packageRoot: '.' },
    ) as Extract<Operation, { kind: 'command' | 'service' }>;
  }
}

const scenarios = new SharedCheckpointScenarios();

test(
  'assignment checkpoints deduplicate preparation and retain partial command results',
  { skip: !process.env.ARCNEXUS_TEST_CODEX },
  (t) => scenarios.execution(t),
);

registerSuite({ component: 'assignment', level: 'acceptance', tags: ['deterministic'] });
