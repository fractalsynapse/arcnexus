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
    const state: any = { dir, frozen: [], options: { record: {} } };
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

  /** Uses actual prompt rendering with a minimal accepted plan context. */
  private prompt(state: any, reference: Record<string, unknown>): string {
    state.assignment = {
      objective: 'Review complete changes',
      acceptanceCriteria: ['All changes'],
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
