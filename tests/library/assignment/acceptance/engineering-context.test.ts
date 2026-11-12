import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSchema, validateSchema } from '../../../../dist/library/architecture/schema.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** The per-activity grant a steward frame reads: position, direction, bound operations. */
const implementationGrant = {
  role: { id: 'engineer', responsibilities: ['Change within the owned scope and verify it'] },
  instructions: ['Change only what this goal requires inside the owned scope'],
  operations: [],
  standards: [],
};

/** Verifies the assembled context communicates the usable write route without expanding authority. */
class EngineeringContextScenarios {
  /** Minimal engineering discovers checked edits and preserves stage, scope and transaction restrictions. */
  async checked(): Promise<void> {
    const prompt = await this.context(6);
    assert.match(prompt, /source\.edit/);
    assert.match(prompt, /tool search/);
    assert.match(prompt, /SHA-256/);
    assert.match(prompt, /relative to the workspace, never absolute/);
    assert.match(
      readSchema('checked-edits').properties.changes.items.properties.path.description,
      /relative.*never absolute/,
    );
    assert.match(prompt, /fresh unique transaction ID/);
    assert.match(prompt, /planning, coordination, research and review remain read-only/);
    assert.match(prompt, /Native patch and shell writes.*intentionally unavailable/);
    assert.match(prompt, /Authorized edit paths: \["owned"\]/);
    assert.match(prompt, /hostChecks.*check/);
    assert.doesNotMatch(prompt, /secret-check-command/);
  }

  /** A retained context observes new freezes and never discloses frozen source content. */
  async checkpoint(): Promise<void> {
    const path = new URL(
      '../../../../dist/library/assignment/engineering-context.js',
      import.meta.url,
    );
    const { EngineeringContext } = await import(path.href);
    const state = { frozen: [] as { path: string; sha256: string; content: string }[] };
    const context = new EngineeringContext(state);
    assert.match(context.checkpoint(), /Retained regression evidence: \[\]/);
    state.frozen.push({ path: 'owned/regression.test.ts', sha256: 'captured', content: 'private' });
    const prompt = context.checkpoint();
    assert.match(prompt, /"path":"owned\/regression.test.ts","sha256":"captured"/);
    assert.match(prompt, /does not expand edit authority/);
    assert.match(prompt, /Captured trusted acceptance remains independently enforced/);
    assert.match(prompt, /explain corrections against the original acceptance criteria/);
    assert.match(prompt, /independent review must reject removed or weakened coverage/);
    assert.match(prompt, /evidence, not additional architectural authority/);
    assert.doesNotMatch(prompt, /private/);
  }

  /** Joint preparation remains automatic while independent acceptance and genuine blockers remain required. */
  async contribution(): Promise<void> {
    const ordinary = await this.context(6);
    const related = await this.context(6, ['implementation', 'tests']);
    assert.doesNotMatch(ordinary, /Related contribution workflow/);
    assert.match(related, /host automatically records prepared source after implementation/);
    assert.match(related, /no preparation or handoff tool to call/);
    assert.match(related, /Preserve observed failed checks and genuine unresolved defects/);
    assert.match(related, /independently verifies the combined candidate before any delivery/);
    assert.match(related, /Pending host verification alone is not a blocker/);
    assert.match(related, /Authorized edit paths: \["owned"\]/);
  }

  /** Historical evidence cannot be rendered as a new engineering activation. */
  async historical(): Promise<void> {
    await assert.rejects(this.context(4), /version.six.*migrat/i);
    await assert.rejects(this.context(5), /version.six.*migrat/i);
  }

  /** Loads production context assembly with captured authority and a distinct frozen host check. */
  private async context(schemaVersion: number, contributionGroup?: string[]): Promise<string> {
    const path = new URL(
      '../../../../dist/library/assignment/engineering-context.js',
      import.meta.url,
    );
    const { EngineeringContext } = await import(path.href);
    return new EngineeringContext(this.contextState(schemaVersion, contributionGroup)).render(
      'implementation',
    );
  }

  /**
   * A resolved context in the shape the frame reads.
   *
   * `render` requires the selected activity, so the grant, the mode and the assignment objective all
   * live in the resolved context; a component states no role of its own, and the frame quotes the
   * assignment rather than reaching for a working-tree goal.
   */
  private contextState(schemaVersion: number, contributionGroup?: string[]): any {
    return {
      options: {
        id: 'owner',
        record: {
          workspace: '/candidate',
          contributionGroup,
          generalExecution: Boolean(contributionGroup),
        },
      },
      resolved: {
        mode: 'steward',
        assignment: { objective: 'Expose the maintained write route', acceptanceCriteria: [] },
        activities: { implementation: implementationGrant },
        context: [],
        related: [],
        owners: [],
        operations: [],
      },
      component: { id: 'sample', type: 'library', schemaVersion, verification: [] },
      scope: ['owned'],
      planned: true,
      assignment: {
        kind: 'change',
        hostChecks: [{ id: 'check', command: 'secret-check-command' }],
      },
    };
  }
}

/** Exercises the packaged inbox schema without duplicating supplier contract terms. */
class InboxSchemaScenarios {
  /** A deliberate supplier link carries only the caller need and an empty criteria array. */
  linked(): void {
    const result = this.result(this.request());
    assert.doesNotThrow(
      () => validateSchema('general-agent-result', result),
      'explicit supplier links accept caller need without copied criteria',
    );
    const request = this.request();
    request.acceptanceCriteria = [''];
    assert.throws(() => validateSchema('general-agent-result', this.result(request)));
  }

  /** Full-criteria general requests and supported historical reports remain readable. */
  historical(): void {
    const request = this.request();
    request.assignmentId = null;
    request.acceptanceCriteria = ['The requested distinct outcome is demonstrated.'];
    validateSchema('general-agent-result', this.result(request));
    const { assignmentId, milestone, kind, changeType, ...legacy } = request;
    assert.equal(assignmentId, null);
    assert.equal(milestone, 'delivered');
    assert.equal(kind, null);
    assert.equal(changeType, null);
    validateSchema('agent-result', this.result(legacy));
  }

  /** Supplies a caller-specific need whose supplier terms are intentionally absent. */
  private request(): any {
    return {
      fromComponent: 'assignment',
      ownerId: 'coordination-store',
      assignmentId: 'supplier-assignment',
      request: 'I need canonical linking for my worker inbox request.',
      evidence: ['assignment.evidence: supplier-assignment:intent'],
      acceptanceCriteria: [],
      reason: 'The caller consumes the supplier public contract.',
      milestone: 'delivered',
      kind: null,
      changeType: null,
    };
  }

  /** Builds the required result envelope independently of workflow and report history. */
  private result(request: any): any {
    return {
      status: 'completed',
      summary: 'Request supplier behavior',
      blockers: [],
      findings: [],
      activities: [],
      regression: null,
      reviewFindings: [],
      requests: [request],
    };
  }
}

const inboxScenarios = new InboxSchemaScenarios();

test('explicit supplier links accept caller need without copied criteria', () =>
  inboxScenarios.linked());

test('inbox schema preserves full criteria and historical result readers', () =>
  inboxScenarios.historical());

const scenarios = new EngineeringContextScenarios();

test('engineering context explains the only maintained-source write route', () =>
  scenarios.checked());

test('historical authority cannot create a new engineering context', () => scenarios.historical());

test('turn checkpoint reflects newly frozen regressions without broadening authority', () =>
  scenarios.checkpoint());

test('related contribution context distinguishes checkpoint completion from delivery', () =>
  scenarios.contribution());

registerSuite({ component: 'assignment', level: 'acceptance', tags: ['deterministic'] });
