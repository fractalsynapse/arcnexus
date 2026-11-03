import type { UpstreamBridge } from '../operations/upstream-bridge.js';
import { validateContinuation } from './continuation.js';
import { initializeExecution, type InitializationEvidence } from '../task-intake/initializer.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { prepareCapabilities } from '../operations/probes.js';
import type { AgentResult } from '../steward/codex.js';
import { save, type RecordData } from '../workspace/state.js';
import { assertIdentity, assertOutputs, prepareWorkspace } from '../workspace/workspace.js';
import { SessionState } from './session-state.js';
import { SessionTurn } from './session-turn.js';
import { SessionVerification } from './session-verification.js';
import { SessionWorkflow } from './session-workflow.js';

export interface StewardCheckpoint {
  schemaVersion: 1;
  authorityHash: string;
  threadId: unknown;
  activity: unknown;
  status: string;
  plan: unknown;
  frozenTests: unknown;
  regression: unknown;
  implementationAttempts: unknown;
  operationCalls: unknown;
  planUpdateCalls: unknown;
  activeMs: number;
  candidateDigest: string;
  turns: unknown;
  usage: unknown;
}

/** Retains one Codex thread across planned, corrective and handoff continuations. */
export class StewardSession {
  private state?: SessionState;

  private turns?: SessionTurn;

  private verification?: SessionVerification;

  /** Retains captured execution inputs and accepted initialization without starting inference. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
    private readonly id: string,
    private readonly objective: string,
    private readonly model: string,
    private readonly executable: string,
    private readonly signal: AbortSignal,
    private readonly initialization?: InitializationEvidence,
    private readonly collaboration?: UpstreamBridge,
  ) {}

  /** Runs durable stages until completion or an inbox yield; recipients remain the scheduler’s responsibility. */
  async run(): Promise<void> {
    while (this.record.nextStage !== 'finished') {
      await this.step();
      if (this.record.status === 'blocked') throw new Error(String(this.record.error));
      if (this.record.pendingRequests || this.record.pendingInboxActions) return;
    }
  }

  /** Advances one durable stage, preserving continuation when an owner request yields. */
  async step(): Promise<void> {
    this.record.generalExecution = true;
    await this.initializeSession();
    await new SessionWorkflow(this.state!, this.turns!, this.verification!).step();
  }

  /** Reconstructs stage services and establishes prerequisites only on the initial activation. */
  private async initializeSession(): Promise<void> {
    const { root, record, id, objective, model, executable, signal } = this;
    const retained = Boolean(record.continuation);
    if (retained) validateContinuation(root, record);
    this.state = new SessionState({
      root,
      record,
      id,
      objective,
      model,
      executable,
      signal,
      collaboration: this.collaboration,
    });
    if (!retained) await this.prepare();
    if (this.initialization) this.acceptInitialization();
    if (!retained && !this.initialization && !record.directionAccepted)
      await initializeExecution({
        root,
        record,
        resolved: this.state.resolved,
        owners: [id],
        executable,
        signal,
      });
    this.verification = new SessionVerification(this.state);
    this.turns = new SessionTurn(this.state);
  }

  /** Answers an inbox clarification without advancing or resetting the suspended engineering stage. */
  async reply(instructions: string): Promise<AgentResult> {
    this.record.generalExecution = true;
    await this.initializeSession();
    this.record.safeCheckpoint = false;
    save(this.root, this.record);
    try {
      const result = await this.controlTurn(instructions);
      this.record.safeCheckpoint = true;
      return result;
    } finally {
      this.captureCheckpoint();
      save(this.root, this.record);
    }
  }

  /** Requires a valid ready result before allowing participant inference. */
  private acceptInitialization(): void {
    if (
      this.initialization!.authorityHash !== this.state!.resolved.digest ||
      this.initialization!.result?.status !== 'ready'
    )
      throw new Error('Accepted initialization does not match assignment authority');
    this.record.initialization = this.initialization;
  }

  /** Runs a read-only coordination turn on the retained assignment thread. */
  async controlTurn(instructions: string): Promise<AgentResult> {
    if (!this.turns) throw new Error('Session not active');
    return this.turns.run('coordination', instructions, true, 'coordination');
  }

  /** Checks the final candidate rather than relying on a steward’s completion claim. */
  async verifyFinal(): Promise<void> {
    if (!this.verification) throw new Error('Session not initialized');
    await this.verification.final();
  }

  /** Persists continuation state before control can pass to another owner. */
  captureCheckpoint(): void {
    if (!this.state) throw new Error('Session not initialized');
    this.state.checkpoint();
  }

  /** Establishes the prerequisites required by the subsequent execution. */
  private async prepare(): Promise<void> {
    await prepareWorkspace(this.root, this.record, this.signal);
    if (existsSync(join(this.record.workspace, '.codex/config.toml')))
      throw new Error('Setup introduced Codex configuration');
    await prepareCapabilities(this.root, this.record, this.signal);
    await this.state!.checks(this.state!.component.verification, 'baseline');
    assertIdentity(this.record);
    assertOutputs(this.record.workspace, this.record.environment);
  }
}

export async function runSteward(
  root: string,
  record: RecordData,
  id: string,
  objective: string,
  model: string,
  executable: string,
  signal: AbortSignal,
  initialization?: InitializationEvidence,
): Promise<void> {
  await new StewardSession(
    root,
    record,
    id,
    objective,
    model,
    executable,
    signal,
    initialization,
  ).run();
}

export { validateContinuation } from './continuation.js';

export { recoverAssignmentEdits } from './edit-recovery.js';
