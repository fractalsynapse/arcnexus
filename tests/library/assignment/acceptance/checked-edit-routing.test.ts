import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CheckedEditBridge } from '../../../../dist/library/assignment/checked-edit-bridge.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { CheckedEditFixture } from '../support/checked-edit-fixture.js';

/** Exercises recoverable edit boundaries and authoritative inbox recipient selection. */
class RoutingScenarios extends CheckedEditFixture {
  /** Routes rejected cross-owner work to the actual captured steward without applying any batch member. */
  delegation(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    state.resolved.ownership = [{ ownerId: 'recipient', paths: ['other'] }];
    mkdirSync(join(state.options.record.workspace, 'other'));
    writeFileSync(join(state.options.record.workspace, 'other/file.ts'), 'before');
    const bridge = new CheckedEditBridge(state);
    const request = this.request('owned/file.ts');
    request.changes.push({ ...request.changes[0]!, path: 'other/file.ts' });
    const result = bridge.call('source.edit', request) as any;
    assert.equal(result.status, 'rejected');
    assert.equal(result.ownerId, 'recipient');
    assert.equal(result.reason, 'owner_boundary');
    this.linkingGuidance(result.recovery);
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'before',
    );
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'other/file.ts'), 'utf8'),
      'before',
    );
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
    assert.deepEqual(state.scope, ['owned']);
  }

  /** Requires evidence-based reuse of accepted supplier work without granting cross-owner writes. */
  private linkingGuidance(recovery: string): void {
    assert.match(recovery, /existing inbox protocol/);
    assert.match(
      recovery,
      /assignment\.evidence/,
      'cross-owner rejection must inspect existing assignment evidence',
    );
    assert.match(recovery, /assignmentId/);
    assert.match(recovery, /canonical accepted contract/);
    assert.match(recovery, /distinct work/);
    assert.match(recovery, /milestone=delivered/);
    assert.match(recovery, /verified delivery/);
    assert.match(recovery, /Do not edit this path yourself/);
  }

  /** Refuses guessed recipients, unsafe paths and dispatch outside the captured eligible catalog. */
  unavailable(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    state.resolved.ownership = [{ ownerId: 'external', paths: ['other'], eligible: false }];
    const bridge = new CheckedEditBridge(state);
    const result = bridge.call('source.edit', this.request('other/file.ts')) as any;
    assert.equal(result.ownerId, 'external');
    assert.match(result.recovery, /architectural blocker/);
    assert.doesNotMatch(result.recovery, /requests entry/);
    assert.throws(
      () => bridge.call('source.edit', this.request('other/../private')),
      /relative path/,
    );
    state.resolved.ownership.push({ ownerId: 'duplicate', paths: ['other'] });
    assert.throws(() => bridge.call('source.edit', this.request('other/file.ts')), /ambiguous/);
    assert.throws(
      () => bridge.call('source.edit', this.request('unknown/file.ts')),
      /without guessing/,
    );
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
  }
}

const scenarios = new RoutingScenarios();

test('cross-owner edits return captured recipient and inbox delegation instructions without mutation', (t) =>
  scenarios.delegation(t));

test('unavailable or ambiguous owners never generate guessed inbox routes', (t) =>
  scenarios.unavailable(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'edit-routing'],
});
