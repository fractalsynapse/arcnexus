import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import type { SessionState } from '../../../../dist/library/assignment/session-state.js';

/** Supplies a disposable candidate and captured host authority to checked-edit scenarios. */
export class CheckedEditFixture {
  /** Creates a minimal host state with authority unavailable to the incoming edit arguments. */
  protected fixture(t: TestContext): SessionState {
    const root = mkdtempSync(join(tmpdir(), 'edit-authority-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const workspace = join(root, 'source');
    mkdirSync(join(workspace, 'owned'), { recursive: true });
    writeFileSync(join(workspace, 'owned/file.ts'), 'before');
    const resolved = { digest: 'captured-authority' };
    return {
      options: { record: { workspace, id: 'run', resolvedAssignment: resolved } },
      dir: join(root, 'evidence'),
      resolved,
      scope: ['owned'],
      assignment: { kind: 'change' },
      frozen: [],
      component: {
        schemaVersion: 6,
        id: 'assignment',
        repositoryRoot: 'owned',
        testProfile: 'node',
        allowedWritePaths: ['owned'],
        fileClassification: [],
      },
      journal: () => {},
      safe: () => {},
    } as unknown as SessionState;
  }

  /** Supplies content expectations without any owner or authority override. */
  protected request(path: string) {
    return {
      id: 'edit',
      changes: [{ path, operation: 'update', expectedSha256: digest('before'), content: 'after' }],
    };
  }

  /** Observes both batch members so a partial application cannot satisfy the rejection assertions. */
  protected contents(state: SessionState): string[] {
    return ['owned/file.ts', 'owned/second.ts'].map((path) =>
      readFileSync(join(state.options.record.workspace, path), 'utf8'),
    );
  }
}
