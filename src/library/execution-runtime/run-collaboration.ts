import { createHash } from 'node:crypto';
import { runDestination } from './run-destination.js';
import { join } from 'node:path';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import { ProviderStore } from '../coordination-store/provider-store.js';
import { githubHostCredential, GitHubUpstream } from '../operations/github-upstream.js';
import { SimulatedUpstream } from '../operations/simulated-upstream.js';
import { UpstreamExecution } from '../operations/upstream-execution.js';
import { UpstreamBridge } from '../operations/upstream-bridge.js';
import type { RunEnvironments } from './run-environments.js';

/** Binds tracking and steward collaboration to the host's captured environment and operation grants. */
export class RunCollaboration {
  private providerStore?: ProviderStore;

  private readonly target: string;

  /** Retains the existing run/assignment stores without granting a worker access to them. */
  constructor(
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
    private readonly environments: RunEnvironments,
    private readonly run: ExecutionRun,
    private readonly signal: AbortSignal,
  ) {
    this.target = run.environment ? runDestination(context, run.environment.mode) : '';
  }

  /** Creates tracking before engineering and records the provider receipt on its accountable run or assignment. */
  async tracking(assignment?: ExecutionAssignment): Promise<void> {
    if (!this.run.environment || (assignment?.data ?? this.run.data).trackingIssue) return;
    const identity = assignment?.id ?? this.run.id;
    const executor = this.executor(
      this.context.directorComponent ?? this.run.owners[0]!,
      assignment?.id,
    );
    const key = `${identity}:tracking`;
    const input = this.trackingInput(key, assignment);
    let result = await executor.execute(key, 'issue.create', this.target, input, this.signal);
    if (result.status === 'uncertain') result = await executor.recover(key, this.signal);
    if (result.status === 'prepared')
      result = await executor.execute(key, 'issue.create', this.target, input, this.signal);
    if (result.status !== 'completed')
      throw new Error('Tracking issue requires reconciliation: ' + key);
    if (assignment)
      this.store.updateAssignment(assignment.id, assignment.status, {
        trackingIssue: result.result,
      });
    else
      this.store.updateRun(this.run.id, this.store.run(this.run.id).status, {
        trackingIssue: result.result,
      });
  }

  /** Preserves the original tracking intent through director reconsideration and interrupted receipts. */
  private trackingInput(key: string, assignment?: ExecutionAssignment): Record<string, unknown> {
    const prior = this.environments.effects.effects().find((effect) => effect.id === key);
    return (
      prior?.input ?? {
        title: (assignment?.objective ?? this.run.objective).slice(0, 200),
        body: JSON.stringify({
          goal: assignment?.objective ?? this.run.objective,
          acceptance: assignment?.acceptance ?? this.run.data.direction,
          runId: this.run.id,
          assignmentId: assignment?.id,
          environment: this.run.environment,
        }),
      }
    );
  }

  /** Reconciles durable comments before projecting meaningful assignment state, never polling or model tokens. */
  async progress(): Promise<void> {
    if (!this.run.environment) return;
    const prefix = this.run.id + ':progress:';
    const receipts = await this.reconcileComments(prefix);
    for (const assignment of this.store.assignments(this.run.id)) {
      if (!['waiting', 'completed', 'blocked', 'rejected', 'failed'].includes(assignment.status))
        continue;
      const issue = (assignment.data.trackingIssue ??
        this.store.run(this.run.id).data.trackingIssue) as { issueId?: unknown } | undefined;
      if (
        !issue ||
        !this.grants(assignment.owner).some((grant) => grant.operation === 'issue.comment')
      )
        continue;
      const input = this.milestone(assignment, issue.issueId);
      const id = prefix + createHash('sha256').update(JSON.stringify(input)).digest('hex');
      if (!receipts.has(id)) await this.comment(assignment, id, input);
    }
  }

  /** Finishes retained intents first and returns receipts so unchanged observations create no new events. */
  private async reconcileComments(prefix: string): Promise<Set<string>> {
    const receipts = new Set<string>();
    for (const effect of this.environments.effects.effects()) {
      if (!effect.id.startsWith(prefix)) continue;
      if (effect.status !== 'completed')
        await this.comment(this.store.assignment(effect.assignmentId!), effect.id, effect.input);
      receipts.add(effect.id);
    }
    return receipts;
  }

  /** Labels verified delivery separately from waiting or failed intent using only authoritative identifiers. */
  private milestone(assignment: ExecutionAssignment, issueId: unknown): Record<string, unknown> {
    return {
      issueId,
      body: JSON.stringify(
        {
          assignmentId: assignment.id,
          owner: assignment.owner,
          milestone: assignment.status === 'completed' ? 'verified_delivery' : assignment.status,
          dependencies: assignment.dependencies,
          evidence: assignment.evidence,
        },
        null,
        2,
      ),
    };
  }

  /** Reuses original intent and reconciles uncertain effects before any retry or further engineering. */
  private async comment(
    assignment: ExecutionAssignment,
    id: string,
    input: Record<string, unknown>,
  ) {
    if (assignment.runId !== this.run.id)
      throw new Error('Comment assignment belongs to another run');
    const executor = this.executor(assignment.owner, assignment.id);
    let result = await executor.execute(id, 'issue.comment', this.target, input, this.signal);
    if (result.status === 'uncertain') result = await executor.recover(id, this.signal);
    if (result.status === 'prepared')
      result = await executor.execute(id, 'issue.comment', this.target, input, this.signal);
    if (result.status !== 'completed')
      throw new Error('Progress comment requires reconciliation: ' + id);
  }

  /** Provides only explicitly granted agent actions, with host-derived scope and destination. */
  bridge(assignment: ExecutionAssignment): UpstreamBridge | undefined {
    if (!this.run.environment) return undefined;
    const actions = this.grants(assignment.owner)
      .map((grant) => grant.operation)
      .filter(
        (action): action is 'issue.create' | 'issue.comment' =>
          action === 'issue.create' || action === 'issue.comment',
      );
    return new UpstreamBridge(
      this.executor(assignment.owner, assignment.id),
      this.target,
      `${this.run.environment.id}/${this.run.id}/${assignment.id}`,
      this.signal,
      actions,
    );
  }

  /** Releases provider connections once a direction or engineering activation has completed. */
  close(): void {
    this.providerStore?.close();
  }

  /** Resolves the same effect executor for real GitHub and isolated simulated providers. */
  private executor(owner: string, assignmentId?: string): UpstreamExecution {
    const environment = this.environments.effects.environment(this.run.environment!.id);
    const provider = this.provider();
    return new UpstreamExecution(this.environments.effects, provider, {
      environmentId: environment.id,
      runId: this.run.id,
      assignmentId,
      authorityDigest: executionIdentity(this.context),
      grants: this.grants(owner),
    });
  }

  /** Keeps credentials and simulated provider storage inside the host service boundary. */
  private provider() {
    const environment = this.environments.effects.environment(this.run.environment!.id);
    let provider;
    if (environment.mode === 'simulation') {
      this.providerStore ??= new ProviderStore(
        join(this.environments.directory, environment.id, 'provider.sqlite'),
      );
      provider = new SimulatedUpstream(
        environment.providerId,
        environment.id,
        this.target,
        this.providerStore,
      );
    } else
      provider = new GitHubUpstream(
        environment.providerId,
        environment.id,
        this.target,
        githubHostCredential,
      );
    return provider;
  }

  /** Derives mutation permissions from captured shared operation definitions, never caller-supplied grants. */
  private grants(owner: string) {
    const operations = this.context.catalog.components[owner]?.operationPlan?.agent ?? [];
    return operations
      .filter((op) => op.kind === 'upstream')
      .map((op) => ({
        operation: op.action,
        target: this.target,
        definitionDigest: op.definitionDigest!,
      }));
  }
}
