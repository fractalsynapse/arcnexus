import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { execFileSync } from 'node:child_process';
import { activityFrame, renderFrame } from '../../../../dist/library/architecture/frame.js';
import { resolveAssignment } from '../../../../dist/library/architecture/assignment.js';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/**
 * Proves that a preview of an agent's frame is the frame the agent is given.
 *
 * Execution EX-6 and architecture-model ARC-9 state that `inspect` renders exactly what activation
 * sends. That is worth nothing unless it is checked rather than intended, so this suite resolves
 * every component/activity pair in the committed catalog twice — once from the catalog the way
 * `inspect` does, once from the captured assignment the way a running steward does — and requires
 * them to agree. A divergence means an operator is reading a description of authority the agent does
 * not have, which is the failure this guard exists to catch.
 */
class FrameEqualityScenarios {
  private readonly source = process.cwd();

  private readonly revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();

  /** Every activity a component holds resolves to the same frame from either entry point. */
  catalogAndCaptureAgree(_t: TestContext): void {
    const catalog = loadCatalog(this.source, this.revision);
    const pairs = this.pairs(catalog);
    // One resolution per component: each reads the committed catalog, and resolving per activity
    // made this suite take minutes without asserting anything additional.
    const captured = new Map<string, ReturnType<typeof resolveAssignment>>();
    for (const { componentId, activity } of pairs) {
      const assignment =
        captured.get(componentId) ??
        resolveAssignment(this.source, this.revision, componentId, {
          objective: 'Verify that the inspected frame equals the activated frame',
          kind: 'research',
        });
      captured.set(componentId, assignment);
      const held = assignment.activities[activity];
      if (!held) throw new Error(`${componentId}.${activity} was not captured by the assignment`);
      this.comparePair(
        componentId,
        activity,
        this.catalogFrame(catalog, componentId, activity),
        held,
      );
    }
  }

  /** The frame for one pair, resolved the way `inspect` resolves it. */
  private catalogFrame(
    catalog: ReturnType<typeof loadCatalog>,
    componentId: string,
    activity: string,
  ) {
    return activityFrame({
      catalog,
      component: catalog.components[componentId]!,
      activity: activity as never,
      mode: 'steward',
    });
  }

  /**
   * Asserts one pair agrees between the two entry points.
   *
   * Dimensions are compared rather than rendered text, so a failure names the component, the
   * activity and the dimension instead of diffing a whole frame.
   */
  private comparePair(
    componentId: string,
    activity: string,
    viaCatalog: ReturnType<typeof activityFrame>,
    viaCapture: {
      role: { id: string };
      operations: Array<{ id: string }>;
      standards: string[];
      instructions?: string[];
    },
  ): void {
    const label = `${componentId}.${activity}`;
    assert.equal(viaCatalog.role.id, viaCapture.role.id, `${label} position`);
    assert.equal(
      viaCatalog.operations.map((op) => op.id).join(','),
      viaCapture.operations.map((op) => op.id).join(','),
      `${label} operations`,
    );
    assert.equal(
      viaCatalog.standards.join(','),
      viaCapture.standards.join(','),
      `${label} standards`,
    );
    assert.equal(
      viaCatalog.instructions.join('|'),
      (viaCapture.instructions ?? []).join('|'),
      `${label} direction`,
    );
  }

  /** Same inputs render identical bytes, and a supplied goal appears verbatim. */
  renderIsDeterministic(_t: TestContext): void {
    const catalog = loadCatalog(this.source, this.revision);
    const { componentId, activity } = this.pairs(catalog)[0]!;
    const goal = 'Correct the wording in docs/library/workspace about reclamation';
    const acceptance = ['The page describes reclamation at record termination'];
    const render = () =>
      renderFrame({
        catalog,
        component: catalog.components[componentId]!,
        activity: activity as never,
        mode: 'steward',
        goal,
        acceptance,
      });
    assert.equal(render(), render(), 'the same inputs must render identical bytes');
    const frame = render();
    assert.ok(frame.includes(`Goal: ${goal}`), 'a supplied goal appears verbatim');
    assert.ok(
      frame.includes(`Acceptance: ${acceptance.join(' | ')}`),
      'supplied acceptance appears verbatim',
    );
    this.assertPlaceholders(catalog, componentId, activity, goal);
  }

  /** A preview without a goal states the placeholder rather than inventing text. */
  private assertPlaceholders(
    catalog: ReturnType<typeof loadCatalog>,
    componentId: string,
    activity: string,
    goal: string,
  ): void {
    const preview = renderFrame({
      catalog,
      component: catalog.components[componentId]!,
      activity: activity as never,
      mode: 'steward',
    });
    assert.ok(
      !preview.includes(`Goal: ${goal}`) && preview.includes('Goal: [placeholder:goal]'),
      'without a goal the frame names the placeholder instead of inventing text',
    );
  }

  /** A mode may only be rendered for an activity its own sequence runs. */
  modeSequenceGatesRendering(_t: TestContext): void {
    const catalog = loadCatalog(this.source, this.revision);
    const component = Object.values(catalog.components).find(
      (c) => c.activities?.review && c.activities?.implementation,
    );
    if (!component) return _t.skip('no component holds both review and implementation');
    assert.throws(
      () =>
        activityFrame({
          catalog,
          component,
          activity: 'implementation' as never,
          mode: 'verifier',
        }),
      /does not run the activity/,
      'a verifier cannot be shown an implementation frame',
    );
  }

  /** Component/activity pairs present in this repository's committed catalog. */
  private pairs(catalog: ReturnType<typeof loadCatalog>) {
    return Object.values(catalog.components)
      .filter((c) => c.type !== 'platform')
      .flatMap((c) =>
        Object.keys(c.activities ?? {}).map((activity) => ({ componentId: c.id, activity })),
      );
  }
}

const scenarios = new FrameEqualityScenarios();

test('inspected frame equals activated frame', (t) => scenarios.catalogAndCaptureAgree(t));

test('frame rendering is deterministic and placeholder-honest', (t) =>
  scenarios.renderIsDeterministic(t));

test('a mode cannot be rendered for an activity outside its sequence', (t) =>
  scenarios.modeSequenceGatesRendering(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
