import { acceptPlan, updatePlan, PlanValidationError, type Plan } from '../assignment/plan.js';
import { ProgressObserver } from '../report/progress.js';
import { save } from '../workspace/state.js';
import { observe } from '../report/timeline.js';
import { openBridge, type BridgeTool } from './bridge.js';
import type { CodexConfiguration } from './codex-configuration.js';

const planTool: BridgeTool = {
  name: 'plan.update',
  description:
    'Update steward checklist items in plan.items with the evidence supporting each claim. Buckets run in plan order: an item in a later activity waits while an earlier activity holds items that are not terminal. hostChecks are recorded by the host. Every claim is an agent assertion until verified.',
  inputSchema: {
    type: 'object',
    properties: {
      updates: { type: 'array', items: { type: 'object' } },
      revision: { type: 'object' },
      reason: { type: 'string' },
    },
    additionalProperties: false,
  },
};

/** Exposes only declared operation and checklist tools through the MCP adapter. */
export class CodexTools {
  error: unknown;

  readonly controller = new AbortController();

  private bridge: Awaited<ReturnType<typeof openBridge>> | undefined;

  /** Retains captured SDK configuration for probe and operation-bridge setup. */
  constructor(private readonly configuration: CodexConfiguration) {}

  /** Returns the cancellation signal governing the current tool scope. */
  get signal(): AbortSignal {
    return AbortSignal.any([this.configuration.input.signal, this.controller.signal]);
  }

  /** Creates the MCP transport exposing the parent-authorized capability set. */
  async open(): Promise<object> {
    const { operations, responseContract } = this.configuration.input;
    this.bridge = await openBridge(
      [...(operations?.tools ?? []), ...(responseContract ? [] : [planTool])],
      (name, args) => this.call(name, args),
      () => operations?.disconnect(),
    );
    return this.bridge.config as object;
  }

  /** Routes tool calls through pending-call handling while preserving cancellation and evidence. */
  private async call(name: string, args: unknown): Promise<unknown> {
    const { operations } = this.configuration.input;
    try {
      this.signal.throwIfAborted();
      if (name !== 'plan.update') {
        if (!operations) throw new Error('Operations unavailable');
        return await operations.call(name, args);
      }
      if (this.configuration.input.responseContract)
        throw new Error('Initializer has no checklist authority');
      return this.update(args);
    } catch (error) {
      if (name === 'plan.update' && error instanceof PlanValidationError)
        return this.rejectPlan(error);
      return this.fail(name, error);
    }
  }

  /** Returns atomic content rejection while retaining loop diagnosis; no command or model turn is replayed. */
  private rejectPlan(error: PlanValidationError): never {
    const { root, record } = this.configuration.input;
    let warning: string | undefined;
    try {
      this.signal.throwIfAborted();
      const observer = new ProgressObserver(root, record);
      const action = { tool: 'plan.update', stage: record.stage };
      const candidate = JSON.stringify(
        (record.plan as Plan).items.map(({ id, status, dependencies }) => ({
          id,
          status,
          dependencies,
        })),
      );
      observer.before(action, candidate);
      warning = observer.failed(action, error.message, candidate);
      observe(root, record, 'tool.rejected', { name: 'plan.update', error: error.message });
      save(root, record);
    } catch (failure) {
      return this.fail('plan.update', failure);
    }
    throw new PlanValidationError(warning ? `${error.message}\n${warning}` : error);
  }

  /** Aborts on authority, persistence, cancellation or uncertain operation failures. */
  private fail(name: string, error: unknown): never {
    const { root, record } = this.configuration.input;
    this.error = error;
    this.controller.abort(error);
    observe(root, record, 'tool.denied', { name, error: String(error) });
    throw error;
  }

  /** Applies a bounded checklist update through the parent-owned plan contract. */
  private update(args: unknown) {
    const { root, record } = this.configuration.input;
    record.planUpdateCalls = Number(record.planUpdateCalls ?? 0) + 1;
    if (record.stage === 'planning') throw new Error('Plan updates require an accepted plan');
    if (
      !args ||
      typeof args !== 'object' ||
      Object.keys(args).some((k) => !['updates', 'revision', 'reason'].includes(k))
    )
      throw new Error('Invalid plan update arguments');
    const input = args as { updates?: unknown; revision?: unknown; reason?: string };
    if (input.revision) {
      if (input.updates || typeof input.reason !== 'string' || !input.reason.trim())
        throw new Error('Plan revision requires reason and excludes progress updates');
      acceptPlan(root, record, input.revision, input.reason);
    } else updatePlan(root, record, input.updates);
    return { status: 'recorded', plan: record.plan };
  }

  /** Releases resources owned by this instance. */
  async close(): Promise<void> {
    const { operations } = this.configuration.input;
    operations?.disconnect();
    try {
      await this.bridge?.close();
    } finally {
      await operations?.close();
    }
  }
}
