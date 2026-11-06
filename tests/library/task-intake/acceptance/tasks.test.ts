import { validateSchema } from '../../../../dist/library/architecture/schema.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import type { DirectorResult } from '../../../../dist/library/task-intake/direction.js';
import { cli, workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Preserves historical proposal inspection without retaining proposal-driven execution. */
class HistoricalProposalScenarios {
  /** Reads intact historical data and rejects tampering without invoking a model. */
  inspect(t: TestContext): void {
    const f = workflowFixture(t);
    const directory = join(f.state, 'proposals');
    mkdirSync(directory, { recursive: true });
    const value = { schemaVersion: 1, id: 'old', status: 'ready', request: { text: 'Old goal' } };
    const path = join(directory, 'old.json');
    const retained = { ...value, digest: digest(JSON.stringify(value)) };
    writeFileSync(path, JSON.stringify(retained));
    const invoke = () =>
      spawnSync(process.execPath, [cli, 'task', 'inspect', 'old', '--json'], {
        encoding: 'utf8',
        env: f.env,
      });
    const result = invoke();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), retained);
    writeFileSync(path, JSON.stringify({ ...retained, status: 'completed' }));
    assert.equal(invoke().status, 2);
  }
}

const scenarios = new HistoricalProposalScenarios();

const directorResultFixture: DirectorResult = {
  status: 'ready',
  summary: 'No dependency retirement proposal',
  selectedOwners: [],
  rejectedOwners: [],
  questions: [],
  assignments: [],
  dependency: null,
  architectureProposal: null,
  continuations: [],
  dependencyRetirementProposal: null,
};

test('director schema accepts explicit retirement and rejects missing, empty or expanded authority', () => {
  const validate = (proposal: unknown) =>
    validateSchema('director-result', {
      ...directorResultFixture,
      dependencyRetirementProposal: proposal,
    });
  assert.doesNotThrow(() => validate(null));
  assert.doesNotThrow(() => validate({ requestId: 'request', rationale: 'No longer required' }));
  for (const proposal of [
    undefined,
    {},
    { requestId: '', rationale: 'Reason' },
    { requestId: 'request', rationale: '' },
    { requestId: 'request', rationale: 'Reason', owner: 'other' },
  ])
    assert.throws(() => validate(proposal), /Invalid director-result/);
});

test('historical task proposals remain inspectable and integrity checked', (t) =>
  scenarios.inspect(t));

registerSuite({ component: 'task-intake', level: 'acceptance', tags: ['deterministic'] });
