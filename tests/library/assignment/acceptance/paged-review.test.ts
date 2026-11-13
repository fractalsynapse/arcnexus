import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { TurnEvidence } from '../../../../dist/library/assignment/session-turn-evidence.js';
import { SessionTurn } from '../../../../dist/library/assignment/session-turn.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises the production turn prompt and bridge with evidence larger than native input limits. */
class PagedReviewScenario {
  /** Reconstructs every retained byte while the initial turn carries only the evidence reference. */
  async run(t: TestContext): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), 'arcnexus-review-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const state: any = this.baseState(dir);
    const evidence = new TurnEvidence(state);
    const captured = { patch: 'real patch α\n'.repeat(180000), newFiles: { added: 'complete' } };
    const reference = evidence.reference(captured);
    const prompt = this.prompt(state, reference);
    assert.ok(prompt.length < 10000);
    assert.match(prompt, /review.evidence artifact=manifest/);
    assert.doesNotMatch(prompt, /real patch/);
    const bridge = evidence.wrap({ tools: [], call: async () => 'fallback' } as any);
    assert.equal(await bridge.call('unrelated', {}), 'fallback');
    const manifest = JSON.parse(await this.read(bridge, 'manifest'));
    assert.equal(manifest.artifacts[0].totalCharacters, JSON.stringify(captured).length);
    const bytes = await this.read(bridge, 'review');
    assert.equal(bytes, JSON.stringify(captured));
    const retained = state.options.record.reviewEvidence;
    assert.equal(
      readFileSync(join(retained.directory, manifest.artifacts[0].sha256), 'utf8'),
      bytes,
    );
  }

  /**
   * The state a production turn prompt reads.
   *
   * `turnPrompt` renders the accepted engineering context before the evidence reference, so the
   * fixture supplies the frame's inputs - a current component and the review activity with its
   * position, direction and standards - rather than a partial object that only the evidence store
   * happens to tolerate.
   */
  private baseState(dir: string): any {
    return {
      dir,
      frozen: [],
      options: { record: {} },
      component: { schemaVersion: 6, id: 'sample', type: 'library', verification: [], owns: [] },
      scope: ['owned'],
      planned: true,
      resolved: {
        mode: 'steward',
        context: [],
        related: [],
        owners: [],
        operations: [],
        assignment: { objective: 'Review complete changes', acceptanceCriteria: ['All changes'] },
        activities: {
          review: {
            role: { id: 'reviewer', responsibilities: ['Review the complete change set'] },
            instructions: ['Judge the delivered change against every acceptance criterion'],
            operations: [],
            standards: [],
          },
        },
      },
    };
  }

  /** Uses actual prompt rendering with a minimal accepted plan context. */
  private prompt(state: any, reference: Record<string, unknown>): string {
    // The rendered prompt quotes the assignment and its host checks, so the state carries both.
    state.assignment = {
      kind: 'review',
      objective: 'Review complete changes',
      acceptanceCriteria: ['All changes'],
      hostChecks: [],
    };
    const turn: any = Object.create(SessionTurn.prototype);
    turn.state = state;
    turn.originalPrompt = 'Captured authority';
    return turn.turnPrompt('review', 'Review the changes', reference);
  }

  /** Reads bounded pages until the production capability reports complete. */
  private async read(bridge: any, artifact: string): Promise<string> {
    let offset = 0;
    let content = '';
    for (;;) {
      const page = await bridge.call('review.evidence', { artifact, offset, length: 32768 });
      assert.ok(page.content.length <= 32768);
      content += page.content;
      if (page.complete) return content;
      assert.ok(page.nextOffset > offset);
      offset = page.nextOffset;
    }
  }
}

const scenario = new PagedReviewScenario();

test('large steward review retains complete evidence without embedding it in model input', (t) =>
  scenario.run(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'evidence'],
});
