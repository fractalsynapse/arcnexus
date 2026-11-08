import { createHash } from 'node:crypto';
import { ConfigurationReader } from './configuration.js';
import { git } from '../operations/process.js';

/** One recorded interface contract with its lock state and acceptance. */
export interface ContractRecord {
  id: string;
  file: string;
  owner: string;
  stage: string;
  digest?: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

/** One deterministic contract-integrity defect carrying a stable code. */
export interface ContractFinding {
  code: string;
  path: string;
  detail: string;
}

/** A captured locked contract, kept as plain data so it survives serialization with the run. */
export interface ContractLock {
  id: string;
  file: string;
  owner?: string;
}

const stages = new Set(['draft', 'proposed', 'locked']);

const registryPath = 'docs/interface/registry.yaml';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Reports the digest defect for one record, if its bytes disagree with the record. */
function digestFinding(record: ContractRecord, text: string): ContractFinding | undefined {
  if (!record.digest)
    return {
      code: 'contract-digest-missing',
      path: record.file,
      detail: `${record.id} records no digest.`,
    };
  if (digest(text) === record.digest) return undefined;
  return {
    code: 'contract-digest-mismatch',
    path: record.file,
    detail: `${record.id} content differs from the recorded digest; a locked contract changes only on recorded human authority.`,
  };
}

/** Reports the integrity defects for one contract record against the bytes at its revision. */
function recordFindings(
  record: ContractRecord,
  read: (path: string) => string | undefined,
): ContractFinding[] {
  const findings: ContractFinding[] = [];
  if (!stages.has(record.stage))
    findings.push({
      code: 'contract-stage-invalid',
      path: record.file,
      detail: `${record.id} declares unknown stage '${record.stage}'.`,
    });
  const text = read(record.file);
  if (text === undefined)
    return findings.concat({
      code: 'contract-file-missing',
      path: record.file,
      detail: `${record.id} records ${record.file}, which is absent.`,
    });
  const mismatch = digestFinding(record, text);
  if (mismatch) findings.push(mismatch);
  if (record.stage === 'locked' && (!record.acceptedBy || !record.acceptedAt))
    findings.push({
      code: 'contract-acceptance-missing',
      path: record.file,
      detail: `${record.id} is locked without recorded acceptance.`,
    });
  return findings;
}

/**
 * The project's declared interface contracts, loaded once and captured per run.
 *
 * A project without a registry declares no contracts: every method reports the empty case
 * instead of failing, so generic targets are unaffected. Reads use an immutable revision, which
 * is what prevents a candidate from unlocking itself by editing its own working tree.
 */
export class ContractRegistry {
  /** Holds the parsed records; every instance comes from one registry source. */
  private constructor(readonly records: ContractRecord[]) {}

  /** A registry that declares nothing; enforcement and findings both stay inert. */
  static empty(): ContractRegistry {
    return new ContractRegistry([]);
  }

  /** Parses registry bytes without touching the filesystem, so findings are testable directly. */
  static fromText(text: string): ContractRegistry {
    const value = new ConfigurationReader().parse(registryPath, text).value as {
      contracts?: Record<string, unknown>[];
      protocol?: Record<string, unknown>;
      supporting?: Record<string, unknown>[];
    };
    return new ContractRegistry(
      [value.protocol, ...(value.supporting ?? [])]
        .filter(Boolean)
        .concat(value.contracts ?? [])
        .map((entry) => entry as Record<string, unknown>)
        .filter((entry) => typeof entry.file === 'string' && typeof entry.id === 'string')
        .map((entry) => ({
          id: String(entry.id),
          file: String(entry.file),
          owner: String(entry.owner ?? ''),
          stage: String(entry.stage ?? ''),
          digest: typeof entry.digest === 'string' ? entry.digest : undefined,
          acceptedBy: typeof entry.acceptedBy === 'string' ? entry.acceptedBy : undefined,
          acceptedAt: typeof entry.acceptedAt === 'string' ? entry.acceptedAt : undefined,
        })),
    );
  }

  /** Reads the registry from one immutable Git revision; an absent registry is not a defect. */
  static atRevision(repository: string, base: string): ContractRegistry {
    if (!git(repository, 'ls-tree', base, '--', registryPath).trim())
      return ContractRegistry.empty();
    return ContractRegistry.fromText(git(repository, 'show', `${base}:${registryPath}`));
  }

  /** True when the project declares at least one contract record. */
  get declared(): boolean {
    return this.records.length > 0;
  }

  /** The locked records as plain data, so a captured assignment survives serialization. */
  locks(): ContractLock[] {
    return this.records
      .filter((record) => record.stage === 'locked')
      .map(({ id, file }) => ({ id, file }));
  }

  /**
   * Names the locked contract forbidding a write to this path, from captured locks alone.
   *
   * The registry itself is protected whenever any contract is locked: changing lock state is a
   * human act, so a candidate must not be able to edit the record that describes the lock.
   */
  static findLock(path: string, locks: ContractLock[] = []): ContractLock | undefined {
    if (!locks.length) return undefined;
    if (path === registryPath)
      return { id: 'contract-registry', file: registryPath, owner: 'the architect' };
    const lock = locks.find((entry) => entry.file === path);
    return lock ? { ...lock, owner: lock.owner || 'the architect' } : undefined;
  }

  /**
   * Recomputes every recorded digest and reports integrity defects.
   *
   * `read` supplies file bytes, normally from the same immutable revision as the registry, so a
   * locked contract edited without a new registry entry is caught instead of trusted.
   */
  integrityFindings(read: (path: string) => string | undefined): ContractFinding[] {
    return this.records.flatMap((record) => recordFindings(record, read));
  }

  /** Convenience over a repository revision for callers that hold only paths. */
  static readAtRevision(repository: string, base: string, path: string): string | undefined {
    if (!git(repository, 'ls-tree', base, '--', path).trim()) return undefined;
    return git(repository, 'show', `${base}:${path}`);
  }
}
