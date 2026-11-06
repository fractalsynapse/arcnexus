import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { ExecutionLease } from '../coordination-store/execution-store.js';
import { assertServicesStopped } from '../operations/service-state.js';
import { InputError } from '../architecture/config.js';
import { RetentionCatalog, type RetainedEvidence } from './retention-catalog.js';

/** Enforces configured evidence retention by expiring oldest terminal bundles with explicit receipts. */
export class EvidenceRetention {
  readonly limit: number;

  /** Reads one host environment setting, rejecting invalid limits before any cleanup occurs. */
  constructor(private readonly root: string) {
    const setting = process.env.ARCNEXUS_EVIDENCE_MAX_BYTES ?? '100000000000';
    this.limit = Number(setting);
    if (!/^\d+$/.test(setting) || !Number.isSafeInteger(this.limit) || this.limit < 2)
      throw new InputError('ARCNEXUS_EVIDENCE_MAX_BYTES must be an integer of at least 2 bytes');
  }

  /** At the ceiling, removes only eligible bundles until usage falls to half; protected pressure blocks dispatch. */
  enforce(canExpire = true): void {
    if (this.bytes() < this.limit && !this.pruning()) return;
    if (!canExpire)
      throw new Error('Evidence storage cleanup must wait for the active execution checkpoint');
    const lease = new ExecutionLease(join(this.root, 'evidence-retention.lease.sqlite'));
    try {
      const target = Math.floor(this.limit / 2);
      this.cycle('pruning');
      const eligible = new RetentionCatalog(this.root).eligible();
      this.recover(new Set(eligible.map((entry) => entry.id)));
      for (const entry of eligible) {
        if (this.bytes() <= target) break;
        this.expire(entry);
      }
      if (this.bytes() > target)
        throw new Error(
          'Evidence storage limit reached; protected or unidentified evidence prevents cleanup to 50%',
        );
      this.cycle('completed');
    } finally {
      lease.close();
    }
  }

  /** Measures evidence without counting source worktrees, Git repositories or dependency caches. */
  bytes(): number {
    const projects = join(this.root, 'projects');
    const reports = existsSync(projects)
      ? readdirSync(projects).map((id) => join(projects, id, 'reports'))
      : [];
    const paths = ['runs', 'test-runs', 'private', 'expired-evidence']
      .map((name) => join(this.root, name))
      .concat(reports);
    if (paths.some((path) => lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()))
      throw new Error('Evidence storage roots cannot be symlink aliases');
    return paths.reduce((total, path) => total + this.size(path), 0);
  }

  /** Counts regular files and never follows directory aliases outside application storage. */
  private size(path: string): number {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) return 0;
    if (stat.isFile()) return stat.size;
    return stat.isDirectory()
      ? readdirSync(path).reduce((sum, name) => sum + this.size(join(path, name)), 0)
      : 0;
  }

  /** Journals identity and source location before expiring an entire historical evidence bundle. */
  private expire(entry: RetainedEvidence): void {
    const path = join(this.root, 'runs', entry.id);
    if (!existsSync(path)) return;
    if (lstatSync(path).isSymbolicLink()) throw new Error('Aliased evidence directory');
    const report = readFileSync(join(path, 'report.json'));
    const record = JSON.parse(report.toString());
    if (record.id !== entry.id || record.executionRunId !== entry.runId) return;
    if (!this.settled(record, path)) return;
    const identity = lstatSync(path);
    const receipt = {
      ...entry,
      expiredAt: new Date().toISOString(),
      status: 'expiring',
      device: identity.dev,
      inode: identity.ino,
      reportHash: createHash('sha256').update(report).digest('hex'),
      workspace: record.workspace,
      source: record.source,
      branch: record.branch,
      base: record.base,
    };
    this.receipt(entry.id, receipt);
    rmSync(path, { recursive: true });
    this.receipt(entry.id, { ...receipt, status: 'expired' });
  }

  /** Preserves uncertain operations and any directory containing maintained repository material. */
  private settled(record: any, path: string): boolean {
    if (
      !['completed', 'prepared'].includes(record.status) ||
      !Array.isArray(record.operationInvocations) ||
      record.operationInvocations.some(
        (operation: { status: string }) => operation.status !== 'completed',
      )
    )
      return false;
    if (
      [record.workspace, record.source].some(
        (location) =>
          typeof location !== 'string' || location === path || location.startsWith(path + '/'),
      )
    )
      return false;
    try {
      assertServicesStopped(this.root, record.id);
      if (record.initialization?.runId)
        assertServicesStopped(this.root, record.initialization.runId);
      return true;
    } catch {
      return false;
    }
  }

  /** Finishes already-authorized deletion after interruption, preserving the original expiration identity. */
  private recover(eligible: Set<string>): void {
    const directory = join(this.root, 'expired-evidence');
    if (!existsSync(directory)) return;
    for (const name of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
      const receipt = JSON.parse(readFileSync(join(directory, name), 'utf8'));
      if (receipt.status !== 'expiring') continue;
      if (!/^[a-f0-9-]{36}$/.test(receipt.id) || name !== receipt.id + '.json')
        throw new Error('Invalid evidence expiration receipt');
      if (!eligible.has(receipt.id))
        throw new Error('Interrupted expiration is now protected by retained work');
      const path = join(this.root, 'runs', receipt.id);
      const stat = lstatSync(path, { throwIfNoEntry: false });
      if (
        stat &&
        (stat.isSymbolicLink() || stat.dev !== receipt.device || stat.ino !== receipt.inode)
      )
        throw new Error('Evidence recovery directory identity changed');
      rmSync(path, { recursive: true, force: true });
      this.receipt(receipt.id, { ...receipt, status: 'expired' });
    }
  }

  /** Resumes a partial pruning cycle even when it has already fallen below the trigger threshold. */
  private pruning(): boolean {
    const path = join(this.root, 'evidence-retention.json');
    return existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).status === 'pruning';
  }

  /** Keeps the high/low watermark transition durable independently of individual expiration receipts. */
  private cycle(status: string): void {
    const path = join(this.root, 'evidence-retention.json'),
      temporary = path + '.' + randomUUID();
    writeFileSync(
      temporary,
      JSON.stringify({ status, limit: this.limit, at: new Date().toISOString() }),
      { flag: 'wx', mode: 0o600 },
    );
    renameSync(temporary, path);
  }

  /** Atomically retains compact expiration evidence outside the bundle being removed. */
  private receipt(id: string, value: object): void {
    const directory = join(this.root, 'expired-evidence');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, id + '.json'),
      temporary = path + '.' + randomUUID();
    writeFileSync(temporary, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temporary, path);
  }
}
