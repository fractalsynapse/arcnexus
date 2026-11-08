import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CheckedEditBridge } from '../../../../dist/library/assignment/checked-edit-bridge.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { CheckedEditFixture } from '../support/checked-edit-fixture.js';

const contractPath = 'docs/interface/arcnexus-foundation.md';

const locks = (files: { id: string; file: string }[]) => files;

/** Refuses writes to locked interface contracts using only the run's captured locks. */
class LockedContractScenarios extends CheckedEditFixture {
  /** Places captured locks on the host state without granting any write scope. */
  private bridge(
    t: TestContext,
    entries = locks([{ id: 'arcnexus/foundation', file: contractPath }]),
  ) {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    state.resolved.contractLocks = entries;
    return { state, bridge: new CheckedEditBridge(state) };
  }

  /** Refuses a locked contract path before ownership is consulted and applies nothing. */
  locked(t: TestContext): void {
    const { state, bridge } = this.bridge(t);
    const result = bridge.call('source.edit', this.request(contractPath)) as any;
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason, 'contract_locked');
    assert.equal(result.contractId, 'arcnexus/foundation');
    assert.match(result.recovery, /locked interface contract/);
    assert.match(result.recovery, /Counter the request/);
    assert.match(result.recovery, /do not edit the contract registry to unlock it/);
    assert.match(result.recovery, /Continue only work that does not depend/);
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
  }

  /** Protects the registry that records the locks while any contract is locked. */
  registry(t: TestContext): void {
    const { bridge } = this.bridge(t);
    const result = bridge.call('source.edit', this.request('docs/interface/registry.yaml')) as any;
    assert.equal(result.reason, 'contract_locked');
    assert.equal(result.contractId, 'contract-registry');
  }

  /** Refuses a locked contract the steward would otherwise be allowed to edit. */
  insideScope(t: TestContext): void {
    const { bridge } = this.bridge(
      t,
      locks([{ id: 'arcnexus/example', file: 'owned/contract.md' }]),
    );
    const result = bridge.call('source.edit', this.request('owned/contract.md')) as any;
    assert.equal(result.reason, 'contract_locked', 'ownership never authorizes a locked contract');
  }

  /** Leaves normal ownership routing in force when the run captured no locks. */
  unlocked(t: TestContext): void {
    const { state, bridge } = this.bridge(t, []);
    state.resolved.ownership = [{ ownerId: 'foundation', paths: ['docs'] }];
    const result = bridge.call('source.edit', this.request(contractPath)) as any;
    assert.equal(
      result.reason,
      'owner_boundary',
      'the lock check is what refused the earlier edits',
    );
    assert.equal(result.ownerId, 'foundation');
  }
}

const scenarios = new LockedContractScenarios();

test('a locked contract edit is refused with the counter guidance and no mutation', (t) =>
  scenarios.locked(t));

test('the contract registry is protected while any contract is locked', (t) =>
  scenarios.registry(t));

test('a locked contract inside the owner’s own scope is still refused', (t) =>
  scenarios.insideScope(t));

test('without captured locks the normal owner boundary still applies', (t) =>
  scenarios.unlocked(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'edit-authority', 'contracts'],
});
