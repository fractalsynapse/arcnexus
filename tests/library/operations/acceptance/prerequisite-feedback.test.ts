import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { OperationExecution } from '../../../../dist/library/operations/operation-execution.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import {
  minimalOperationFixture,
  configureAgentOperation,
} from '../../testing/support/operations-fixture.js';

/** Exercises corrective prerequisite feedback through the built SDK/MCP bridge and confined operations. */
class PrerequisiteFeedback {
  /** A failed compiler returns evidence, suppresses dependent artifacts and permits later checked correction. */
  async correct(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    const replies = readFileSync(join(f.root, 'operations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(JSON.parse(line).content[0].text));
    assert.equal(replies[0].id, 'agent-probe');
    assert.equal(replies[0].failedOperationId, 'compile');
    assert.equal(replies[0].prerequisiteFailed, true);
    assert.equal(replies[0].exitCode, 7);
    assert.match(replies[0].output, /CONTROLLED_COMPILER_FAILURE/);
    assert.deepEqual(replies[0].artifacts, []);
    assert.deepEqual(
      replies.slice(1).map((reply) => reply.status),
      ['passed'],
    );
    assert.equal(readFileSync(join(record.workspace, 'generated/dependent'), 'utf8'), 'x');
    assert.equal(record.operations[0].failedOperationId, 'compile');
    await this.requiredCheckStillFails(f, record);
  }

  /** Mandatory checks still reject prerequisite failure instead of declaring a selected regression observed. */
  private async requiredCheckStillFails(f: any, record: any): Promise<void> {
    writeFileSync(join(record.workspace, 'source.txt'), 'before');
    const op = record.resolvedAssignment.operations.find(
      (entry: any) => entry.id === 'agent-probe',
    );
    await assert.rejects(
      new OperationExecution(f.state, record, new AbortController().signal).run(op, 'verification'),
      (error: any) => error.operationId === 'compile' && error.commandResult.exitCode === 7,
    );
    assert.equal(readFileSync(join(record.workspace, 'generated/dependent'), 'utf8'), 'x');
    assert.equal(record.operationInvocations.at(-1).operationId, 'compile');
    assert.equal(record.operationInvocations.at(-1).status, 'failed');
  }

  /** Adds one genuine prerequisite without changing the fixture's mandatory regression operation. */
  private fixture(t: TestContext) {
    const f = minimalOperationFixture(t);
    configureAgentOperation(f, [
      '-e',
      "const f=require('fs');f.mkdirSync('generated',{recursive:true});f.appendFileSync('generated/dependent','x');require('./verify.cjs');",
    ]);
    const path = join(f.repo, '.arc/architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    platform.operations.compile = ['agent'];
    writeFileSync(path, JSON.stringify(platform));
    const operation = join(f.repo, '.arc/architecture/operations/agent-probe.yaml');
    const probe = JSON.parse(readFileSync(operation, 'utf8'));
    writeFileSync(
      join(f.repo, '.arc/architecture/operations/compile.yaml'),
      JSON.stringify({
        ...probe,
        id: 'compile',
        args: [
          '-e',
          "if(require('fs').readFileSync('source.txt','utf8')!=='after'){console.error('CONTROLLED_COMPILER_FAILURE');process.exit(7);}",
        ],
      }),
    );
    writeFileSync(
      operation,
      JSON.stringify({ ...probe, prerequisites: ['compile'], artifacts: ['generated/dependent'] }),
    );
    f.commit();
    return f;
  }
}

test('observed prerequisite failures permit agent correction but never satisfy mandatory checks', (t) =>
  new PrerequisiteFeedback().correct(t));

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['native-host', 'operations'],
});
