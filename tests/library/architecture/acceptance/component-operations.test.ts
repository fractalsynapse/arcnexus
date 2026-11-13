import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ComponentFixture, selectedActivities } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Declares an implementation activity carrying the component's own agent-invoked operations. */
const implementationActivity = (operations: string[]) => ({
  role: 'engineer',
  profile: 'luna',
  operations,
  instructions: ['Make the shared check the thing this change is judged on'],
});

/** Exercises shared operation planning through the assembled catalog loader. */
class SharedOperationScenarios {
  /** Retains an available test tool before the first suite while rejecting empty required checkpoints. */
  firstSuite(t: TestContext, required: boolean): void {
    const f = this.fixture(t);
    this.testProfile(f);
    rmSync(join(f.root, 'package/tests/value.test.ts'));
    f.put(
      'architecture/components/package.json',
      f.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
        testProfile: 'node',
        operations: { check: [required ? 'verify' : 'agent'] },
      }),
    );
    f.put('architecture/operations/check.json', {
      ...this.operation(),
      args: ['--test', { context: 'selectedTestFiles' }],
    });
    f.commit();
    const result = f.run('validate');
    if (required) return assert.match(result.stderr, /Empty or unsafe operation context/);
    assert.equal(result.status, 0, result.stderr);
    const operation = JSON.parse(result.stdout).owners.sample.operationPlan.agent[0];
    assert.deepEqual(operation.pendingContext, ['selectedTestFiles']);
    assert.deepEqual(operation.resolvedContext.selectedTestFiles, []);
  }

  /** Gives the captured test convention its own maintenance paths and shared runner reference. */
  private testProfile(f: ComponentFixture): void {
    f.put(
      'architecture/components/operation-owner.json',
      f.component('operation-owner', 'library', {
        parentId: 'maintenance-package',
        owns: ['architecture/operations', 'architecture/test-profiles'],
      }),
    );
    f.put('architecture/test-profiles/node.json', {
      schemaVersion: 2,
      id: 'node',
      adapter: 'node',
      outputRoot: '.test-build',
      preparation: [],
      run: 'check',
    });
  }

  /** Resolves one command for different owners without dropping mandatory ancestor usages. */
  shared(t: TestContext): void {
    const fixture = this.fixture(t);
    fixture.put(
      'architecture/components/second.json',
      fixture.component('second', 'library', {
        parentId: 'package',
        owns: ['second'],
        operations: {},
        activities: {
          ...selectedActivities('luna'),
          implementation: implementationActivity(['check']),
        },
      }),
    );
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    this.assertSharedDefinitions(JSON.parse(result.stdout).owners);
  }

  /** Both owners plan the same shared definition, each resolved against its own scope. */
  private assertSharedDefinitions(owners: Record<string, any>): void {
    assert.deepEqual(owners.sample.operationPlan.verify[0].args, [
      'sample',
      'package',
      'package/src',
      'package/docs',
      'package/tests',
      'architecture/components/unrelated-filename.json',
    ]);
    assert.equal(owners.second.operationPlan.verify[0].args[0], 'second');
    assert.equal(owners.second.operationPlan.verify[0].id, 'check');
    assert.equal(
      owners.sample.operationPlan.agent[0].definitionDigest,
      owners.second.operationPlan.agent[0].definitionDigest,
    );
  }

  /** Effective policy records contributing declarations without confusing implicit reads with authored grants. */
  provenance(t: TestContext): void {
    const fixture = this.fixture(t);
    fixture.put(
      'architecture/components/unrelated-filename.json',
      fixture.component('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests'],
        reads: ['src'],
        constraints: ['Leaf constraint'],
        // The leaf declares the activity that carries its own agent work, which is valid whether or
        // not ancestor grants are ever allowed to reach it (see #428).
        activities: { implementation: implementationActivity(['check']) },
        operations: { check: ['agent'] },
      }),
    );
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const policy = JSON.parse(result.stdout).owners.sample.policy;
    assert.deepEqual(policy.operations.source, ['package', 'sample']);
    assert.deepEqual(policy.operations.value, { check: ['verify', 'agent'] });
    assert.deepEqual(policy.constraints.source, ['platform', 'sample']);
    assert.deepEqual(policy.constraints.value, ['Preserve authority', 'Leaf constraint']);
    assert.equal(policy.reads.source, 'sample');
    assert.deepEqual(policy.reads.implicitOwnedPaths, policy.reads.value);
  }

  /** Rejects a dependency cycle before building a partially executable checkpoint. */
  cycle(t: TestContext): void {
    const fixture = this.fixture(t);
    fixture.put('architecture/operations/check.json', this.operation(['other']));
    fixture.put('architecture/operations/other.json', {
      ...this.operation(['check']),
      id: 'other',
    });
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /prerequisite cycle/);
  }

  /** Refuses indefinite service startup as a mandatory verification operation. */
  service(t: TestContext): void {
    const fixture = this.fixture(t);
    fixture.put('architecture/operations/check.json', {
      ...this.operation(),
      kind: 'service',
      service: { port: 0, readinessPath: '/', expectedStatus: 200 },
    });
    fixture.commit();
    assert.match(fixture.run('validate').stderr, /finite/);
  }

  /** A finite HTTP check references one explicitly available managed service without inventing a command. */
  http(t: TestContext, declared = true): void {
    const fixture = this.httpFixture(t, declared);
    const result = fixture.run('validate');
    if (!declared) return assert.match(result.stderr, /declared (agent )?service/);
    assert.equal(result.status, 0, result.stderr);
    const check = JSON.parse(result.stdout).owners.sample.operationPlan.verify[0];
    assert.equal(check.kind, 'http');
    assert.equal(check.http.serviceId, 'server');
    assert.equal(check.command, undefined);
  }

  /** Captures the HTTP definition and its optional service usage as one owned configuration. */
  private httpFixture(t: TestContext, declared: boolean): ComponentFixture {
    const fixture = this.fixture(t, declared ? ['server'] : []);
    fixture.put(
      'architecture/components/package.json',
      fixture.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
        operations: { check: ['verify'], ...(declared ? { server: ['agent'] } : {}) },
      }),
    );
    const { command: _command, args: _args, ...base } = this.operation();
    fixture.put('architecture/operations/check.json', {
      ...base,
      kind: 'http',
      http: { serviceId: 'server', path: '/', expectedStatus: 200 },
    });
    fixture.put('architecture/operations/server.json', {
      ...this.operation(),
      id: 'server',
      kind: 'service',
      service: { port: 0, readinessPath: '/', expectedStatus: 200 },
    });
    fixture.commit();
    return fixture;
  }

  /** Owns shared definitions explicitly and declares operation usages once at the package. */
  private fixture(t: TestContext, agentOperations: string[] = ['check']): ComponentFixture {
    const fixture = new ComponentFixture(t);
    fixture.put(
      'architecture/components/operation-owner.json',
      fixture.component('operation-owner', 'library', {
        parentId: 'maintenance-package',
        owns: ['architecture/operations'],
      }),
    );
    fixture.put(
      'architecture/components/package.json',
      fixture.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
        operations: { check: ['verify', 'agent'] },
      }),
    );
    fixture.put('architecture/operations/check.json', this.operation());
    // An agent-invoked operation must belong to an activity the running component declares, so the
    // leaf states that activity. The definitions stay shared at the package, which is the subject.
    fixture.put(
      'architecture/components/unrelated-filename.json',
      this.sample(fixture, agentOperations),
    );
    return fixture;
  }

  /** The leaf under test, declaring the activity that carries its agent-invoked operations. */
  private sample(f: ComponentFixture, agentOperations: string[]): unknown {
    return f.component('sample', 'library', {
      parentId: 'package',
      owns: ['src', 'docs', 'tests'],
      api: [{ module: 'src/value.ts' }],
      activities: {
        ...selectedActivities('luna'),
        implementation: implementationActivity(agentOperations),
      },
    });
  }

  /** Defines a literal command with only fixed host context tokens. */
  private operation(prerequisites: string[] = []) {
    return {
      schemaVersion: 4,
      id: 'check',
      purpose: 'Check captured owner',
      repository: 'sample',
      kind: 'command',
      command: 'node',
      args: [{ context: 'ownerId' }, { context: 'packageRoot' }, { context: 'ownedPaths' }],
      cwd: '.',
      category: 'unit-test',
      prerequisites,
      generatedDirectories: [],
      artifacts: [],
    };
  }
}

const scenarios = new SharedOperationScenarios();

test('agent test availability can precede the first owned suite', (t) =>
  scenarios.firstSuite(t, false));

test('required checks reject an empty captured test selection', (t) =>
  scenarios.firstSuite(t, true));

test('shares command definitions and retains inherited verification', (t) => scenarios.shared(t));

test('operation planning rejects prerequisite cycles', (t) => scenarios.cycle(t));

test('mandatory operation usages require finite actions', (t) => scenarios.service(t));

test('effective policy retains accumulated declaration provenance and implicit owned reads', (t) =>
  scenarios.provenance(t));

test('captures finite HTTP verification with a declared managed service', (t) => scenarios.http(t));

test('refuses HTTP verification without managed service authority', (t) =>
  scenarios.http(t, false));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
