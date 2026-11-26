import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCatalogPath, type Capture } from '../../src/index.js';
import { documentationProposal } from '../../src/documentation-proposal.js';

export const suite = { owner: 'architecture', level: 'unit', tags: ['regression'] } as const;

const revision = 'a'.repeat(40);
const catalog = 'id: project\nchecks:\n  acceptance:\n  - existing-check\n';

function source(content: string, documentationDirectories?: string[]) {
  return {
    source: {
      revision,
      paths: [projectCatalogPath, 'handbook/overview.md', 'contracts.yaml'],
      read: (path: string) => (path === projectCatalogPath ? content : 'contracts: []\n'),
    },
    project: {
      documentationDirectories,
      architect: { component: 'architecture', activity: 'assessment' },
      contractRegistry: 'contracts.yaml',
    },
    components: { architecture: { owns: [projectCatalogPath] } },
    contracts: [],
  } as unknown as Capture;
}

test('the exact documentation edit preserves unrelated YAML bytes and can clear the field', () => {
  const proposed = documentationProposal(source(catalog), { revision, directories: ['handbook'] });
  const updated = catalog + 'documentationDirectories:\n  - handbook\n';
  assert.deepEqual(proposed?.files, [
    { path: projectCatalogPath, before: catalog, content: updated },
  ]);
  const cleared = documentationProposal(source(updated, ['handbook']), {
    revision,
    directories: [],
  });
  assert.equal(cleared?.files[0]?.content, catalog);
});
