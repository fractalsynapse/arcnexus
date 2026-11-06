import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { ExecutionAssignment } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { RecordData } from '../workspace/state.js';
import { EvidencePages } from './evidence-pages.js';

interface RetainedRecord {
  recordId?: string;
  directory?: string;
  record?: RecordData;
  problem?: string;
}

/** Pages assignment-bound command output from identity-checked retained operation journals. */
export class InvocationDiagnostics {
  /** Binds diagnostic reads to the supervising host's private evidence root and execution store. */
  constructor(
    private readonly root: string,
    private readonly store: ExecutionStore,
  ) {}

  /** Adds an invocation index and per-invocation pages to the existing assignment evidence capability. */
  append(pages: EvidencePages, assignment: ExecutionAssignment) {
    const current = this.store.assignment(assignment.id);
    if (current.runId !== assignment.runId || current.owner !== assignment.owner)
      throw new Error('Invocation evidence assignment identity differs from the host store');
    const retained = this.record(current);
    const artifact = current.id + ':invocations';
    const invocations = retained.record
      ? this.appendInvocations(pages, current, retained.record, retained.directory!)
      : [];
    pages.add(
      artifact,
      JSON.stringify({
        assignmentId: current.id,
        recordId: retained.recordId ?? null,
        invocations,
        ...(retained.problem ? { evidenceUnavailable: true, reason: retained.problem } : {}),
      }),
      'json',
    );
    return { artifact, recordId: retained.recordId ?? null, invocationCount: invocations.length };
  }

  /** Resolves only the matching assignment record and turns missing or unsafe records into explicit gaps. */
  private record(assignment: ExecutionAssignment): RetainedRecord {
    const id = assignment.data.recordId;
    if (!id) return { problem: 'No retained execution record' };
    if (!this.identifier(id)) return { problem: 'Invalid retained record identity' };
    const directory = join(this.root, 'runs', id);
    try {
      const recordPath = join(directory, 'report.json');
      this.directory(directory);
      const record = JSON.parse(this.file(recordPath, directory)) as RecordData;
      if (
        record.id !== id ||
        record.executionRunId !== assignment.runId ||
        record.assignmentId !== assignment.id
      )
        throw new Error('Retained record belongs to a different run or assignment');
      return { recordId: id, directory, record };
    } catch {
      return { recordId: id, problem: 'Retained record is unavailable or unsafe' };
    }
  }

  /** Adds one fixed page per retained invocation and returns only safe artifact references. */
  private appendInvocations(
    pages: EvidencePages,
    assignment: ExecutionAssignment,
    record: RecordData,
    directory: string,
  ) {
    const journal = Array.isArray(record.operationInvocations) ? record.operationInvocations : [];
    return journal.map((invocation: any, index) => {
      const id = this.identifier(invocation?.id) ? invocation.id : 'unknown-' + index;
      const artifact = assignment.id + ':invocation:' + id;
      pages.add(
        artifact,
        JSON.stringify(this.diagnostic(assignment, record, directory, invocation)),
        'json',
      );
      return {
        invocationId: typeof invocation?.id === 'string' ? invocation.id : null,
        operationId: typeof invocation?.operationId === 'string' ? invocation.operationId : null,
        artifact,
      };
    });
  }

  /** Correlates a journal entry and operation result before reading its canonical combined log. */
  private diagnostic(
    assignment: ExecutionAssignment,
    record: RecordData,
    directory: string,
    invocation: any,
  ): unknown {
    if (!this.identifier(invocation?.id)) return this.gap('Invalid invocation identity');
    if (invocation.runId !== record.id || invocation.assignmentId !== assignment.id)
      return this.gap('Invocation belongs to a different run or assignment');
    const result = invocation.result;
    if (!result || typeof result.log !== 'string')
      return this.gap('Invocation has no retained command output');
    if (!this.operation(record, invocation, result.log))
      return this.gap('No matching retained operation result');
    try {
      return {
        recordId: record.id,
        assignmentId: assignment.id,
        invocationId: invocation.id,
        operationId: invocation.operationId,
        status: invocation.status,
        exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
        resolvedContext: invocation.context ?? null,
        outputComplete: invocation.status === 'completed' || invocation.status === 'failed',
        combinedOutput: this.output(directory, invocation.id, result.log),
      };
    } catch {
      return this.gap('Retained invocation output is unavailable or unsafe');
    }
  }

  /** Requires a matching captured operation, including a failed prerequisite absent from command history. */
  private operation(record: RecordData, invocation: any, log: string): boolean {
    const operations = Array.isArray(record.operations) ? (record.operations as any[]) : [];
    return operations.some(
      (operation) =>
        (operation.id === invocation.operationId ||
          operation.failedOperationId === invocation.operationId) &&
        operation.log === log,
    );
  }

  /** Reads only the invocation's generated combined log path as one unaliased regular file. */
  private output(directory: string, id: string, path: string): string {
    const expected = join(directory, 'invocation-' + id + '.log');
    if (resolve(path) !== resolve(expected) || dirname(resolve(path)) !== resolve(directory))
      throw new Error('Invocation output path is outside its retained record');
    return this.file(path, directory);
  }

  /** Rejects path aliases, symlinks, shared inodes, and non-file evidence before reading. */
  private file(path: string, directory: string): string {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.nlink !== 1 || realpathSync(path) !== resolve(path))
      throw new Error('Evidence is not an unaliased regular file');
    if (dirname(resolve(path)) !== resolve(directory))
      throw new Error('Evidence file is outside its retained record');
    return readFileSync(path, 'utf8');
  }

  /** Confirms the retained invocation directory itself is not aliased. */
  private directory(path: string): void {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || realpathSync(path) !== resolve(path))
      throw new Error('Retained record directory is unsafe');
  }

  /** Provides a pageable diagnostic gap without substituting guessed command success. */
  private gap(reason: string): unknown {
    return { evidenceUnavailable: true, reason };
  }

  /** Accepts canonical UUID identities before deriving retained paths or exposed page names. */
  private identifier(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
  }
}
