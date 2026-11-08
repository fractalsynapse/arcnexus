import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ContractRegistry } from '../../../../dist/library/architecture/contracts.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

const contractPath = 'docs/interface/arcnexus-example.md';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Builds registry text for one record with explicit field overrides. */
function registry(overrides: Record<string, string | undefined>): string {
  const entry = {
    id: 'arcnexus/example',
    file: contractPath,
    owner: 'example',
    stage: 'locked',
    acceptedBy: 'architect',
    acceptedAt: '2026-11-07',
    ...overrides,
  };
  const fields = Object.entries(entry)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `    ${key}: "${value}"`)
    .join('\n');
  return `contracts:\n  -\n${fields}\n`;
}

/** Reads contract bytes from an in-memory revision so findings need no repository. */
const reader = (files: Record<string, string>) => (path: string) => files[path];

/** Exercises the locked-contract integrity findings required by the architecture-model contract. */
class ContractIntegrityScenarios {
  /** Accepts a registry whose recorded digest matches the file at the validated revision. */
  matching(): void {
    const bytes = '# contract\n';
    const registry_ = ContractRegistry.fromText(registry({ digest: digest(bytes) }));
    const findings = registry_.integrityFindings(reader({ [contractPath]: bytes }));
    assert.deepEqual(findings, []);
    assert.equal(registry_.declared, true);
    assert.deepEqual(registry_.locks(), [{ id: 'arcnexus/example', file: contractPath }]);
  }

  /** Reports the stable code when a locked contract's bytes differ from the record. */
  mismatch(): void {
    const registry_ = ContractRegistry.fromText(registry({ digest: digest('original') }));
    const findings = registry_.integrityFindings(reader({ [contractPath]: 'edited\n' }));
    assert.deepEqual(
      findings.map((finding) => finding.code),
      ['contract-digest-mismatch'],
    );
    assert.match(findings[0]!.detail, /recorded human authority/);
  }

  /** Reports a locked record that carries no recorded acceptance. */
  unaccepted(): void {
    const bytes = '# contract\n';
    const registry_ = ContractRegistry.fromText(
      registry({ digest: digest(bytes), acceptedBy: undefined, acceptedAt: undefined }),
    );
    const findings = registry_.integrityFindings(reader({ [contractPath]: bytes }));
    assert.deepEqual(
      findings.map((finding) => finding.code),
      ['contract-acceptance-missing'],
    );
  }

  /** Reports a missing file, and reports an unknown stage alongside its digest defect. */
  defects(): void {
    const missing = ContractRegistry.fromText(registry({ digest: digest('x') }));
    assert.deepEqual(
      missing.integrityFindings(reader({})).map((finding) => finding.code),
      ['contract-file-missing'],
    );
    const unknown = ContractRegistry.fromText(registry({ stage: 'frozen', digest: digest('x') }));
    const findings = unknown.integrityFindings(reader({ [contractPath]: 'x' }));
    assert.deepEqual(
      findings.map((finding) => finding.code),
      ['contract-stage-invalid'],
    );
  }

  /** Keeps enforcement inert for a project that declares no contract registry. */
  undeclared(): void {
    const empty = ContractRegistry.empty();
    assert.equal(empty.declared, false);
    assert.deepEqual(empty.integrityFindings(reader({})), []);
    assert.deepEqual(empty.locks(), []);
    assert.equal(ContractRegistry.findLock('docs/interface/registry.yaml', []), undefined);
  }

  /** Protects the registry itself and names the governing contract for a locked path. */
  locks(): void {
    const captured = [{ id: 'arcnexus/example', file: contractPath }];
    assert.equal(
      ContractRegistry.findLock(contractPath, captured)?.id,
      'arcnexus/example',
      'a locked contract names its own record',
    );
    assert.equal(
      ContractRegistry.findLock('docs/interface/registry.yaml', captured)?.id,
      'contract-registry',
      'the registry is protected while any contract is locked',
    );
    assert.equal(ContractRegistry.findLock('src/index.ts', captured), undefined);
  }
}

const scenarios = new ContractIntegrityScenarios();

test('a locked contract matching its recorded digest reports no findings', (t) =>
  scenarios.matching());

test('a locked contract edited without a new registry entry is reported', (t) =>
  scenarios.mismatch());

test('a locked contract without recorded acceptance is reported', (t) => scenarios.unaccepted());

test('a missing contract file and an unknown stage are both reported', (t) => scenarios.defects());

test('a project without a registry stays inert', (t) => scenarios.undeclared());

test('locked paths and the registry itself are named from captured locks', (t) =>
  scenarios.locks());

registerSuite({
  component: 'architecture',
  level: 'acceptance',
  tags: ['deterministic', 'contracts'],
});
