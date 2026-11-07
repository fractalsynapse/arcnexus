import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ExecutionRun } from '../coordination-store/execution-types.js';
import type { RecordData } from '../workspace/state.js';

/** Admits an explicit retry only when retained target operations prove a settled failure. */
export class PromotionRecovery {
  /** Binds recovery to existing host evidence rather than caller-authored success claims. */
  constructor(private readonly root: string) {}

  /** Checks every current promotion attempt so a later failed record cannot hide uncertain work. */
  assertSettledFailure(run: ExecutionRun): void {
    const records = readdirSync(join(this.root, 'runs'))
      .filter((id) => existsSync(join(this.root, 'runs', id, 'report.json')))
      .map((id) => this.read(id))
      .filter((record) => record.executionRunId === run.id);
    if (!records.length || records.some((record) => !this.failed(record, run)))
      throw new Error(
        'Promotion verification was interrupted or lacks settled failure evidence; inspect retained operations',
      );
  }

  /** Refuses aliased or malformed private receipts before inspecting run attribution. */
  private read(id: string): RecordData {
    const path = join(this.root, 'runs', id, 'report.json');
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.nlink !== 1 || realpathSync(path) !== resolve(path))
      throw new Error('Unsafe promotion evidence: ' + path);
    const record = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
    if (record.id !== id) throw new Error('Promotion evidence identity mismatch: ' + path);
    return record;
  }

  /** A known failed finite check is retryable; missing, cancelled and uncertain observations are not. */
  private failed(record: RecordData, run: ExecutionRun): boolean {
    const operations = record.operationInvocations as Array<{ status: string }> | undefined;
    return (
      record.activationRole === 'publication-checks' &&
      record.base === run.data.promotionHead &&
      record.status === 'failed' &&
      JSON.stringify(record.executionEnvironment) === JSON.stringify(run.environment) &&
      !!operations?.some((operation) => operation.status === 'failed') &&
      operations.every((operation) => ['completed', 'failed'].includes(operation.status))
    );
  }
}
