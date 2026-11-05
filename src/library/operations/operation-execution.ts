import { PreparedDependencies } from './prepared-dependencies.js';
import { observe } from '../report/timeline.js';
import { OperationEvidence } from './operation-evidence.js';
import { ServiceManager } from './services.js';
import type { SourceConfinement } from './confinement.js';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { targetCommand } from '../architecture/bindings.js';
import type { RecordData } from '../workspace/state.js';
import { OperationConfinement } from './operation-confinement.js';
import { operationEnvironment } from './environment.js';
import { OperationCheckpoint, type OperationStep } from './operation-checkpoint.js';
import type { Operation } from './operations.js';
import { execute, type CommandResult } from './process.js';

/** Executes captured finite operations through source confinement and the existing process supervisor. */
export class OperationExecution {
  private readonly evidence: OperationEvidence;

  /** Binds operation evidence and cancellation to the active host-owned run record. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
    private readonly signal: AbortSignal,
    private readonly services?: ServiceManager,
  ) {
    this.evidence = new OperationEvidence(root, record, signal);
  }

  /** Executes a fresh checkpoint, including required preparation, for a single requested operation. */
  async run(op: Operation, purpose: string): Promise<CommandResult> {
    const results = await this.checkpoint([op], purpose);
    const result = results.at(-1);
    if (!result) throw new Error(`Operation has no applicable test suites: ${op.id}`);
    return result;
  }

  /** Executes the fully validated dependency order once, without reusing evidence across checkpoints. */
  async checkpoint(operations: Operation[], purpose: string): Promise<CommandResult[]> {
    return this.steps(operations.map((operation) => ({ operation, purpose })));
  }

  /** Shares prerequisite ordering and deduplication across lifecycle usages in one host checkpoint. */
  async steps(steps: OperationStep[]): Promise<CommandResult[]> {
    this.evidence.assertSettled();
    this.signal.throwIfAborted();
    const checkpoint = new OperationCheckpoint(this.record);
    const ordered = checkpoint.resolve(steps);
    for (const selection of checkpoint.notApplicable)
      observe(this.root, this.record, 'operation.not_applicable', selection);
    const results: CommandResult[] = [];
    for (const step of ordered)
      results.push(
        await new PreparedDependencies(this.root, this.record).run(step.operation, () =>
          this.invoke(step.operation, step.purpose),
        ),
      );
    return results;
  }

  /** Records intent before dispatch and keeps agent use distinct from required checkpoint evidence. */
  private async invoke(op: Operation, purpose: string): Promise<CommandResult> {
    this.signal.throwIfAborted();
    if (op.kind === 'http') return this.http(op, purpose);
    if (op.kind !== 'command') throw new Error('Finite operation required');
    const adapter = await new OperationConfinement(this.root, this.record, this.signal).prepare(op);
    return this.evidence.run(op, purpose, (id) => this.command(op, adapter, id));
  }

  /** Starts a captured service only after finite preparation, and retains every explicit lifecycle action. */
  async service(op: Operation, action: string): Promise<unknown> {
    if (!this.services) throw new Error('Managed service context required');
    const plan = new OperationCheckpoint(this.record);
    op = plan.service(op);
    if (action === 'services.start')
      await this.checkpoint(plan.prerequisites(op), 'agent-prerequisite');
    return this.control(op, action, action, this.services);
  }

  /** Gives required host HTTP verification a fresh owned lease and always verifies its shutdown. */
  private async http(
    op: Extract<Operation, { kind: 'http' }>,
    purpose: string,
  ): Promise<CommandResult> {
    if (this.services) return this.request(op, purpose, this.services);
    const service = new OperationCheckpoint(this.record).serviceFor(op);
    const manager = new ServiceManager(this.root, this.record, this.signal);
    await this.control(service, 'services.start', purpose + '-service-start', manager);
    try {
      return await this.request(op, purpose, manager);
    } finally {
      await this.control(service, 'services.stop', purpose + '-service-stop', manager);
    }
  }

  /** Preserves observed HTTP mismatches as failed command evidence, separate from unavailable transport. */
  private request(op: Operation, purpose: string, manager: ServiceManager): Promise<CommandResult> {
    return this.evidence.run(op, purpose, async (id) => {
      const log = join(this.root, 'runs', this.record.id, `invocation-${id}.log`);
      const result = await manager.check(op, log, this.signal);
      if (result.exitCode !== 0)
        throw Object.assign(new Error(`Command failed (${result.exitCode}): HTTP GET`), {
          commandResult: result,
          observedExitFailure: true,
          operationId: op.id,
        });
      return result;
    });
  }

  /** Supervises lifecycle actions through the shared invocation ledger without weakening cleanup cancellation. */
  private async control(
    op: Operation,
    action: string,
    purpose: string,
    manager: ServiceManager,
  ): Promise<unknown> {
    if (action !== 'services.stop') this.signal.throwIfAborted();
    if (action === 'services.start')
      await new OperationConfinement(this.root, this.record, this.signal).prepare(op);
    return this.evidence.run(
      op,
      purpose,
      () => this.dispatchService(op, action, manager),
      action === 'services.stop',
    );
  }

  /** Applies one service action while preserving identity checks even when the listener is already gone. */
  private async dispatchService(op: Operation, action: string, manager: ServiceManager) {
    switch (action) {
      case 'services.start':
        return manager.start(op);
      case 'services.status':
        return manager.status(op.id);
      case 'services.logs':
        return manager.logs(op.id);
      case 'services.stop':
        manager.lease(op.id);
        await manager.stop();
        return manager.lease(op.id);
      default:
        throw new Error('Unknown service action');
    }
  }

  /** Attaches the declared operation and raw evidence location without masking cancellation or uncertainty. */
  private failure(op: Operation, error: unknown): never {
    if (!error || typeof error !== 'object' || !('commandResult' in error)) throw error;
    const result = error.commandResult as CommandResult;
    throw Object.assign(
      new Error(`Operation ${op.id}: ${String(error)}; evidence: ${result.log}`, { cause: error }),
      {
        commandResult: result,
        operationId: op.id,
        observedExitFailure: 'observedExitFailure' in error && error.observedExitFailure === true,
      },
    );
  }

  /** Sends resolved argv through the same confined process supervisor for every invocation purpose. */
  private async command(
    op: Extract<Operation, { command: string }>,
    adapter: SourceConfinement,
    id: string,
  ): Promise<CommandResult> {
    const command = adapter.command(
      targetCommand(this.record, op),
      join(this.record.workspace, op.cwd),
      operationEnvironment(this.record).PATH,
    );
    const result = await execute(
      command,
      realpathSync(join(this.record.workspace, op.cwd)),
      join(this.root, 'runs', this.record.id, `invocation-${id}.log`),
      this.signal,
      {
        env: adapter.environment(operationEnvironment(this.record)),
        fileOutput: true,
        stdout: join(this.root, 'runs', this.record.id, `invocation-${id}.stdout`),
        processScope: true,
      },
    ).catch((error) => this.failure(op, error));
    return { ...result, command: op.command, args: op.args };
  }
}
