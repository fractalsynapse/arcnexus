import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { digest } from '../architecture/assignment.js';
import { validateSchema, SchemaValidationError } from '../architecture/schema.js';
import type { RecordData } from '../workspace/state.js';
import type { CommandResult } from './process.js';

interface ProposalEvidence {
  invocationId: string;
  sha256: string;
  paths: string[];
}

/** Pins complete machine-readable edit proposals separately from bounded command diagnostics. */
export class OperationEditProposals {
  /** Binds proposal lookup to one host-owned record and its private evidence directory. */
  constructor(
    private readonly directory: string,
    private readonly record: RecordData,
  ) {}

  /** Captures only successful observed agent invocations whose complete output is a valid edit batch. */
  capture(result: CommandResult): ProposalEvidence | undefined {
    const invocation = this.invocations().findLast((entry) => entry.result?.log === result.log);
    if (!this.eligible(invocation) || result.exitCode !== 0) return undefined;
    if (resolve(result.log) !== join(resolve(this.directory), `invocation-${invocation.id}.log`))
      throw new Error('Edit proposal log does not belong to its observed invocation');
    const request = this.parse(this.bytes(result.log));
    if (!request) return undefined;
    const content = JSON.stringify({ ...request, id: 'operation-' + invocation.id });
    const evidence = {
      invocationId: invocation.id,
      sha256: digest(content),
      paths: request.changes.map((change: { path: string }) => change.path),
    };
    const path = this.path(invocation.id);
    mkdirSync(join(this.directory, 'edit-proposals'), { recursive: true, mode: 0o700 });
    if (
      realpathSync(join(this.directory, 'edit-proposals')) !==
      resolve(this.directory, 'edit-proposals')
    )
      throw new Error('Edit proposal directory cannot be an alias');
    if (!existsSync(path)) writeFileSync(path, content, { flag: 'wx', mode: 0o400 });
    if (digest(this.bytes(path)) !== evidence.sha256)
      throw new Error('Edit proposal evidence changed');
    this.proposals()[invocation.id] = evidence;
    return evidence;
  }

  /** Resolves pinned bytes without trusting an agent-supplied path, owner or operation definition. */
  resolve(invocationId: string): unknown | undefined {
    if (!/^[a-f0-9-]{36}$/.test(invocationId)) return undefined;
    const evidence = this.proposals()[invocationId];
    const invocation = this.invocations().find((entry) => entry.id === invocationId);
    if (!evidence || !this.eligible(invocation)) return undefined;
    if (evidence.invocationId !== invocationId) throw new Error('Edit proposal identity changed');
    const bytes = this.bytes(this.path(invocationId));
    if (digest(bytes) !== evidence.sha256) throw new Error('Edit proposal evidence changed');
    const request = this.parse(bytes);
    if (!request || request.id !== 'operation-' + invocationId)
      throw new Error('Invalid retained edit proposal');
    return request;
  }

  /** Distinguishes ordinary command output from an explicitly shaped complete edit request. */
  private parse(bytes: Buffer): any | undefined {
    let request: unknown;
    try {
      request = JSON.parse(bytes.toString('utf8'));
    } catch {
      return undefined;
    }
    try {
      validateSchema('checked-edits', request);
      return request;
    } catch (error) {
      if (error instanceof SchemaValidationError) return undefined;
      throw error;
    }
  }

  /** Requires same-record, same-assignment, completed agent work rather than failed or pending results. */
  private eligible(invocation: any): boolean {
    return (
      !!invocation &&
      /^[a-f0-9-]{36}$/.test(invocation.id) &&
      invocation.runId === this.record.id &&
      invocation.assignmentId === this.record.assignmentId &&
      invocation.purpose === 'agent' &&
      invocation.status === 'completed' &&
      invocation.result?.exitCode === 0
    );
  }

  /** Returns captured invocation observations without creating or authorizing new work. */
  private invocations(): any[] {
    return (this.record.operationInvocations ?? []) as any[];
  }

  /** Keeps proposal references in the same durable record as their observed originating operations. */
  private proposals(): Record<string, ProposalEvidence> {
    return (this.record.operationEditProposals ??= {}) as Record<string, ProposalEvidence>;
  }

  /** Derives an internal immutable artifact location from a validated host invocation identity. */
  private path(id: string): string {
    return join(this.directory, 'edit-proposals', id + '.json');
  }

  /** Rejects symlink ancestors and hard-linked files before consuming retained evidence. */
  private bytes(path: string): Buffer {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.nlink !== 1 || realpathSync(path) !== resolve(path))
      throw new Error('Unsafe edit proposal evidence');
    return readFileSync(path);
  }
}
