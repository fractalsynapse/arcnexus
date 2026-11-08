import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { registerSuite } from '../../../dist/library/testing/suite.js';

/** Checks delivery boundaries without publishing or invoking GitHub. */
class WorkflowTests {
  /** Loads maintained workflow data; missing files fail the public contract. */
  read(name: string): any {
    return parse(readFileSync(`.github/workflows/${name}.yaml`, 'utf8'));
  }

  /** All lifecycle callers share verification and retain their intended triggers. */
  lifecycles(): void {
    const development = this.read('development');
    const staging = this.read('staging');
    const production = this.read('production');
    assert.deepEqual(development.on.pull_request.branches, ['staging']);
    assert.deepEqual(staging.on.push.branches, ['staging']);
    assert.deepEqual(production.on.pull_request.branches, ['main']);
    assert.deepEqual(production.on.push.branches, ['main']);
    assert.deepEqual(production.on.release.types, ['published']);
    assert.equal(development.concurrency['cancel-in-progress'], true);
    assert.equal(staging.concurrency['cancel-in-progress'], false);
    assert.equal(production.concurrency['cancel-in-progress'], false);
    for (const workflow of [development, staging, production]) {
      assert.equal(workflow.jobs.verify.uses, './.github/workflows/verification.yaml');
      assert.deepEqual(workflow.permissions, { contents: 'read' });
    }
    assert.equal(production.jobs.verify.with.distribution, true);
    assert.equal(
      production.jobs.verify.with.native,
      true,
      'main and releases keep the native tier',
    );
  }

  /** A scheduled run qualifies the native tier against staging explicitly, read-only. */
  nightly(): void {
    const workflow = this.read('nightly');
    assert.ok(workflow.on.schedule, 'the native tier needs a scheduled qualification run');
    assert.ok(workflow.on.workflow_dispatch, 'a maintainer can qualify staging on demand');
    assert.equal(workflow.jobs.verify.with.native, true);
    assert.match(
      workflow.jobs.verify.with.ref,
      /inputs\.ref \|\| 'staging'/,
      'a scheduled run must qualify staging explicitly',
    );
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.equal(workflow.jobs.verify.uses, './.github/workflows/verification.yaml');
  }

  /** Hosted tests retain ordinary-user confinement and delegated descendant supervision. */
  confinement(): void {
    const steps = this.read('verification').jobs.repository.steps;
    const install = steps.find((step: any) => step.name === 'Install confinement runtime');
    assert.ok(install, 'CI must provision its enforcement runtime');
    assert.match(install.run, /@openai\/codex@0\.163\.0-alpha\.10\.2/);
    assert.match(install.run, /--prefix \/usr\/local/);
    assert.match(install.run, /apt-get install -y bubblewrap apparmor-profiles apparmor-utils/);
    assert.match(install.run, /apparmor_parser -r/);
    assert.doesNotMatch(install.run, /sysctl/);
    const bindings = steps.find((step: any) => step.name === 'Bind verified machine executables');
    assert.match(bindings.run, /\.git\/arcnexus\/bindings\.yaml/);
    assert.match(bindings.run, /Expected one installed native Codex executable/);
    assert.match(bindings.run, /execFileSync\(codex, \['--version'\]/);
    assert.match(bindings.run, /tools: \{ npm, node: process.execPath, codex \}/);
    const tests = steps.find((step: any) => step.name === 'Test built CLI');
    assert.match(tests.run, /systemd-run/);
    assert.match(tests.run, /--property=Delegate=yes/);
    assert.match(tests.run, /--uid="\$\(id -u\)"/);
    assert.match(tests.run, /--gid="\$\(id -g\)"/);
    assert.match(tests.run, /--setenv="PATH=\$PATH"/);
    assert.match(tests.run, /--wait --pipe --collect/);
    assert.match(tests.run, /npm test/);
    assert.doesNotMatch(tests.run, /--scope|\|\| true/);
  }

  /** Pins a readable npm installation instead of depending on an inaccessible hosted-toolcache alias. */
  npmBinding(): void {
    const steps = this.read('verification').jobs.repository.steps;
    const install = steps.find((step: any) => step.name === 'Install confinement runtime');
    const bindings = steps.find((step: any) => step.name === 'Bind verified machine executables');
    assert.match(install.run, /--prefix \/usr\/local.*npm@10\.9\.9/);
    assert.match(bindings.run, /const npm = '\/usr\/local\/lib\/arcnexus-ci\/bin\/npm'/);
    assert.ok(bindings.run.includes('exec /usr/local/bin/npm "$@"'));
    assert.match(bindings.run, /execFileSync\(npm, \['--version'\]/);
    assert.match(bindings.run, /tools: \{ npm, node: process.execPath, codex \}/);
  }

  /** Confined skips require a native host gate that cannot vanish; only its callers choose when. */
  nativeHosts(): void {
    const verification = this.read('verification');
    const native = verification.jobs.repository.steps.find(
      (step: any) => step.name === 'Qualify native project hosts',
    );
    assert.ok(native, 'Native host coverage must not disappear behind confined skips');
    assert.equal(native.if, 'inputs.native', 'the native tier is chosen by the caller, not lost');
    assert.notEqual(native['continue-on-error'], true);
    assert.equal(verification.on.workflow_call.inputs.native.default, true);
    assert.equal(this.read('development').jobs.verify.with.native, false);
    assert.equal(this.read('staging').jobs.verify.with.native, true);
    assert.match(native.run, /--property=Delegate=yes/);
    assert.match(native.run, /--uid="\$\(id -u\)"/);
    assert.match(native.run, /ARCNEXUS_TEST_CODEX=\$ARCNEXUS_TEST_CODEX/);
    assert.match(native.run, /node scripts\/release\/native-host-tests.mjs/);
    const selection = readFileSync('scripts/release/native-host-tests.mjs', 'utf8');
    assert.match(selection, /'test', 'inspect'/);
    assert.match(selection, /'native-host'/);
    assert.match(selection, /selected no suites/);
  }

  /** Shared verification pins actions and contains no write or publication capability. */
  verification(): void {
    const workflow = this.read('verification');
    assert.ok(workflow.on.workflow_call);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    const job = workflow.jobs.repository;
    assert.equal(job['timeout-minutes'], 360);
    for (const step of job.steps.filter((step: any) => step.uses))
      assert.match(step.uses, /^actions\/(checkout|setup-node)@[a-f0-9]{40}$/);
    const commands = job.steps.map((step: any) => step.run ?? '').join('\n');
    for (const command of [
      'npm ci',
      'npm run format:check',
      'npm run lint',
      'npm run check',
      'npm test',
      'validate --project',
      '--help',
    ])
      assert.ok(commands.includes(command), command);
    assert.doesNotMatch(commands, /npm publish|gh release create|docker push|git push/);
    assert.ok(job.steps.some((step: any) => step.if === 'inputs.distribution'));
  }
}

const suite = new WorkflowTests();

test('hosted execution provisions confinement and delegated supervision', () =>
  suite.confinement());

test('hosted npm uses an explicit pinned readable binding', () => suite.npmBinding());

test('native host qualification remains a required separate caller gate', () =>
  suite.nativeHosts());

test('delivery lifecycle triggers and concurrency remain distinct', () => suite.lifecycles());

test('nightly and dispatched runs qualify the native tier on staging', () => suite.nightly());

test('delivery uses pinned read-only reusable verification', () => suite.verification());

registerSuite({ component: 'release', level: 'acceptance', tags: ['deterministic', 'delivery'] });
