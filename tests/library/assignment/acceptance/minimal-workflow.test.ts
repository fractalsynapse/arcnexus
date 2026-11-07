import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { minimalWorkflowFixture } from '../../testing/support/workflow-fixture.js';

/** Keeps engineering characterization on minimal authority, actual confinement and checked edits. */
class MinimalWorkflowScenarios {
  /** Completes a real confined operation and applies its oversized output only through checked MCP edits. */
  proposal(t: TestContext): void {
    const fixture = minimalWorkflowFixture(t, 'proposal-edit');
    const path = join(fixture.repo, 'architecture/operations/verify.yaml');
    const operation = JSON.parse(readFileSync(path, 'utf8'));
    operation.id = 'edit-proposal';
    operation.args = ['-e', this.proposalCommand()];
    writeFileSync(
      join(fixture.repo, 'architecture/operations/edit-proposal.yaml'),
      JSON.stringify(operation),
    );
    fixture.component.operations = { 'edit-proposal': ['agent'] };
    writeFileSync(
      join(fixture.repo, 'architecture/components/sample.json'),
      JSON.stringify(fixture.component),
    );
    fixture.commit();
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'prepared_for_assembly');
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
    assert.equal(
      readFileSync(join(record.workspace, 'new.txt'), 'utf8'),
      'large-content-'.repeat(3000),
    );
    assert.equal(Object.keys(record.operationEditProposals).length, 1);
    assert.equal(readdirSync(join(fixture.state, 'runs', record.id, 'checked-edits')).length, 2);
  }

  /** Produces a complete structured proposal without allowing the managed command to mutate source. */
  private proposalCommand(): string {
    return `const fs=require('fs'),crypto=require('crypto');console.log(JSON.stringify({id:'proposal',changes:[
      {path:'source.txt',operation:'update',expectedSha256:crypto.createHash('sha256').update(fs.readFileSync('source.txt')).digest('hex'),content:'after'},
      {path:'new.txt',operation:'create',expectedSha256:null,content:'large-content-'.repeat(3000)}
    ]}));console.error("Proxy diagnostic on stderr must not corrupt structured stdout");`;
  }

  /** Plans, observes an expected failing regression and completes through host-mediated source transactions. */
  engineering(t: TestContext): void {
    const fixture = minimalWorkflowFixture(t);
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'prepared_for_assembly');
    assert.deepEqual(
      record.turns.map((turn: any) => turn.activity),
      ['planning', 'specification', 'implementation'],
    );
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
    assert.equal(readdirSync(join(fixture.state, 'runs', record.id, 'checked-edits')).length, 2);
    assert.equal(record.regressionCheckpoint.operationId, 'verify');
    assert.equal(record.regressionCheckpoint.verificationIndex, undefined);
    assert.ok(record.operationInvocations.some((op: any) => op.result?.exitCode === 1));
    assert.ok(!record.operationInvocations.some((op: any) => op.purpose === 'verification'));
    assert.ok(record.plan.hostChecks.every((check: any) => check.status === 'pending'));
    assert.ok(record.operationInvocations.every((op: any) => op.definitionDigest));
  }

  /** Preserves the read-only workflow without direct source permission or an artificial change template. */
  research(t: TestContext): void {
    const fixture = minimalWorkflowFixture(t);
    const result = fixture.run('--kind', 'research');
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'research_completed');
    assert.deepEqual(record.changes, []);
    assert.deepEqual(
      record.turns.map((turn: any) => turn.activity),
      ['planning', 'research'],
    );
    assert.ok(record.operationInvocations.every((op: any) => op.status === 'completed'));
  }
}

const scenarios = new MinimalWorkflowScenarios();

test('oversized operation edit proposals complete through native confinement and MCP', (t) =>
  scenarios.proposal(t));

test('minimal engineering uses checked edits and shared expected-red verification', (t) =>
  scenarios.engineering(t));

test('minimal read-only research retains planning and shared verification', (t) =>
  scenarios.research(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
