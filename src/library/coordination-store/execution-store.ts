import { AssignmentAdmission } from './assignment-admission.js';
import { requestProposal } from './request-proposal.js';
import type { DeliveryRecord, PromotionCandidate } from './delivery-types.js';
import { CandidatePointers } from './candidate-pointers.js';
import { RunRecords } from './run-records.js';
import { InboxDecisions, type InboxDecision } from './inbox-decisions.js';
import { randomUUID } from 'node:crypto';
import { ExecutionDatabase } from './execution-database.js';
import type {
  AssignmentStatus,
  ExecutionAssignment,
  ExecutionRun,
  InboxRequest,
  OwnerRequest,
  RunMode,
  RunEnvironment,
  RunStatus,
} from './execution-types.js';

export { ExecutionLease } from './execution-lease.js';

export { requestProposal } from './request-proposal.js';

/** Persists assignment accountability, inbox identities and dependency readiness atomically. */
export class ExecutionStore {
  private readonly db: ExecutionDatabase;

  private readonly admission: AssignmentAdmission;

  /** Opens a new or retained general execution store without reading legacy workdays. */
  constructor(path: string, readOnly = false) {
    this.db = new ExecutionDatabase(path, readOnly);
    this.admission = new AssignmentAdmission(this.db);
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

  /** Selects ready work whose dependencies have verified delivery. */
  ready(runId: string): ExecutionAssignment[] {
    return this.assignments(runId)
      .filter(
        (item) =>
          item.status === 'ready' &&
          ((Array.isArray(item.data.questions) && item.data.questions.length > 0) ||
            item.dependencies.every((id) => this.satisfied(item, id))),
      )
      .sort((a, b) => Number(a.data.readyOrder ?? 0) - Number(b.data.readyOrder ?? 0));
  }

  /** Captures continuation evidence without erasing earlier state. */
  updateAssignment(id: string, status: AssignmentStatus, data: Record<string, unknown> = {}): void {
    this.db.transaction('assignment.updated', { id, status }, () => {
      const item = this.assignment(id);
      this.db.put('assignment', { ...item, status, data: { ...item.data, ...data } });
    });
  }

  /** Commits a complete director decision before the scheduler can see any of its assignments. */
  admitDirection(
    runId: string,
    proposals: Array<{
      owner: string;
      objective: string;
      acceptance: string[];
      data: Record<string, unknown>;
    }>,
    continuations: Array<{ assignmentId: string; ownerId: string; reason: string }>,
    checkpoint: Record<string, unknown>,
  ): void {
    const created: string[] = [];
    this.db.transaction('direction.admitted', { runId, created, continuations }, () => {
      const run = this.run(runId);
      this.restoreContinuations(runId, continuations);
      for (const item of proposals)
        created.push(
          this.admission.create(runId, item.owner, item.objective, item.acceptance, item.data).id,
        );
      this.db.put('run', { ...run, data: { ...run.data, ...checkpoint } });
    });
  }

  /** Reactivates diagnosed work and restores only its propagated dependents to milestone waiting. */
  continueAssignments(
    runId: string,
    continuations: Array<{ assignmentId: string; ownerId: string; reason: string }>,
  ): void {
    if (!continuations.length) return;
    this.db.transaction('assignments.continued', { runId, continuations }, () =>
      this.restoreContinuations(runId, continuations),
    );
  }

  /** Restores diagnosed continuations and reconsidered waits within the admission transaction. */
  private restoreContinuations(
    runId: string,
    continuations: Array<{ assignmentId: string; ownerId: string; reason: string }>,
  ): void {
    if (!continuations.length) return;
    const ids = new Set(continuations.map((item) => item.assignmentId));
    if (ids.size !== continuations.length) throw new Error('Duplicate continuation identity');
    for (const item of continuations) this.admission.continueOne(runId, item);
    for (const assignment of this.assignments(runId))
      if (assignment.status === 'blocked' && ids.has(String(assignment.data.blockedBy)))
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
    const existing = this.db
      .all<InboxRequest>('request')
      .find((item) => item.from === from && item.key === request.key);
    if (existing) return this.repeated(existing, request);
    const sender = this.assignment(from);
    this.rejectRecursiveIntent(sender, request);
    const recipient = this.recipient(sender, request);
    if (
      recipient.owner !== request.owner ||
      recipient.objective !== request.objective ||
      JSON.stringify(recipient.acceptance) !== JSON.stringify(request.acceptance)
    )
      throw new Error('Shared assignment acceptance differs');
    sender.data.milestones = this.milestones(sender, recipient.id, request);
    this.captureProposal(sender, recipient, request);
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
          `Invalid supplier assignment ${request.existingAssignmentId}: link a known assignment of ${request.owner} in this run with matching scope, or use assignmentId=null to request new work. Tracking issue, message and requester identities are not supplier assignments.`,
        ),
        { name: 'DependencyBlocked' },
      );
    return recipient;
  }

  /** Retains the strongest milestone when multiple requests deliberately share recipient work. */
  private milestones(sender: ExecutionAssignment, recipient: string, request: OwnerRequest) {
    const existing = (sender.data.milestones ?? {}) as Record<string, string>;
    const required = request.milestone ?? 'delivered';
    return {
      ...existing,
      [recipient]: existing[recipient] === 'delivered' ? 'delivered' : required,
    };
  }

  /** Preserves explicit recipient workflow and rejects incompatible reuse of accepted shared work. */
  private captureProposal(
    sender: ExecutionAssignment,
    recipient: ExecutionAssignment,
    request: OwnerRequest,
  ): void {
    const proposed = requestProposal(sender, request);
    const existing = recipient.data.proposal as Record<string, unknown> | undefined;
    for (const key of ['kind', 'changeType'] as const)
      if (
        existing &&
        request[key] != null &&
        JSON.stringify(existing[key]) !== JSON.stringify(proposed[key])
      )
        throw new Error('Shared assignment workflow or scope differs');
    recipient.data.proposal ??= proposed;
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

  /** Rejects accidental mutation of an already delivered request. */
  private repeated(existing: InboxRequest, request: OwnerRequest): ExecutionAssignment {
    const { id: _id, from: _from, assignmentId, ...original } = existing;
    if (JSON.stringify(original) !== JSON.stringify(request))
      throw new Error('Request identity reused with different content');
    return this.assignment(assignmentId);
  }

  /** Lists request envelopes addressed to or sent by this assignment. */
  inbox(id: string) {
    const replies = this.db.all<InboxDecision & { actor: string }>('reply');
    return this.db
      .all<InboxRequest>('request')
      .filter((r) => r.from === id || r.assignmentId === id)
      .map((request) => ({
        ...request,
        ...new InboxDecisions(this.db).context(id, request),
        replies: replies.filter((reply) => reply.requestId === request.id),
      }));
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
      const request = this.db.get<InboxRequest>('request', decision.requestId);
      this.connect(this.assignment(actor), this.assignment(request.assignmentId));
    }
  }

  /** Distinguishes accepted intent from verified delivery for each dependency edge. */
  private satisfied(item: ExecutionAssignment, id: string): boolean {
    const required = (item.data.milestones as Record<string, string> | undefined)?.[id];
    const dependency = this.assignment(id);
    return (
      dependency.status === 'completed' ||
      (required === 'accepted' && dependency.data.accepted === true)
    );
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
        item.dependencies.every((id) => this.satisfied(item, id))
      )
        this.db.put('assignment', { ...item, status: 'ready' });
    }
  }

  /** Adds an explicit dependency on shared work, rejecting cross-run links and cycles. */
  link(from: string, to: string): void {
    this.db.transaction('dependency.linked', { from, to }, () =>
      this.connect(this.assignment(from), this.assignment(to)),
    );
  }

  /** Validates a wait edge before persisting readiness changes. */
  private connect(sender: ExecutionAssignment, recipient: ExecutionAssignment): void {
    if (sender.runId !== recipient.runId)
      throw new Error('Cross-run dependency requires a new assignment');
    if (
      !this.satisfied(sender, recipient.id) &&
      this.reaches(recipient.id, sender.id, new Set(), true)
    )
      throw Object.assign(new Error('Blocking dependency cycle'), { name: 'DependencyBlocked' });
    if (!sender.dependencies.includes(recipient.id)) sender.dependencies.push(recipient.id);
    sender.status = sender.dependencies.every((id) => this.satisfied(sender, id))
      ? 'ready'
      : 'waiting';
    this.db.put('assignment', sender);
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

  /** Marks verified delivery and wakes all satisfied dependents in the same transaction. */
  complete(id: string, evidence: string[], candidate?: Record<string, unknown>): void {
    this.db.transaction('assignment.delivered', { id, evidence }, () => {
      const assignment = this.assignment(id);
      if (assignment.status === 'completed') {
        if (
          JSON.stringify(assignment.evidence) !== JSON.stringify(evidence) ||
          assignment.data.deliveredRevision !== candidate?.candidateRevision
        )
          throw new Error('Duplicate delivery disagrees with retained verification');
        return;
      }
      if (!evidence.length) throw new Error('Verified delivery requires evidence');
      if (assignment.dependencies.some((dep) => !this.satisfied(assignment, dep)))
        throw new Error('Undelivered dependencies');
      this.db.put('assignment', {
        ...assignment,
        status: 'completed',
        evidence,
        data: { ...assignment.data, deliveredRevision: candidate?.candidateRevision },
      });
      if (candidate) new CandidatePointers(this.db).promote(assignment.runId, candidate);
      this.wake(assignment.runId);
    });
  }

  /** Publishes fresh verified promotion evidence to the environment's candidate pointer atomically. */
  promotion(runId: string, delivery: DeliveryRecord, proof: PromotionCandidate) {
    new CandidatePointers(this.db).acceptPromotion(runId, delivery, proof);
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

  /** Exposes immutable event projections for reports and streaming clients. */
  events(after = 0) {
    return this.db.events(after);
  }

  /** Releases resources owned by this connection. */
  close(): void {
    this.db.close();
  }
}
