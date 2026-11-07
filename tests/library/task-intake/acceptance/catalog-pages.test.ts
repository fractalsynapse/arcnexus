import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { Component } from '../../../../dist/library/architecture/components.js';
import type { OperationBridge } from '../../../../dist/library/operations/operations.js';
import { DirectionContext } from '../../../../dist/library/task-intake/direction-context.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Qualifies growing catalogs through the actual director capability without an aggregate size ceiling. */
class CatalogPagesScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-catalog-pages-'));

  /** Retains temporary evidence only for this scenario and removes it after assertions. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
  }

  /** Retrieves every large owner exactly while the discovery index contains only references. */
  async run(): Promise<void> {
    const components = ['alpha', 'beta'].map((id) => this.owner(id));
    const before = JSON.stringify(components);
    assert.ok(before.length > 700000, 'Exercise growth beyond the former inline catalog limit');
    const context = new DirectionContext(this.root, { id: 'catalog' } as any, components);
    const bridge = context.wrap(this.operations());
    const manifest = JSON.parse(await this.read(bridge, 'manifest'));
    assert.ok(manifest.artifacts.some((entry: any) => entry.id === 'catalog'));
    const catalog = JSON.parse(await this.read(bridge, 'catalog'));
    assert.deepEqual(catalog, {
      components: components.map(({ id, purpose, type }) => ({
        id,
        purpose,
        type,
        artifact: 'owner:' + id,
      })),
      standards: [],
    });
    for (const source of components) {
      const owner = JSON.parse(await this.read(bridge, 'owner:' + source.id));
      assert.equal(owner.id, source.id);
      assert.deepEqual(owner.constraints, source.constraints);
      assert.deepEqual(owner.allowedWritePaths, source.allowedWritePaths);
    }
    assert.equal(JSON.stringify(components), before);
  }

  /** Keeps engineering operations unavailable while exercising the production evidence capability. */
  private operations(): OperationBridge {
    return {
      tools: [],
      call: async () => assert.fail('Unexpected operation'),
      disconnect: () => {},
      close: async () => {},
    };
  }

  /** Supplies distinct complete owner intent; fixture size exercises paging rather than a production quota. */
  private owner(id: string): Component {
    return {
      schemaVersion: 6,
      id,
      type: 'library',
      purpose: 'Maintain ' + id,
      constraints: [(id + ': preserve full intent Ω\n').repeat(18000)],
      allowedWritePaths: ['src/' + id],
      verification: [],
      standardSnapshots: [],
    } as unknown as Component;
  }

  /** Follows advertised offsets and checks that the assembled bytes match their pinned content identity. */
  private async read(bridge: OperationBridge, artifact: string): Promise<string> {
    let content = '';
    let hash: string | undefined;
    let pages = 0;
    while (true) {
      const page: any = await bridge.call('direction.evidence', {
        artifact,
        offset: content.length,
        length: 4096,
      });
      hash ??= page.sha256;
      assert.equal(page.sha256, hash);
      content += page.content;
      pages++;
      if (page.complete) {
        assert.equal(page.nextOffset, null);
        assert.equal(content.length, page.totalCharacters);
        assert.equal(createHash('sha256').update(content).digest('hex'), hash);
        if (artifact.startsWith('owner:')) assert.ok(pages > 1);
        return content;
      }
      assert.equal(page.nextOffset, content.length);
    }
  }
}

test('director pages complete owner context beyond the former aggregate catalog limit', (t) =>
  new CatalogPagesScenario(t).run());

registerSuite({
  component: 'task-intake',
  level: 'acceptance',
  tags: ['deterministic', 'evidence'],
});
