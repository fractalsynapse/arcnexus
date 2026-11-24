import { reconcileHosted } from './reconcile.js';
import { subscribeWorkflowRequests } from './workflow-notices.js';
import type { Client } from 'pg';

const store = 'arcnexus_coordination.workflow_requests';
const columns = 'id, request, revision, state, execution, gate, outcome';

export interface WorkflowGate {
  id: string;
  question: string;
}

export interface WorkflowReceipt {
  id: string;
  request: unknown;
  revision: string;
  state: 'queued' | 'running' | 'waiting' | 'finished';
  execution: string | null;
  gate: WorkflowGate | null;
  outcome: unknown;
}

const cancelledOutcome = { kind: 'cancelled', reason: 'Cancelled by operator', evidence: [] };

type Caller = { remote: string; principal: string };
type Worker = { remote: string; worker: string };

/** Persist one authorized command position and its operator answer per project. */
export class WorkflowRequests {
  /** Use the same Coordination database as the project writer. */
  constructor(private readonly database: Client) {}

  /** Subscribe to changes for one trusted project assignment. */
  watch(remote: string | readonly string[], signal: AbortSignal) {
    return subscribeWorkflowRequests(this.database, remote, signal);
  }

  /** Admit one request and return exact duplicate submissions idempotently. */
  async submit(caller: Caller, id: string, request: unknown, revision: string) {
    const content = JSON.stringify(request);
    const values = [caller.remote, caller.principal, id, content, revision];
    const entered = await this.database.query<WorkflowReceipt>(
      `
      INSERT INTO ${store} (project,principal,id,request,revision,state)
      SELECT $1,$2,$3,$4::jsonb,$5,'queued'
      FROM arcnexus_coordination.hosted_projects WHERE project=$1
        AND NOT EXISTS (
          SELECT 1 FROM arcnexus_coordination.runs WHERE project=$1 AND active=1
        )
      ON CONFLICT DO NOTHING RETURNING ${columns}
      `,
      values,
    );
    if (entered.rows[0]) return entered.rows[0];
    const existing = await this.database.query<WorkflowReceipt>(
      `SELECT ${columns} FROM ${store} WHERE project=$1 AND principal=$2 AND id=$3 AND request=$4::jsonb`,
      values.slice(0, 4),
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
    const { rows } = await this.database.query<{ revision: string }>(
      `SELECT revision FROM ${store} WHERE project=$1 AND state IN ('queued','running')`,
      [remote],
    );
    return rows[0]?.revision;
  }

  /** Transfer the pending request to the trusted Host assigned to this project. */
  async claim(owner: Worker & { revision: string }) {
    const { rows } = await this.database.query<WorkflowReceipt & { reply: string | null }>(
      `UPDATE ${store} SET state='running',worker=$2
       WHERE project=$1 AND revision=$3 AND state='queued' AND NOT cancellation RETURNING ${columns},reply`,
      [owner.remote, owner.worker, owner.revision],
    );
    return rows[0];
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
      `SELECT ${columns} FROM ${store} WHERE project=$1 AND worker=$2 AND state='running'`,
      [owner.remote, owner.worker],
    );
    const request = rows[0];
    if (!request || !(await confirmStopped(owner.worker))) return false;
    const retired = await reconcileHosted(
      this.database,
      owner.remote,
      (worker) => worker === owner.worker,
    );
    const terminal = !retired && (await this.recoveredOutcome(owner, request));
    if (terminal) await this.settle(owner, request.id, terminal);
    else await this.resume(owner, request.id);
    return true;
  }

  /** Recover an already recorded terminal result after loss between journal and receipt commits. */
  private async recoveredOutcome(owner: Worker, request: WorkflowReceipt) {
    if (!request.execution) return;
    const command = request.request as { command: string; goal?: string };
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
    if (command.command === 'task_run' && command.goal === undefined)
      throw new Error('The stopped round requires trusted reconciliation of its aggregate result');
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
