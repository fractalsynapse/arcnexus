import type { ObjectiveReview } from '../../../planner/src/objective-review.js';
import { finishRetainedRound } from './retained-round.js';
import { reconcileHosted } from './reconcile.js';
import { workflowReceiptChannel } from './workflow-receipts-schema.js';
import { subscribeWorkflowRequests } from './workflow-notices.js';
import type { RuntimeImage } from '../../../foundation/src/runtime-image.js';
import type { Client } from 'pg';

const store = 'arcnexus_coordination.workflow_requests';
const columns = 'id, request, revision, runtime, state, execution, gate, outcome';

export interface WorkflowGate {
  id: string;
  question: string;
  review?: ObjectiveReview;
}

export interface WorkflowReceipt {
  id: string;
  request: unknown;
  revision: string;
  runtime: RuntimeImage | null;
  state: 'queued' | 'running' | 'waiting' | 'finished';
  execution: string | null;
  gate: WorkflowGate | null;
  outcome: unknown;
}

const cancelledOutcome = { kind: 'cancelled', reason: 'Cancelled by operator', evidence: [] };

type Caller = { remote: string; principal: string };
type Worker = {
  remote: string;
  worker: string;
  runtime?: RuntimeImage;
  documentationOnly?: boolean;
};

/** Persist one authorized command position and its operator answer per project. */
export class WorkflowRequests {
  /** Use the same Coordination database as the project writer. */
  constructor(private readonly database: Client) {}

  /** Subscribe to changes for one trusted project assignment. */
  watch(remote: string | readonly string[], signal: AbortSignal) {
    return subscribeWorkflowRequests(this.database, remote, signal);
  }

  /** Follow committed receipt changes independently of launcher wakeups. */
  watchReceipts(remote: string, signal: AbortSignal) {
    return subscribeWorkflowRequests(this.database, remote, signal, workflowReceiptChannel);
  }

  /** Recover the operator's active command or their most recently submitted result. */
  async current(caller: Caller) {
    const { rows } = await this.database.query<WorkflowReceipt>(
      `SELECT ${columns} FROM ${store} WHERE project=$1 AND principal=$2
       ORDER BY (state <> 'finished') DESC, ordinal DESC FETCH FIRST ROW ONLY`,
      [caller.remote, caller.principal],
    );
    return rows[0];
  }

  /** Admit one request and return exact duplicate submissions idempotently. */
  async submit(
    caller: Caller,
    id: string,
    request: unknown,
    revision: string,
    documentationOnly = false,
  ) {
    const content = JSON.stringify(request);
    const values = [caller.remote, caller.principal, id, content, revision, documentationOnly];
    const entered = await this.database.query<WorkflowReceipt>(
      `
      INSERT INTO ${store} (project,principal,id,request,revision,state,documentation_only)
      SELECT $1,$2,$3,$4::jsonb,$5,'queued',$6
      WHERE ($6 OR EXISTS (SELECT 1 FROM arcnexus_coordination.hosted_projects WHERE project=$1))
        AND NOT EXISTS (
          SELECT 1 FROM arcnexus_coordination.runs WHERE project=$1 AND active=1
        )
      ON CONFLICT DO NOTHING RETURNING ${columns}
      `,
      values,
    );
    if (entered.rows[0]) return entered.rows[0];
    const existing = await this.database.query<WorkflowReceipt>(
      `SELECT ${columns} FROM ${store} WHERE project=$1 AND principal=$2 AND id=$3 AND request=$4::jsonb AND documentation_only=$5`,
      [...values.slice(0, 4), documentationOnly],
    );
    if (!existing.rows[0])
      throw new Error('Workflow request is unavailable or the project is busy');
    return existing.rows[0];
  }

  /** Read a receipt in the original initiating operator's scope. */
  async read(caller: Caller, id: string) {
    const { rows } = await this.database.query<WorkflowReceipt>(
      `SELECT ${columns} FROM ${store} WHERE project=$1 AND principal=$2 AND id=$3`,
      [caller.remote, caller.principal, id],
    );
    if (!rows[0]) throw new Error('Workflow request unavailable');
    return rows[0];
  }

  /** Record a response only for the exact open approval and then make the request runnable. */
  async answer(caller: Caller, id: string, gate: string, answer: string) {
    const { rows } = await this.database.query<WorkflowReceipt>(
      `UPDATE ${store} SET state='queued', reply=$5
       WHERE project=$1 AND principal=$2 AND id=$3 AND state='waiting' AND gate->>'id'=$4
       RETURNING ${columns}`,
      [caller.remote, caller.principal, id, gate, answer],
    );
    if (!rows[0]) throw new Error('Workflow approval is no longer open');
    return rows[0];
  }

  /** Return the pinned revision only when a project needs an assigned Host. */
  async loadAssignment(remote: string) {
    const { rows } = await this.database.query<{ revision: string; documentationOnly: boolean }>(
      `SELECT revision, documentation_only AS "documentationOnly" FROM ${store}
       WHERE project=$1 AND state IN ('queued','running')`,
      [remote],
    );
    const assignment = rows[0];
    return (
      assignment && {
        revision: assignment.revision,
        ...(assignment.documentationOnly && { documentationOnly: true as const }),
      }
    );
  }

  /** Transfer the pending request to a Host with the verified revision and retained image. */
  async claim(owner: Worker & { revision: string }) {
    const runtime = owner.runtime ? JSON.stringify(owner.runtime) : null;
    const { rows } = await this.database.query<WorkflowReceipt & { reply: string | null }>(
      `UPDATE ${store} SET state='running',worker=$2,runtime=COALESCE(runtime,$4::jsonb)
       WHERE project=$1 AND revision=$3 AND state='queued' AND NOT cancellation
         AND documentation_only=$5 AND (runtime IS NULL OR runtime=$4::jsonb) RETURNING ${columns},reply`,
      [owner.remote, owner.worker, owner.revision, runtime, owner.documentationOnly ?? false],
    );
    if (!rows[0]) await this.verifyQueuedImage(owner, runtime);
    return rows[0];
  }

  /** Name the retained prerequisite when the queued command needs a different image. */
  private async verifyQueuedImage(owner: Worker & { revision: string }, runtime: string | null) {
    const { rows } = await this.database.query<{ runtime: RuntimeImage }>(
      `SELECT runtime FROM ${store} WHERE project=$1 AND revision=$2 AND state='queued'
         AND documentation_only=$4 AND runtime IS NOT NULL AND runtime IS DISTINCT FROM $3::jsonb`,
      [owner.remote, owner.revision, runtime, owner.documentationOnly ?? false],
    );
    if (rows[0]) throw imageUnavailable(rows[0].runtime);
  }

  /** Request cancellation while retaining the canonical active run's ownership. */
  async cancel(caller: Caller, id: string) {
    const cancelled = JSON.stringify(cancelledOutcome);
    const { rows } = await this.database.query<WorkflowReceipt>(
      `UPDATE ${store}
       SET cancellation=true,state=CASE WHEN state='running' THEN state ELSE 'finished' END,
           outcome=CASE WHEN state='running' THEN outcome ELSE $4::jsonb END,
           gate=CASE WHEN state='running' THEN gate ELSE NULL END,
           reply=CASE WHEN state='running' THEN reply ELSE NULL END
       WHERE project=$1 AND principal=$2 AND id=$3 AND state <> 'finished' RETURNING ${columns}`,
      [caller.remote, caller.principal, id, cancelled],
    );
    return rows[0] ?? this.read(caller, id);
  }

  /** Check an operator cancellation using the exact current Host lease. */
  async cancelled(owner: Worker, id: string) {
    const { rows } = await this.database.query<{ cancellation: boolean }>(
      `SELECT cancellation FROM ${store} WHERE project=$1 AND worker=$2 AND id=$3 AND state='running'`,
      [owner.remote, owner.worker, id],
    );
    return rows[0]?.cancellation ?? false;
  }

  /** Reconcile the departed assigned worker before consuming its retained command. */
  async recover(owner: Worker, confirmStopped: (worker: string) => boolean | Promise<boolean>) {
    const { rows } = await this.database.query<WorkflowReceipt>(
      `SELECT ${columns} FROM ${store} WHERE project=$1 AND worker=$2 AND state='running' AND documentation_only=$3`,
      [owner.remote, owner.worker, owner.documentationOnly ?? false],
    );
    const request = rows[0];
    if (!request || !(await confirmStopped(owner.worker))) return false;
    if (
      request.runtime &&
      (request.runtime.image !== owner.runtime?.image ||
        request.runtime.base !== owner.runtime.base)
    )
      throw imageUnavailable(request.runtime);
    const retired = await reconcileHosted(
      this.database,
      owner.remote,
      (worker) => worker === owner.worker,
      owner.documentationOnly,
    );
    if (!retired && (await finishRetainedRound(this.database, owner, request.id))) return true;
    const terminal = !retired && (await this.recoveredOutcome(owner, request));
    if (terminal) await this.settle(owner, request.id, terminal);
    else await this.resume(owner, request.id);
    return true;
  }

  /** Recover an already recorded terminal result after loss between journal and receipt commits. */
  private async recoveredOutcome(owner: Worker, request: WorkflowReceipt) {
    if (!request.execution) return;
    const command = request.request as { command: string; goal?: string };
    if (command.command === 'task_run' && command.goal === undefined) {
      const { rows } = await this.database.query(
        `SELECT id FROM arcnexus_coordination.rounds WHERE project=$1 AND namespace='task' AND finished=0`,
        [owner.remote],
      );
      if (rows.length) return;
      throw new Error('The stopped round requires trusted reconciliation of its aggregate result');
    }
    const { rows } = await this.database.query<{ outcome: { kind: string } }>(
      `SELECT e.content::jsonb->'outcome' AS outcome
       FROM arcnexus_coordination.runs r JOIN arcnexus_coordination.events e
         ON e.project=r.project AND e.run=r.id
       WHERE r.project=$1 AND r.task_id=$2 AND r.parent_id IS NULL AND r.active=0
         AND e.content::jsonb ? 'outcome' AND r.lease::jsonb->>'worker'=$3
       ORDER BY e.id DESC FETCH FIRST ROW ONLY`,
      [owner.remote, request.execution, owner.worker],
    );
    const outcome = rows[0]?.outcome;
    if (!outcome || ['blocked', 'cancelled'].includes(outcome.kind)) return;
    return outcome;
  }

  /** Resume the exact command and answer or finish a retained operator cancellation. */
  private async resume(owner: Worker, id: string) {
    await this.database.query(
      `UPDATE ${store}
       SET worker=NULL,state=CASE WHEN cancellation THEN 'finished' ELSE 'queued' END,
           outcome=CASE WHEN cancellation THEN $4::jsonb ELSE outcome END,
           gate=CASE WHEN cancellation THEN NULL ELSE gate END,
           reply=CASE WHEN cancellation THEN NULL ELSE reply END
       WHERE project=$1 AND worker=$2 AND id=$3 AND state='running'`,
      [owner.remote, owner.worker, id, JSON.stringify(cancelledOutcome)],
    );
  }

  /** Checkpoint the accepted round before closing the captured inventory. */
  async completeRound(
    owner: Worker,
    id: string,
    result: { kind: 'round'; completed: boolean; round: number },
  ) {
    if (!result.completed) throw new Error('Cannot checkpoint an unfinished round');
    const saved = await this.database.query(
      `UPDATE ${store} SET outcome=$4::jsonb
       WHERE project=$1 AND worker=$2 AND id=$3 AND state='running'
         AND request->>'command'='task_run' AND NOT request ? 'goal'`,
      [owner.remote, owner.worker, id, JSON.stringify(result)],
    );
    if (!saved.rowCount) throw new Error('Workflow request ownership was lost');
  }

  /** Publish the first admitted logical execution for a running invocation. */
  async bind(owner: Worker, id: string, execution: string) {
    await this.database.query(
      `UPDATE ${store} SET execution=COALESCE(execution,$4)
       WHERE project=$1 AND worker=$2 AND id=$3 AND state='running'`,
      [owner.remote, owner.worker, id, execution],
    );
  }

  /** Retain the exact gate for a held result or close a terminal request. */
  async settle(owner: Worker, id: string, outcome: unknown, gate?: WorkflowGate) {
    const result = await this.database.query(
      `UPDATE ${store} SET state=$4,outcome=$5::jsonb,gate=$6::jsonb,worker=NULL,reply=NULL
       WHERE project=$1 AND worker=$2 AND id=$3 AND state='running'`,
      [
        owner.remote,
        owner.worker,
        id,
        gate ? 'waiting' : 'finished',
        JSON.stringify(outcome),
        gate ? JSON.stringify(gate) : null,
      ],
    );
    if (!result.rowCount) throw new Error('Workflow request ownership was lost');
  }
}

function imageUnavailable(runtime: RuntimeImage) {
  return new Error('The workflow requires its pinned Host image ' + runtime.image);
}
