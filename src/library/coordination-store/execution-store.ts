import { ContributionDelivery } from './contribution-delivery.js';
import { ContributionGroups } from './contribution-groups.js';
import { dependencySatisfied } from './execution-types.js';
import { RequiredWork } from './required-work.js';
import { AssignmentReplacements } from './assignment-replacements.js';
import { AssignmentAdmission } from './assignment-admission.js';
import {
  assertNotSelfLink,
  repeatedRequestAssignment,
  requestMilestones,
  sharedRequestProblem,
  storeInitialProposal,
} from './request-proposal.js';
import { CandidatePointers } from './candidate-pointers.js';
import { RunRecords } from './run-records.js';
import { InboxDecisions, type InboxDecision } from './inbox-decisions.js';
import { randomUUID } from 'node:crypto';
import { ExecutionDatabase } from './execution-database.js';
import { DirectionAdmission } from './direction-admission.js';
import type {
  PreparedContribution,
  AssignmentStatus,
  AssignmentContinuation,
  DirectionAdmissionTransition,
  DirectionProposal,
  ExecutionAssignment,
  ExecutionRun,
  InboxRequest,
  OwnerRequest,
  RunMode,
  RunEnvironment,
  RunStatus,
} from './execution-types.js';

export { ExecutionLease } from './execution-lease.js';

export { requestProposal, sharedRequestProblem } from './request-proposal.js';

/** Persists assignment accountability, inbox identities and dependency readiness atomically. */
export class ExecutionStore {
  private readonly db: ExecutionDatabase;

  private readonly replacements: AssignmentReplacements;

  private readonly admission: AssignmentAdmission;

  private readonly directionAdmission: DirectionAdmission;

  /** Opens a new or retained general execution store without reading legacy workdays. */
  constructor(path: string, readOnly = false) {
    this.db = new ExecutionDatabase(path, readOnly);
    this.replacements = new AssignmentReplacements(this.db);
    this.admission = new AssignmentAdmission(this.db);
    this.directionAdmission = new DirectionAdmission(
      this.db,
      this.admission,
      this.replacements,
      this.restoreContinuations.bind(this),
    );
  }

  /** Projects related records from one consistent read transaction. */
  snapshot<T>(read: () => T): T {
    return this.db.snapshot(read);
  }

  /** Captures the eligible owners and goal for one run. */
  createRun(
    mode: RunMode,
    owners: string[],
    objective: string,
    environment?: RunEnvironment,
  ): ExecutionRun {
    return new RunRecords(this.db).create(mode, owners, objective, environment);
  }

  /** Returns the captured run, including its mutable lifecycle state. */
  run(id: string): ExecutionRun {
    return this.db.get('run', id);
  }

  /** Lists runs in submission order. */
  runs(): ExecutionRun[] {
    return this.db.all('run');
  }

  /** Persists lifecycle and policy state together. */
  updateRun(id: string, status: RunStatus, data: Record<string, unknown> = {}): void {
    this.db.transaction('run.updated', { id, status }, () => {
      const run = this.run(id);
      this.db.put('run', { ...run, status, data: { ...run.data, ...data } });
    });
  }

  /** Creates a distinct assignment even when its owner already has other work. */
  enqueue(
    runId: string,
    owner: string,
    objective: string,
    acceptance: string[] = [],
  ): ExecutionAssignment {
    return this.db.transaction('assignment.created', { runId, owner }, () =>
      this.admission.create(runId, owner, objective, acceptance),
    );
  }

  /** Reads authoritative assignment state. */
  assignment(id: string): ExecutionAssignment {
    return this.db.get('assignment', id);
  }

  /** Lists all assignments belonging to a run in submission order. */
  assignments(runId: string): ExecutionAssignment[] {
    return this.db.all<ExecutionAssignment>('assignment').filter((item) => item.runId === runId);
  }

  /** Projects required work without deleting disconnected request history or claiming its completion. */
  requiredAssignments(runId: string): ExecutionAssignment[] {
    return new RequiredWork(this.db, this.replacements).assignments(runId);
  }

  /** Reads an exact retained request including its disposition and current assignment lineage. */
  requestById(id: string): InboxRequest {
    return this.replacements.envelope(this.db.get<InboxRequest>('request', id));
  }

  /** Selects ready work whose dependencies have verified delivery. */
  ready(runId: string): ExecutionAssignment[] {
    return new RequiredWork(this.db, this.replacements).ready(runId);
  }

  /** Captures continuation evidence without erasing earlier state. */
  updateAssignment(id: string, status: AssignmentStatus, data: Record<string, unknown> = {}): void {
    this.db.transaction('assignment.updated', { id, status }, () => {
      const item = this.assignment(id);
      this.db.put('assignment', { ...item, status, data: { ...item.data, ...data } });
    });
  }

  /** Reports whether the exact host decision has already committed through ordinary admission. */
  directionAdmitted(runId: string, id: string): boolean {
    return this.directionAdmission.admitted(runId, id);
  }

  /** Commits a complete director decision before the scheduler can see any of its assignments. */
  admitDirection(
    runId: string,
    proposals: DirectionProposal[],
    continuations: AssignmentContinuation[],
    checkpoint: Record<string, unknown>,
    decision: Pick<DirectionAdmissionTransition, 'id' | 'retirements'> = {
      id: randomUUID(),
      retirements: [],
    },
  ): void {
    this.directionAdmission.admit(runId, {
      id: decision.id,
      proposals,
      continuations,
      checkpoint,
      retirements: decision.retirements,
    });
  }

  /** Restores diagnosed continuations and reconsidered waits within the admission transaction. */
  private restoreContinuations(runId: string, continuations: AssignmentContinuation[]): void {
    if (!continuations.length) return;
    const ids = new Set(continuations.map((item) => item.assignmentId));
    if (ids.size !== continuations.length) throw new Error('Duplicate continuation identity');
    for (const item of continuations) {
      if (item.replacementChangeType) {
        this.replacements.replace(runId, item);
        const next = this.effective(item.assignmentId);
        for (const id of next.dependencies) this.assertAcyclic(next, id);
      } else this.admission.continueOne(runId, item);
    }
    for (const assignment of this.assignments(runId))
      if (
        !assignment.data.replacedBy &&
        assignment.status === 'blocked' &&
        ids.has(String(assignment.data.blockedBy))
      )
        this.db.put('assignment', {
          ...assignment,
          status: 'waiting',
          data: { ...assignment.data, blockedBy: null, reason: null },
        });
    this.wake(runId);
  }

  /** Routes a request once; conflicting reuse of a request identity is rejected. */
  request(from: string, request: OwnerRequest): ExecutionAssignment {
    return this.requests(from, [request])[0]!;
  }

  /** Delivers an entire fan-out atomically so invalid recipients cannot leave partial dispatch. */
  requests(from: string, requests: OwnerRequest[]): ExecutionAssignment[] {
    return this.db.transaction('requests.delivered', { from, requests }, () => {
      const recipients = requests.map((request) => this.route(from, request));
      this.wake(this.assignment(from).runId);
      return recipients;
    });
  }

  /** Commits replies and newly discovered dependencies as one recoverable activation outcome. */
  exchange(from: string, requests: OwnerRequest[], actions: InboxDecision[]): void {
    this.db.transaction('inbox.exchanged', { from, requests, actions }, () => {
      this.decisions(from, actions);
      for (const request of requests) this.route(from, request);
      this.wake(this.assignment(from).runId);
    });
  }

  /** Routes within the caller's transaction, preserving request identity and recipient intent. */
  private route(from: string, request: OwnerRequest): ExecutionAssignment {
    const origins = this.replacements.predecessors(from);
    const existing = this.db
      .all<InboxRequest>('request')
      .find((item) => origins.has(item.from) && item.key === request.key);
    if (existing?.retired) throw new Error('Retired request identity cannot be recreated');
    if (existing) return this.replacements.current(repeatedRequestAssignment(existing, request));
    const sender = this.assignment(from);
    if (sender.data.replacedBy) throw new Error('Cannot request work from a retired assignment');
    assertNotSelfLink(sender, request);
    this.rejectRecursiveIntent(sender, request);
    const recipient = this.recipient(sender, request);
    const mismatch = sharedRequestProblem(recipient, request);
    if (mismatch) throw new Error(mismatch);
    sender.data.milestones = requestMilestones(sender, recipient.id, request);
    storeInitialProposal(sender, recipient, request);
    this.db.put('assignment', recipient);
    this.db.put('request', { ...request, id: randomUUID(), from, assignmentId: recipient.id });
    this.connect(sender, recipient);
    return recipient;
  }

  /** Resolves explicit supplier links before mutation; other resource identities never imply new work. */
  private recipient(sender: ExecutionAssignment, request: OwnerRequest): ExecutionAssignment {
    if (request.existingAssignmentId === undefined)
      return this.admission.create(
        sender.runId,
        request.owner,
        request.objective,
        request.acceptance,
      );
    const recipient = this.assignments(sender.runId).find(
      (item) => item.id === request.existingAssignmentId && item.owner === request.owner,
    );
    if (!recipient)
      throw Object.assign(
        new Error(
          `Invalid supplier assignment ${request.existingAssignmentId}: link a known assignment of ${request.owner} in this run, or use assignmentId=null to request new work. Tracking issue, message and requester identities are not supplier assignments.`,
        ),
        { name: 'DependencyBlocked' },
      );
    return this.replacements.current(recipient.id);
  }

  /** Rejects a repeated ancestor intent as a blocking cycle without merging unrelated same-owner work. */
  private rejectRecursiveIntent(sender: ExecutionAssignment, request: OwnerRequest): void {
    if (request.existingAssignmentId) return;
    const ancestor = this.assignments(sender.runId).find(
      (a) =>
        a.owner === request.owner &&
        a.objective === request.objective &&
        JSON.stringify(a.acceptance) === JSON.stringify(request.acceptance) &&
        this.reaches(a.id, sender.id, new Set(), true),
    );
    if (ancestor)
      throw Object.assign(
        new Error(
          `Blocking dependency cycle: repeated ancestor intent ${ancestor.id} -> ${sender.id}`,
        ),
        { name: 'DependencyBlocked' },
      );
  }

  /** Lists request envelopes addressed to or sent by this assignment. */
  inbox(id: string) {
    return new InboxDecisions(this.db).messages(id);
  }

  /** Returns the accountable successor for a retained assignment or the original if still active. */
  effective(id: string): ExecutionAssignment {
    return this.replacements.current(id);
  }

  /** Records an accepted host-validated plan and releases accepted-intent dependents. */
  accept(id: string): void {
    this.db.transaction('assignment.accepted', { id }, () => {
      const item = this.assignment(id);
      item.data.accepted = true;
      this.db.put('assignment', item);
      this.wake(item.runId);
    });
  }

  /** Commits correlated decisions and dependent readiness together. */
  respond(id: string, decisions: InboxDecision[]): void {
    this.db.transaction('inbox.responses', { id, decisions }, () => {
      this.decisions(id, decisions);
      const actor = this.assignment(id);
      if (actor.status === 'running') this.db.put('assignment', { ...actor, status: 'ready' });
      this.wake(actor.runId);
    });
  }

  /** Checks strengthened waits inside the same transaction as their correlated replies. */
  private decisions(actor: string, decisions: InboxDecision[]): void {
    for (const decision of decisions) {
      if (!new InboxDecisions(this.db).apply(actor, decision)) continue;
      if (decision.action !== 'require_delivery') continue;
      const request = this.replacements.envelope(
        this.db.get<InboxRequest>('request', decision.requestId),
      );
      this.connect(this.assignment(actor), this.assignment(request.assignmentId));
    }
  }

  /** Distinguishes accepted intent from verified delivery for each dependency edge. */
  private satisfied(item: ExecutionAssignment, id: string): boolean {
    return dependencySatisfied(item, this.assignment(id));
  }

  /** Wakes satisfied waiters and propagates rejected deliveries without disturbing unrelated work. */
  private wake(runId: string): void {
    const run = this.run(runId);
    if (run.mode === 'workday' && run.status === 'idle')
      this.db.put('run', { ...run, status: 'running' });
    const assignments = this.assignments(runId);
    for (const item of assignments) {
      if (!['waiting', 'ready'].includes(item.status)) continue;
      const failed = assignments.find(
        (dep) =>
          !dep.data.replacedBy &&
          ['blocked', 'rejected', 'failed'].includes(dep.status) &&
          this.reaches(item.id, dep.id, new Set()),
      );
      if (failed)
        this.db.put('assignment', {
          ...item,
          status: 'blocked',
          data: {
            ...item.data,
            reason: `Dependency ${failed.id}: ${failed.data.reason ?? failed.status}`,
            blockedBy: failed.id,
          },
        });
      else if (
        !item.data.clarification &&
        item.dependencies.every((id) => ContributionGroups.canEngineer(item, this.assignment(id)))
      )
        this.db.put('assignment', { ...item, status: 'ready' });
    }
  }

  /** Adds an explicit dependency on shared work, rejecting cross-run links and cycles. */
  link(from: string, to: string): void {
    this.db.transaction('dependency.linked', { from, to }, () =>
      this.connect(this.assignment(from), this.replacements.current(to)),
    );
  }

  /** Validates a wait edge before persisting readiness changes. */
  private connect(sender: ExecutionAssignment, recipient: ExecutionAssignment): void {
    if (sender.runId !== recipient.runId)
      throw new Error('Cross-run dependency requires a new assignment');
    this.assertAcyclic(sender, recipient.id);
    if (!sender.dependencies.includes(recipient.id)) sender.dependencies.push(recipient.id);
    sender.status = sender.dependencies.every((id) => this.satisfied(sender, id))
      ? 'ready'
      : 'waiting';
    this.db.put('assignment', sender);
  }

  /** Rejects a newly blocking cycle before a dependency link or replacement can commit. */
  private assertAcyclic(sender: ExecutionAssignment, supplier: string): void {
    if (!this.satisfied(sender, supplier) && this.reaches(supplier, sender.id, new Set(), true))
      throw Object.assign(new Error('Blocking dependency cycle'), { name: 'DependencyBlocked' });
  }

  /** Searches the existing wait graph without assuming a fixed number of owners. */
  private reaches(id: string, target: string, seen: Set<string>, blocking = false): boolean {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const assignment = this.assignment(id);
    return assignment.dependencies.some(
      (next) =>
        (!blocking || !this.satisfied(assignment, next)) &&
        this.reaches(next, target, seen, blocking),
    );
  }

  /** Retains a checkpointed contribution without claiming verified delivery. */
  prepareContribution(id: string, contribution: PreparedContribution): void {
    new ContributionDelivery(this.db, this.wake.bind(this)).prepare(id, contribution);
  }

  /** Projects related prepared work for the existing sequential host to assemble. */
  contributionGroups(runId: string): ContributionGroups {
    return new ContributionGroups(this.requiredAssignments(runId));
  }

  /** Marks verified delivery and wakes satisfied dependents through the common completion transition. */
  complete(id: string, evidence: string[], candidate?: Record<string, unknown>): void {
    new ContributionDelivery(this.db, this.wake.bind(this)).complete([id], evidence, candidate);
  }

  /** Advances every exact prepared contribution and the assembled candidate in one transaction. */
  completeAssembly(
    ids: string[],
    evidence: string[],
    candidate: Record<string, unknown>,
    prepared: PreparedContribution[],
  ): void {
    new ContributionDelivery(this.db, this.wake.bind(this)).complete(
      ids,
      evidence,
      candidate,
      prepared,
    );
  }

  /** Reads a transactional candidate pointer without crossing live or simulation environments. */
  latestDelivery(
    authorityBase: string,
    packageId: string,
    environment?: RunEnvironment,
  ): ExecutionRun | undefined {
    return new CandidatePointers(this.db).latest(authorityBase, packageId, environment);
  }

  /** Blocks dependents transitively while leaving unrelated work runnable. */
  fail(
    id: string,
    status: 'blocked' | 'rejected' | 'failed' | 'interrupted',
    reason: string,
  ): void {
    this.db.transaction('assignment.failed', { id, status, reason }, () => {
      const item = this.assignment(id);
      this.db.put('assignment', {
        ...item,
        status,
        data: { ...item.data, reason, blockedBy: null },
      });
      for (const other of this.assignments(item.runId)) {
        if (
          other.id !== id &&
          !other.data.replacedBy &&
          (['ready', 'waiting', 'running'].includes(other.status) ||
            (other.status === 'blocked' && Boolean(other.data.blockedBy))) &&
          this.reaches(other.id, id, new Set())
        )
          this.db.put('assignment', {
            ...other,
            status: 'blocked',
            data: { ...other.data, reason, blockedBy: id },
          });
      }
    });
  }

  /** Records installed runtime transitions without altering retained assignments or prior evidence. */
  recordRuntime(
    runtime: { directory: string; hash: string },
    historical?: { directory: string; hash: string },
  ): void {
    const recorded = this.db.all<{ id: string; directory: string; hash: string }>('runtime')[0];
    if (recorded?.directory === runtime.directory && recorded.hash === runtime.hash) return;
    const previous = recorded ?? historical;
    const current = { id: 'host', ...runtime };
    this.db.transaction('runtime.changed', { previous: previous ?? null, current }, () =>
      this.db.put('runtime', current),
    );
  }

  /** Identifies the last durable transition across all connections for scheduler wakeups. */
  eventSequence(): number {
    return this.db.eventSequence();
  }

  /** Exposes immutable event projections for reports and streaming clients. */
  events(after = 0) {
    return this.db.events(after);
  }

  /** Releases resources owned by this connection. */
  close(): void {
    this.db.close();
  }
}
