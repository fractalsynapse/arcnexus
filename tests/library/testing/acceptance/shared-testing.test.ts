import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { cpSync, existsSync, readFileSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { TestProcess } from '../support/test-process.js';
import { SharedTestFixture as ComponentTestFixture } from '../support/shared-test-fixture.js';
import { nativeHostTest } from '../support/general-fixture.js';

/** Exercises static selection and supervised test execution through the built gateway. */
class SharedTestingTests {
  /** Verifies that test inspection intersects tags without executing modules or preparation. */
  selectsWithoutExecution(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    f.put(
      'tests/unit/side-effect.test.ts',
      "throw new Error('MUST_NOT_EXECUTE');\nregisterSuite({component:'sample',level:'unit',tags:['fast']});",
    );
    const result = f.run(
      'inspect',
      'sample',
      '--level',
      'unit',
      '--tag',
      'fast',
      '--tag',
      'deterministic',
    );
    assert.equal(result.status, 0, result.stderr);
    const selection = JSON.parse(result.stdout);
    assert.equal(selection.suites.length, 1);
    assert.match(selection.suites[0].source, /small/);
    assert.equal(existsSync(join(f.repo, '.test-build/prepared')), false);
  }

  /** Verifies that test selection combines regression category and explicit integration level. */
  selectsRegressionLevel(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    const result = f.run('inspect', '--category', 'regression', '--level', 'integration');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).suites[0].category, 'regression');
  }

  /** Verifies that shared test runner prepares once and retains real Node results. */
  executesOnce(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    const result = f.run('run');
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(result.stdout);
    assert.equal(evidence.status, 'passed');
    assert.equal(evidence.commands.length, 2);
    assert.equal(readFileSync(join(f.repo, '.test-build/prepared'), 'utf8'), 'once\n');
    assert.match(readFileSync(evidence.commands[1].log, 'utf8'), /# pass 2/);
    assert.equal(existsSync(join(evidence.evidence, 'result.json')), true);
  }

  /** Verifies that prepares selected profiles only. */
  preparesSelectedProfilesOnly(t: TestContext): void {
    const fixture = new ComponentTestFixture(t);
    fixture.unusedProfile();
    const result = fixture.run('run', '--tag', 'fast');
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      report.selection.profiles.map((profile: any) => profile.id),
      ['node'],
    );
    assert.equal(report.commands.length, 2);
  }

  /** Verifies that npm compatibility runner prints retained test output for CI diagnosis. */
  printsNpmEvidence(t: TestContext): void {
    const fixture = new ComponentTestFixture(t);
    const result = spawnSync(
      process.execPath,
      [resolve('dist/library/testing/npm-tests.js'), 'sample'],
      {
        cwd: fixture.repo,
        encoding: 'utf8',
        env: { ...process.env, ARCNEXUS_STATE_DIR: fixture.state },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# pass 2/);
    assert.equal(JSON.parse(result.stdout.trim().split('\n').at(-1)!).status, 'passed');
  }

  /** Shared test results retain a late build diagnostic within the model-facing bound. */
  retainsLateDiagnostic(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    f.operation('compile', [
      '-e',
      "require('fs').writeSync(1,'passing output\\n'.repeat(12000));console.error('Error: LATE_BUILD_FAILURE');process.exit(1)",
    ]);
    f.commit();
    const result = f.run('run');
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.match(report.output, /LATE_BUILD_FAILURE/);
    assert.ok(Buffer.byteLength(report.output) <= 16384);
    assert.equal(report.outputTruncated, true);
    assert.ok(existsSync(report.commands[0].log));
  }

  /** Verifies that shared test runner retains compilation failure evidence. */
  retainsBuildFailure(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    f.put('tests/support/invalid.ts', 'const value: string = 42;');
    const compiler = '.test-build/compiler/tsc.js';
    cpSync(resolve('node_modules/typescript/lib'), join(f.repo, '.test-build/compiler'), {
      recursive: true,
    });
    f.operation('compile', [compiler, '--noEmit', '--skipLibCheck', 'tests/support/invalid.ts']);
    f.commit();
    const result = f.run('run');
    assert.equal(result.status, 1, result.stderr);
    const evidence = JSON.parse(result.stdout);
    assert.equal(evidence.status, 'failed');
    assert.equal(evidence.commands[0].exitCode, 2, evidence.output);
    assert.match(readFileSync(evidence.commands[0].log, 'utf8'), /TS2322/);
    assert.match(evidence.output, /TS2322/);
  }

  /** Verifies that captures mandatory selection. */
  capturesMandatorySelection(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    f.extend(
      'architecture/components/sample.yaml',
      (value) => (value.operations = { suites: ['verify'] }),
    );
    f.commit();
    const result = spawnSync(
      process.execPath,
      [resolve('dist/cli.js'), 'inspect', 'sample', 'Improve tests', '--project', f.repo, '--json'],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const assignment = JSON.parse(result.stdout);
    assert.equal(assignment.context.at(-1).capturedTests.length, 2);
    assert.ok(
      assignment.configurationSources.some(
        (source: any) =>
          source.path === 'architecture/test-profiles/node.yaml' && source.sourceHash,
      ),
    );
  }

  /** Verifies that test cancellation stops preparation and retains evidence. */
  async cancelsPreparation(t: TestContext): Promise<void> {
    const f = new ComponentTestFixture(t);
    f.put(
      'build.cjs',
      "require('fs').writeFileSync('.test-build/prepared',String(process.pid));setInterval(()=>{},1000)",
    );
    const child = new TestProcess(
      t,
      [resolve('dist/cli.js'), 'test', 'run', '--project', f.repo, '--json'],
      { ...process.env, ARCNEXUS_STATE_DIR: f.state },
    );
    await child.waitForReady(
      () => existsSync(join(f.repo, '.test-build/prepared')),
      'test preparation starts',
    );
    child.child.kill('SIGINT');
    assert.equal(await child.closed, 130, child.stderr);
    const report = JSON.parse(child.stdout);
    assert.equal(report.status, 'cancelled');
    const scope = report.commands[0].processScope;
    assert.equal(typeof scope, 'string');
    assert.equal(existsSync(scope), false, 'cancelled preparation leaves no managed process scope');
    assert.equal(existsSync(join(report.evidence, 'result.json')), true);
  }

  /** Verifies that an explicitly configured test timeout is failure rather than caller cancellation. */
  explicitTimeoutIsFailure(t: TestContext): void {
    const fixture = new ComponentTestFixture(t);
    fixture.put('build.cjs', 'setInterval(()=>{},1000)');
    const result = fixture.run('run', '--timeout-seconds', '0.05');
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'failed');
    assert.match(report.error, /timed out/);
  }

  /** Verifies that rejects unsupported profile. */
  rejectsUnsupportedProfile(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    f.profile({ adapter: 'python' });
    f.commit();
    const result = f.run('inspect');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /test-profile/);
  }

  /** Verifies that test discovery rejects symlink traversal. */
  rejectsSymlinkTraversal(t: TestContext): void {
    const f = new ComponentTestFixture(t);
    symlinkSync('/tmp', join(f.repo, 'tests', 'escape'));
    const result = f.run('inspect');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Symlink/);
  }
}

const suite = new SharedTestingTests();

nativeHostTest(
  'an explicitly configured test timeout is failure rather than caller cancellation',
  (t) => suite.explicitTimeoutIsFailure(t),
);

nativeHostTest('npm compatibility runner prints retained test output for CI diagnosis', (t) =>
  suite.printsNpmEvidence(t),
);

nativeHostTest('test runner prepares only profiles selected by intersecting filters', (t) =>
  suite.preparesSelectedProfilesOnly(t),
);

test('assignment inspection captures mandatory suite identities and profile hashes', (t) =>
  suite.capturesMandatorySelection(t));

nativeHostTest('test cancellation stops preparation and retains evidence', (t) =>
  suite.cancelsPreparation(t),
);

test('test inspection intersects tags without executing modules or preparation', (t) =>
  suite.selectsWithoutExecution(t));

test('test selection combines regression category and explicit integration level', (t) =>
  suite.selectsRegressionLevel(t));

nativeHostTest('shared test runner prepares once and retains real Node results', (t) =>
  suite.executesOnce(t),
);

nativeHostTest('shared test runner retains compilation failure evidence', (t) =>
  suite.retainsBuildFailure(t),
);

test('test inspection rejects unsupported runner profiles', (t) =>
  suite.rejectsUnsupportedProfile(t));

test('test discovery rejects symlink traversal', (t) => suite.rejectsSymlinkTraversal(t));

nativeHostTest('shared test feedback preserves late diagnostics', (t) =>
  suite.retainsLateDiagnostic(t),
);

registerSuite({
  component: 'testing',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
