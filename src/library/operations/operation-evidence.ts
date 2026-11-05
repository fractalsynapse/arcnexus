import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { targetCommand } from '../architecture/bindings.js';
import { observe } from '../report/timeline.js';
import { save, type RecordData } from '../workspace/state.js';
import { OperationArtifacts, type OperationArtifact } from './operation-artifacts.js';
import type { Operation } from './operations.js';
import type { CommandResult } from './process.js';

interface Invocation {
  id: string;
  operationId: string;
  runId: string;
  assignmentId?: unknown;
  command: string;
  arguments: string[];
  cwd: string;
  artifacts: OperationArtifact[];
  artifactErrors: string[];
  definitionDigest: string;
  purpose: string;
  context: unknown;
  selectedTests?: Operation['selectedTests'];
  output?: unknown;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  result?: CommandResult;
  error?: string;
}

/** Persists the same invocation lifecycle for commands, managed services and HTTP checks. */
export class OperationEvidence {
  /** Binds evidence to private host storage and caller cancellation. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
    private readonly signal: AbortSignal,
  ) {}

  /** Refuses uncertain execution while allowing resource cleanup to proceed after interruption. */
  assertSettled(): void {
    const invocations = (this.record.operationInvocations ?? []) as Invocation[];
    if (invocations.some((item) => item.status === 'running' || item.status === 'interrupted'))
      throw new Error('Operation completion is uncertain; inspect retained invocation evidence');
  }

  /** Records durable intent before dispatch and completion only after observed operation evidence. */
  async run<T>(
    op: Operation,
    purpose: string,
    work: (id: string) => Promise<T>,
    cleanup = false,
  ): Promise<T> {
    if (!cleanup) this.assertSettled();
    const invocation = this.begin(op, purpose);
    try {
      const output = await work(invocation.id);
      if (output && typeof output === 'object' && 'exitCode' in output)
        invocation.result = output as unknown as CommandResult;
      else invocation.output = structuredClone(output);
      invocation.status = 'completed';
      return output;
    } catch (error) {
      this.failed(invocation, op, error);
      throw error;
    } finally {
      this.finish(invocation, op);
    }
  }

  /** Captures definition identity and resolved context before starting managed work. */
  private begin(op: Operation, purpose: string): Invocation {
    if (op.kind === 'upstream') throw new Error('Upstream operations require lifecycle evidence');
    const invocation: Invocation = {
      id: randomUUID(),
      operationId: op.id,
      runId: this.record.id,
      assignmentId: this.record.assignmentId,
      command: op.kind === 'http' ? 'HTTP GET' : targetCommand(this.record, op).command,
      arguments: op.kind === 'http' ? [op.http.path] : [...op.args],
      cwd: join(this.record.workspace, op.cwd),
      artifacts: [],
      artifactErrors: [],
      definitionDigest: op.definitionDigest!,
      context: op.resolvedContext,
      selectedTests: op.selectedTests,
      purpose,
      status: 'running',
    };
    this.record.operationInvocations ??= [];
    (this.record.operationInvocations as Invocation[]).push(invocation);
    observe(this.root, this.record, 'operation.invocation', invocation);
    save(this.root, this.record);
    return invocation;
  }

  /** Distinguishes observed command/service failure from uncertain transport or process completion. */
  private failed(invocation: Invocation, op: Operation, error: unknown): void {
    invocation.status = this.signal.aborted ? 'cancelled' : 'interrupted';
    invocation.error = String(error);
    if (error && typeof error === 'object' && 'commandResult' in error) {
      invocation.result = error.commandResult as CommandResult;
      if (!this.signal.aborted) invocation.status = 'failed';
    }
    const services = this.record.services as
      Array<{ id: string; status: string; endpointClosed?: boolean }> | undefined;
    const service = services?.findLast((entry) => entry.id === op.id);
    if (
      op.kind === 'service' &&
      !this.signal.aborted &&
      service?.status === 'stopped' &&
      service.endpointClosed
    )
      invocation.status = 'failed';
  }

  /** Captures declared artifacts and rejects incomplete evidence before publishing success. */
  private finish(invocation: Invocation, op: Operation): void {
    const artifacts = new OperationArtifacts(this.root, this.record);
    for (const path of op.artifacts) {
      try {
        invocation.artifacts.push(artifacts.capture(path, invocation.id));
      } catch (error) {
        invocation.artifactErrors.push(String(error));
      }
    }
    const incomplete = invocation.artifactErrors.length > 0 && invocation.status === 'completed';
    if (incomplete) invocation.status = 'failed';
    observe(this.root, this.record, 'operation.invocation-finished', invocation);
    save(this.root, this.record);
    if (incomplete)
      throw new Error(
        'Operation artifact evidence incomplete: ' + invocation.artifactErrors.join('; '),
      );
  }
}
