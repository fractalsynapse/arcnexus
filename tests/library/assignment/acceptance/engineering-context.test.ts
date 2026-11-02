import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Verifies the assembled context communicates the usable write route without expanding authority. */
class EngineeringContextScenarios {
  /** Minimal engineering discovers checked edits and preserves stage, scope and transaction restrictions. */
  async checked(): Promise<void> {
    const prompt = await this.context(5);
    assert.match(prompt, /source\.edit/);
    assert.match(prompt, /tool search/);
    assert.match(prompt, /SHA-256/);
    assert.match(prompt, /fresh unique transaction ID/);
    assert.match(prompt, /planning, coordination, research and review remain read-only/);
    assert.match(prompt, /Native patch and shell writes.*intentionally unavailable/);
    assert.match(prompt, /Authorized edit paths: \["owned"\]/);
    assert.match(prompt, /hostChecks.*check/);
    assert.doesNotMatch(prompt, /secret-check-command/);
  }

  /** Historical execution context must not advertise a bridge that its retained configuration lacks. */
  async historical(): Promise<void> {
    assert.doesNotMatch(await this.context(4), /source\.edit/);
  }

  /** Loads production context assembly with captured authority and a distinct frozen host check. */
  private async context(schemaVersion: number): Promise<string> {
    const path = new URL(
      '../../../../dist/library/assignment/engineering-context.js',
      import.meta.url,
    );
    const { EngineeringContext } = await import(path.href);
    const state = {
      options: { id: 'owner', record: { workspace: '/candidate' } },
      resolved: { role: { id: 'engineer' }, context: [], related: [], owners: [], operations: [] },
      component: { schemaVersion, verification: [] },
      scope: ['owned'],
      planned: true,
      assignment: {
        kind: 'change',
        hostChecks: [{ id: 'check', command: 'secret-check-command' }],
      },
    };
    return new EngineeringContext(state).render();
  }
}

const scenarios = new EngineeringContextScenarios();

test('engineering context explains the only maintained-source write route', () =>
  scenarios.checked());

test('historical engineering context does not advertise unavailable checked editing', () =>
  scenarios.historical());

registerSuite({ component: 'assignment', level: 'acceptance', tags: ['deterministic'] });
