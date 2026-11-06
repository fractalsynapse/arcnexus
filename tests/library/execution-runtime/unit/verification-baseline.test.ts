import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { VerificationBaseline } from '../../../../dist/library/execution-runtime/verification-baseline.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Checks host baseline classification independently of worker source and foreign repositories. */
class VerificationBaselineScenarios {
  /** Includes verified additions and removed test identities but excludes unverified files and implementation. */
  capture(t: TestContext): void {
    const f = workflowFixture(t);
    mkdirSync(join(f.repo, 'fixtures'), { recursive: true });
    writeFileSync(join(f.repo, 'tests/old.test.ts'), 'old');
    f.commit();
    const authority = f.git('rev-parse', 'HEAD');
    rmSync(join(f.repo, 'tests/old.test.ts'));
    writeFileSync(join(f.repo, 'fixtures/input.json'), '{}');
    writeFileSync(join(f.repo, 'fixtures/implementation.ts'), 'export {};');
    f.commit();
    const record: any = {
      source: f.repo,
      base: f.git('rev-parse', 'HEAD'),
      finalVerifiedDigest: 'old',
    };
    writeFileSync(join(f.repo, 'tests/unverified.test.ts'), 'unverified');
    new VerificationBaseline(this.context(f.repo, authority)).capture(record);
    assert.equal(record.finalVerifiedDigest, undefined);
    assert.deepEqual(record.verifiedTestPaths.sort(), ['fixtures/input.json', 'tests/old.test.ts']);
  }

  /** Supplies separate owners and a captured classification exception without executable candidate configuration. */
  private context(source: string, base: string): any {
    const owner = (repository: string, paths: string[], rules: any[] = []) => ({
      repository,
      allowedWritePaths: paths,
      fileClassification: rules,
    });
    return {
      source,
      base,
      catalog: {
        primaryRepository: 'local',
        components: {
          foreign: owner('foreign', ['tests'], [{ path: 'tests', kind: 'source' }]),
          first: owner('local', ['tests/old.test.ts', 'tests/unverified.test.ts']),
          second: owner('local', ['fixtures'], [{ path: 'fixtures/input.json', kind: 'tests' }]),
        },
      },
    };
  }
}

test('verified baseline uses captured classification across owners and preserves deleted test identity', (t) =>
  new VerificationBaselineScenarios().capture(t));

registerSuite({
  component: 'execution-runtime',
  level: 'unit',
  tags: ['deterministic', 'verification'],
});
