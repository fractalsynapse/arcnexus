import { classifyComponentPath, covered } from '../architecture/components.js';
import type { ProjectExecution } from '../architecture/execution-context.js';
import { git } from '../operations/process.js';
import type { RecordData } from '../workspace/state.js';

/** Identifies test inputs using captured architecture and the reconciled verified candidate. */
export class VerificationBaseline {
  /** Retains host-owned authority; worker source cannot redefine classification. */
  constructor(private readonly context: ProjectExecution) {}

  /** Includes deleted tests in classification so older authority cannot resurrect them. */
  capture(record: RecordData): void {
    const paths = new Set(
      [this.context.base, record.base].flatMap((revision) =>
        git(record.source, 'ls-tree', '-r', '--name-only', revision).split('\n'),
      ),
    );
    const components = Object.values(this.context.catalog.components).filter(
      (component) => component.repository === this.context.catalog.primaryRepository,
    );
    const tests = [...paths].filter((path) => {
      if (!path) return false;
      const owner = components.find((component) => covered(path, component.allowedWritePaths));
      return owner !== undefined && classifyComponentPath(owner, path) === 'tests';
    });
    if (JSON.stringify(record.verifiedTestPaths) !== JSON.stringify(tests)) {
      delete record.finalVerifiedBase;
      delete record.finalVerifiedDigest;
    }
    record.verifiedTestPaths = tests;
  }
}
