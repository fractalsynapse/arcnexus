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

/** A contract file whose header and scenario rows carry explicit metadata. */
function contractBytes(stage = 'locked', revision = 1, scenarios = 3): string {
  const rows = Array.from({ length: scenarios }, (_, i) => `| EX-${i + 1} | obligation ${i + 1} |`);
  return [
    '# Example contract',
    '',
    `Type contract: \`example\`. Stage: **${stage}** (revision ${revision}). Owner: \`example\`.`,
    '',
    '| Scenario | Obligation |',
    '| --- | --- |',
    ...rows,
    '',
  ].join('\n');
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

  /** Reports a registry whose stage, revision or scenario count disagrees with the contract file. */
  metadata(): void {
    const bytes = contractBytes('proposed', 2, 4);
    const registry_ = ContractRegistry.fromText(
      registry({ digest: digest(bytes), revision: '4', scenarios: '3' }),
    );
    const findings = registry_.integrityFindings(reader({ [contractPath]: bytes }));
    assert.deepEqual(
      findings.map((finding) => finding.code),
      [
        'contract-metadata-mismatch',
        'contract-metadata-mismatch',
        'contract-scenario-count-mismatch',
      ],
      'stage, revision and scenario counts are each reported',
    );
    assert.match(
      findings[0]!.detail,
      /records stage 'locked' while the contract states 'proposed'/,
    );
    assert.match(findings[1]!.detail, /records revision 4 while the contract states 2/);
    assert.match(
      findings[2]!.detail,
      /records 3 acceptance scenarios while the contract carries 4/,
    );
  }

  /** Accepts metadata that agrees, and skips what the registry does not record. */
  metadataAgreement(): void {
    const bytes = contractBytes('locked', 1, 3);
    const agreed = ContractRegistry.fromText(
      registry({ digest: digest(bytes), revision: '1', scenarios: '3' }),
    );
    assert.deepEqual(agreed.integrityFindings(reader({ [contractPath]: bytes })), []);
    const unrecorded = ContractRegistry.fromText(registry({ digest: digest('x') }));
    assert.equal(
      unrecorded.integrityFindings(reader({ [contractPath]: 'edited\n' })).length,
      1,
      'only the digest defect is reported when no counts are recorded',
    );
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

test('a locked contract matching its recorded digest reports no findings', () =>
  scenarios.matching());

test('a locked contract edited without a new registry entry is reported', () =>
  scenarios.mismatch());

test('a registry disagreeing with its contract metadata is reported', () => scenarios.metadata());

test('agreeing or unrecorded contract metadata produces no finding', () =>
  scenarios.metadataAgreement());

test('a locked contract without recorded acceptance is reported', () => scenarios.unaccepted());

test('a missing contract file and an unknown stage are both reported', () => scenarios.defects());

test('a project without a registry stays inert', () => scenarios.undeclared());

test('locked paths and the registry itself are named from captured locks', () => scenarios.locks());

registerSuite({
  component: 'architecture',
  level: 'acceptance',
  tags: ['deterministic', 'contracts'],
});
