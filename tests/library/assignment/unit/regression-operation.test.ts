import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSchema } from '../../../../dist/library/architecture/schema.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks stable regression selection and observed target evidence independently of worker claims. */
class RegressionScenarios {
  /** Both engineering response contracts load the same stable operation expectation from packaged authority. */
  contracts(): void {
    for (const name of ['agent-result', 'general-agent-result', 'workday-agent-result']) {
      const regression = readSchema(name).properties.regression;
      assert.ok(regression.anyOf.some((entry: any) => entry.properties?.operationId));
      assert.ok(regression.anyOf.some((entry: any) => entry.properties?.verificationIndex));
    }
  }

  /** Stable IDs survive reordering, while legacy index evidence cannot become a new execution. */
  async selection(): Promise<void> {
    const { RegressionOperation } = await this.runtime();
    const operation = this.operation();
    const component = { schemaVersion: 6, id: 'owner', verification: [operation] };
    const selection = new RegressionOperation(component, {});
    assert.equal(selection.select({ operationId: 'tests' }), operation);
    component.verification.unshift({ ...operation, id: 'lint' });
    assert.equal(selection.select({ operationId: 'tests' }), operation);
    assert.throws(() => selection.select({ verificationIndex: 0 }), /operationId/);
    assert.throws(() => selection.select({ operationId: 'unknown' }), /captured verification/);
    component.schemaVersion = 4;
    assert.throws(() => selection.select({ verificationIndex: 1 }), /version.six/);
  }

  /** A failed prerequisite cannot establish expected-red evidence for the selected test operation. */
  async evidence(): Promise<void> {
    const { RegressionOperation } = await this.runtime();
    const operation = this.operation();
    const result = { log: 'test.log', exitCode: 1 };
    const invocation = {
      id: 'invocation',
      operationId: 'build',
      definitionDigest: 'digest',
      context: { ownerId: 'owner' },
      result,
      status: 'failed',
    };
    const record: any = { operationInvocations: [invocation] };
    const selection = new RegressionOperation({ schemaVersion: 6, id: 'owner' }, record);
    assert.throws(() => selection.capture(operation, result), /selected regression operation/);
    invocation.operationId = 'tests';
    record.operationInvocations.push({ operationId: 'service', status: 'completed' });
    selection.capture(operation, result);
    assert.equal(record.regressionInvocation.id, 'invocation');
    assert.deepEqual(record.regressionInvocation.context, { ownerId: 'owner' });
    invocation.context.ownerId = 'another';
    assert.equal(record.regressionInvocation.context.ownerId, 'owner');
    assert.throws(() => selection.capture(operation, result), /selected regression operation/);
  }

  /** Loads the assembled implementation so absent production wiring fails visibly. */
  private async runtime(): Promise<any> {
    const module = '../../../../dist/library/assignment/regression-operation.js';
    return import(module);
  }

  /** Supplies the captured identity needed to distinguish verification from prerequisites. */
  private operation(): any {
    return {
      schemaVersion: 4,
      kind: 'command',
      id: 'tests',
      definitionDigest: 'digest',
      resolvedContext: { ownerId: 'owner' },
    };
  }
}

const scenarios = new RegressionScenarios();

test('regression selection uses stable operation identity for minimal components', () =>
  scenarios.selection());

test('regression evidence requires the selected operation rather than a prerequisite', () =>
  scenarios.evidence());

test('packaged response contracts expose stable regression operations', () =>
  scenarios.contracts());

registerSuite({ component: 'assignment', level: 'unit', tags: ['deterministic'] });
