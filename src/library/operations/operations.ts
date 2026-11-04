import { OperationExecution } from './operation-execution.js';
import { readDiagnosticExcerpt } from './diagnostics.js';
import { materialCandidate } from '../change-inspection/changes.js';
import { ProgressObserver } from '../report/progress.js';
import { realpathSync } from 'node:fs';
import { OperationArtifacts } from './operation-artifacts.js';
import { join, relative } from 'node:path';
import { type ResolvedAssignment } from '../architecture/assignment.js';
import type { Command } from '../architecture/config.js';
import { observe } from '../report/timeline.js';
import type { BridgeTool } from '../steward/bridge.js';
import { save, type RecordData } from '../workspace/state.js';
import { isObservedCommandFailure, type CommandResult } from './process.js';
import { ServiceManager, type HttpDefinition, type ServiceDefinition } from './services.js';

export { operationEnvironment } from './environment.js';

export type Operation = {
  schemaVersion: 2 | 3 | 4;
  prerequisites?: string[];
  network?: boolean | { domains: string[] };
  argumentTokens?: import('./operation-definition.js').ArgumentToken[];
  pendingContext?: import('./operation-definition.js').ContextInput[];
  definitionArguments?: import('./operation-definition.js').ArgumentToken[];
  selectedTests?: import('../testing/captured-tests.js').DiscoveredSuite[];
  definitionDigest?: string;
  resolvedContext?: import('./operation-definition.js').OperationContext;
  id: string;
  purpose: string;
  repository: string;
  cwd: string;
  category: string;
  activities: string[];
  timeoutSeconds?: number;
  generatedDirectories: string[];
  artifacts: string[];
  probes: Command[];
} & (
  | (Command & { kind: 'command' | 'service'; service?: ServiceDefinition })
  | { kind: 'http'; http: HttpDefinition }
  | { kind: 'upstream'; action: 'issue.create' | 'issue.comment' | 'issue.close' }
  | { kind: 'upstream'; action: 'delivery.publish'; targetBranch: string; automaticMerge?: boolean }
);

export interface OperationBridge {
  tools: BridgeTool[];
  call: (name: string, args: unknown) => Promise<unknown>;
  disconnect: () => void;
  close: () => Promise<void>;
}

export function operationBridge(
  root: string,
  record: RecordData,
  signal: AbortSignal,
  inspect: () => void,
): OperationBridge {
  const runtime = new OperationRuntime(root, record, signal, inspect);
  return {
    tools: operationTools(),
    call: (name, args) => runtime.call(name, args),
    close: () => runtime.close(),
    disconnect: () => runtime.disconnect(),
  };
}

/** Identifies a denied selection before any operation is queued or executed. */
class OperationSelectionError extends Error {
  /** Retains the requested identity for actionable feedback without granting its authority. */
  constructor(readonly operationId: string) {
    super('Unknown or denied operation: ' + operationId);
  }
}

/** Authorizes declared commands and services, accounts for calls, and retains their evidence. */
class OperationRuntime {
  private readonly resolved: ResolvedAssignment;

  private services: ServiceManager;

  private active: AbortController | undefined;

  private lifecycle = new AbortController();

  private pending?: Promise<unknown>;

  private generation = 0;

  private activeNumber = 0;

  /** Restores operation counters and binds managed services to captured assignment authority. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
    private readonly signal: AbortSignal,
    private readonly inspect: () => void,
  ) {
    this.resolved = record.resolvedAssignment as ResolvedAssignment;
    if (this.resolved.operations.some((operation) => operation.schemaVersion !== 4))
      throw new Error('Operation execution requires schema 4; migrate historical definitions');
    this.services = new ServiceManager(
      root,
      record,
      AbortSignal.any([signal, this.lifecycle.signal]),
    );
    record.operations ??= [];
    record.operationCalls ??= 0;
  }

  /** Releases resources owned by this instance. */
  async close(): Promise<void> {
    this.generation++;
    this.lifecycle.abort(new Error('Operation turn completed'));
    this.active?.abort(new Error('Operation turn completed'));
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
      await this.services.stop();
      this.lifecycle = new AbortController();
      this.services = new ServiceManager(
        this.root,
        this.record,
        AbortSignal.any([this.signal, this.lifecycle.signal]),
      );
    }
  }

  /** Stops managed work when its operation bridge loses its owner. */
  disconnect(): void {
    this.generation++;
    this.lifecycle.abort(new Error('Operation bridge disconnected'));
    this.active?.abort(new Error('Operation bridge disconnected'));
    void this.services.stop().catch(() => {});
  }

  /** Accounts for and authorizes a tool request before execution. */
  async call(name: string, args: unknown): Promise<unknown> {
    if (name === 'operations.list') return this.list(args);
    let op: Operation;
    try {
      op = this.authorize(name, args);
    } catch (error) {
      if (error instanceof OperationSelectionError) return this.rejected(error);
      throw error;
    }
    if (op.kind === 'service' && !name.startsWith('services.'))
      throw new Error('Use services.start for service operations');
    const number = Number(this.record.operationCalls);
    observe(this.root, this.record, 'operation.queued', { id: op.id, number });
    const generation = this.generation;
    const execution = (this.pending ?? Promise.resolve()).then(() =>
      name.startsWith('services.') ? this.service(name, op) : this.perform(op, number, generation),
    );
    this.pending = execution;
    return execution;
  }

  /** Dispatches an authorized operation through the managed execution service. */
  private async perform(op: Operation, number: number, generation: number) {
    if (generation !== this.generation)
      throw new Error('Operation scope closed before queued execution');
    this.signal.throwIfAborted();
    this.activeNumber = number;
    const progress = new ProgressObserver(this.root, this.record);
    const action = { activity: this.record.stage, operation: op.id };
    const candidate = materialCandidate(this.record);
    progress.before(action, candidate);
    const result = await this.finite(op);
    if (result.status === 'failed') {
      const warning = progress.failed(action, result.output, candidate);
      return { ...result, ...(warning ? { loopWarning: warning } : {}) };
    }
    return result;
  }

  /** Lists only operations captured for this assignment. */
  private list(args: unknown) {
    if (args && Object.keys(args).length) throw new Error('Operation listing accepts no arguments');
    return {
      operations: this.resolved.operations.filter((operation) => operation.kind !== 'upstream'),
      used: this.record.operationCalls,
    };
  }

  /** Rejects unavailable operation IDs or activity permissions. */
  private authorize(name: string, args: unknown): Operation {
    const { root, record, resolved } = this;
    this.request(args);
    if (
      !args ||
      typeof args !== 'object' ||
      Object.keys(args).length !== 1 ||
      typeof (args as { id?: unknown }).id !== 'string'
    )
      throw new Error('Operation requires only an ID');
    const id = (args as { id: string }).id,
      op = resolved.operations.find((op) => op.id === id);
    if (!op || op.kind === 'upstream') throw new OperationSelectionError(id);
    const stage = String(record.stage);
    this.assertActivity(op, stage);
    observe(root, record, 'operation.authorized', {
      id,
      tool: name,
      stage,
      number: record.operationCalls,
    });
    return op;
  }

  /** Preserves pending authorized work while diagnosing repeated unavailable selections. */
  private rejected(error: OperationSelectionError): unknown {
    const { root, record } = this;
    const action = { activity: record.stage, operation: error.operationId, phase: 'selection' };
    const progress = new ProgressObserver(root, record);
    const candidate = materialCandidate(record);
    progress.before(action, candidate);
    const loopWarning = progress.failed(action, error.message, candidate);
    const result = {
      status: 'rejected',
      error: error.message,
      availableOperationIds: this.resolved.operations.map((operation) => operation.id),
      recovery:
        'No operation was queued. Use operations.list for captured agent capabilities; host-only verification IDs are unavailable. Observe pending work with its existing execution.wait requestId.',
      ...(loopWarning ? { loopWarning } : {}),
    };
    observe(root, record, 'operation.selection_rejected', result);
    save(root, record);
    return result;
  }

  /** Requires the requested activity to be allowed by the captured role. */
  private assertActivity(op: Operation, stage: string): void {
    const activities =
      stage === 'specification'
        ? ['research', 'documentation', 'testing']
        : stage === 'correction'
          ? ['implementation']
          : stage === 'planning'
            ? ['research']
            : [stage];
    if (!op.activities.some((a) => activities.includes(a)))
      throw new Error('Operation activity denied: ' + stage);
  }

  /** Validates tool request data before executing any operation. */
  private request(args: unknown): void {
    const { root, record } = this;
    record.operationCalls = Number(record.operationCalls) + 1;
    observe(root, record, 'operation.requested', { number: record.operationCalls, args });
    save(root, record);
  }

  /** Routes declared service lifecycle actions through the service manager. */
  private async service(name: string, op: Operation): Promise<unknown> {
    const signal = AbortSignal.any([this.signal, this.lifecycle.signal]);
    signal.throwIfAborted();
    const result = await new OperationExecution(
      this.root,
      this.record,
      signal,
      this.services,
    ).service(op, name);
    this.inspect();
    return result;
  }

  /** Records the authorized operation start and its execution context. */
  private begin(op: Operation): { combined: AbortSignal; start: number } {
    const cwd = realpathSync(join(this.record.workspace, op.cwd));
    const path = relative(this.record.workspace, cwd);
    if (path.startsWith('..') || path.startsWith('/'))
      throw new Error('Operation working directory escapes workspace');
    this.active = new AbortController();
    const combined = AbortSignal.any([this.signal, this.active.signal]),
      start = Date.now();
    this.record.currentOperation = op.id;
    observe(this.root, this.record, 'operation.started', {
      id: op.id,
      number: this.activeNumber,
      cwd,
    });
    save(this.root, this.record);
    return { combined, start };
  }

  /** Executes a declared finite operation and retains its command evidence. */
  private async finite(op: Operation) {
    const { combined, start } = this.begin(op);
    const outcome: { result?: CommandResult } = {};
    let artifacts: unknown[] = [];
    try {
      outcome.result = await this.execute(op, combined, outcome);
      const result = outcome.result;
      this.inspect();
      artifacts = op.artifacts.map((path) => this.artifact(path));
      const output = readDiagnosticExcerpt(result!.log).output;
      return {
        id: op.id,
        status: result!.exitCode === 0 ? 'passed' : 'failed',
        ...result,
        output,
        artifacts,
      };
    } finally {
      this.finish(op.id, start, outcome.result, artifacts);
    }
  }

  /** Runs the requested action through the configured execution boundary. */
  private async execute(
    op: Operation,
    signal: AbortSignal,
    outcome: { result?: CommandResult },
  ): Promise<CommandResult | undefined> {
    try {
      return await new OperationExecution(this.root, this.record, signal, this.services).run(
        op,
        'agent',
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'commandResult' in error)
        outcome.result = error.commandResult as CommandResult;
      if (
        signal.aborted ||
        !outcome.result ||
        !isObservedCommandFailure(error) ||
        error.operationId !== op.id
      )
        throw error;
      return outcome.result;
    }
  }

  /** Validates and records declared result artifacts produced by the operation. */
  private artifact(path: string) {
    return new OperationArtifacts(this.root, this.record).capture(path, String(this.activeNumber));
  }

  /** Finalizes the current lifecycle while preserving its recorded outcome. */
  private finish(
    id: string,
    start: number,
    result: CommandResult | undefined,
    artifacts: unknown[],
  ): void {
    const { root, record } = this;
    if (result) (record.operations as unknown[]).push({ id, ...result, artifacts });
    observe(root, record, 'operation.finished', {
      id,
      number: this.activeNumber,
      durationMs: Date.now() - start,
      result,
      artifacts,
    });
    delete record.currentOperation;
    this.active = undefined;
    save(root, record);
    this.inspect();
  }
}

function operationTools(): BridgeTool[] {
  const tools: BridgeTool[] = [
    {
      name: 'operations.list',
      description: 'List captured engineering operations and their fixed commands.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'operations.run',
      description:
        'Execute one declared operation by ID and receive actual output. Nonzero tests are evidence, not transport failures.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ];
  return [...tools, ...serviceTools()];
}

function serviceTools(): BridgeTool[] {
  const tools: BridgeTool[] = [];
  for (const action of ['start', 'status', 'logs', 'stop'])
    tools.push({
      name: 'services.' + action,
      description: 'Manage a declared local HTTP service lease: ' + action,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    });
  return tools;
}
