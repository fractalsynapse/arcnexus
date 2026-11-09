import { git } from '../operations/process.js';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { ExecutionAssignment, ExecutionRun } from '../coordination-store/execution-types.js';
import type { RecordData } from '../workspace/state.js';
import { DeliveryEvidence } from './delivery-evidence.js';
import { ExecutionObservations } from './execution-observations.js';
import type { EvidenceSet } from './evidence-set.js';
import { ReferencedEvidence } from './referenced-evidence.js';

interface HostCommandEvidence {
  index: number;
  output?: { content?: string; artifact?: string };
}

interface HostExecutionEvidence {
  run?: { id?: string };
  publication?: { recordId: string; observations: { hostCommands?: HostCommandEvidence[] } };
  assemblies?: NonNullable<HostExecutionEvidence['assignments']>;
  assignments?: Array<{
    id: string;
    data?: Record<string, unknown>;
    verificationReports?: Array<Record<string, unknown>>;
    record?: {
      recordId?: string;
      observations?: { hostCommands?: HostCommandEvidence[]; timeline?: { events?: any[] } };
    };
  }>;
}

/** Projects current-run host observations without granting arbitrary access to private state files. */
export class ExecutionEvidence {
  /** Retains the authoritative store and private evidence root used to validate record references. */
  constructor(
    private readonly root: string,
    private readonly store: ExecutionStore,
  ) {}

  /** Pins current-run host observations without accepting a foreign task as execution evidence. */
  static pin(root: string, runId: unknown, pages: EvidenceSet, input: unknown) {
    const evidence = structuredClone(input) as HostExecutionEvidence | undefined;
    if (!evidence) return;
    if (typeof runId !== 'string' || evidence.run?.id !== runId)
      throw new Error('Host execution evidence belongs to a different run');
    new ReferencedEvidence(root, runId, pages).index(evidence);
    this.indexCommandOutputs(pages, evidence);
    const assignments = evidence.assignments?.map((assignment) =>
      this.assignmentArtifacts(pages, assignment),
    );
    const assemblies = evidence.assemblies?.map((assembly) =>
      this.assignmentArtifacts(pages, assembly),
    );
    pages.addSections('execution', { ...evidence, assignments, assemblies }, [
      'events',
      'requests',
      'runtimeTransitions',
    ]);
    return { ...evidence, assignments, assemblies };
  }

  /** Makes each worker record and prior review independently discoverable instead of inlining their histories. */
  private static assignmentArtifacts(
    pages: EvidenceSet,
    assignment: NonNullable<HostExecutionEvidence['assignments']>[number],
  ) {
    const { record, verificationReports, data, ...intent } = assignment;
    const prefix = 'execution:' + assignment.id;
    return {
      ...intent,
      data: data && pages.addSections(prefix + ':data', data, ['proposal', 'directionContext']),
      record: record && this.recordArtifacts(pages, prefix, record),
      verificationReports: verificationReports?.map((review, index) =>
        pages.addSections(prefix + ':review:' + index, review, ['observations']),
      ),
    };
  }

  /** Separates trusted command metadata from potentially large SDK histories in the same evidence catalog. */
  private static recordArtifacts(
    pages: EvidenceSet,
    prefix: string,
    record: NonNullable<NonNullable<HostExecutionEvidence['assignments']>[number]['record']>,
  ) {
    const observations =
      record.observations &&
      pages.addSections(prefix + ':record:observations', record.observations, [
        'hostCommands',
        'timeline',
      ]);
    return pages.addSections(prefix + ':record', { ...record, observations }, [
      'activationInput',
      'commands',
      'operations',
      'operationInvocations',
      'plan',
      'frozenTests',
      'services',
    ]);
  }

  /** Pins complete logs separately so criterion inspection need not page through unrelated command output. */
  private static indexCommandOutputs(pages: EvidenceSet, evidence: HostExecutionEvidence): void {
    for (const assignment of [...(evidence.assignments ?? []), ...(evidence.assemblies ?? [])])
      this.addCommandOutputs(
        pages,
        'execution:' + assignment.id,
        assignment.record?.observations?.hostCommands ?? [],
      );
    if (evidence.publication)
      this.addCommandOutputs(
        pages,
        'publication:' + evidence.publication.recordId,
        evidence.publication.observations.hostCommands ?? [],
      );
  }

  /** Labels each immutable output by its originating assignment or assembled check record. */
  private static addCommandOutputs(
    pages: EvidenceSet,
    prefix: string,
    commands: HostCommandEvidence[],
  ): void {
    for (const command of commands) {
      if (typeof command.output?.content !== 'string') continue;
      const id = prefix + ':command:' + command.index;
      pages.add(id, command.output.content, 'utf8');
      delete command.output.content;
      command.output.artifact = id;
    }
  }

  /** Captures ordered coordination, provenance and observed work independently of worker summaries. */
  capture(runId: string) {
    return this.store.snapshot(() => this.project(runId));
  }

  /** Reads run and request identities from one store snapshot before resolving retained artifacts. */
  private project(runId: string) {
    const run = this.store.run(runId);
    const assignments = this.store.assignments(runId);
    const ids = new Set([runId, ...assignments.map((assignment) => assignment.id)]);
    return {
      schemaVersion: 1,
      basis:
        'Host-retained intent and observations. Request acceptance and turn completion are not verified delivery.',
      run: this.runSummary(run),
      events: this.store
        .events()
        .filter((event) =>
          Object.values(event.data).some((value) => typeof value === 'string' && ids.has(value)),
        ),
      runtimeTransitions: this.store.events().filter((event) => event.type === 'runtime.changed'),
      requests: this.requests(assignments, ids),
      source: this.source(run),
      assignments: assignments.map((assignment) => this.assignment(assignment)),
      assemblies: this.assemblies(run),
    };
  }

  /** Labels this run's retained prompt as caller input without treating it as a host result. */
  private callerObservations(run: ExecutionRun): unknown {
    const input = run.data.prompt;
    if (typeof input !== 'string' || !input)
      return {
        evidenceUnavailable: true,
        reason: 'Caller observations were not retained for this run',
      };
    return { attribution: 'caller-provided', runId: run.id, input };
  }

  /** Projects durable run identity and caller observations without joining them to acceptance. */
  private runSummary(run: ExecutionRun) {
    return {
      id: run.id,
      mode: run.mode,
      objective: run.objective,
      createdAt: run.createdAt,
      authorityBase: run.data.authorityBase,
      candidateRevision: run.data.candidateRevision,
      initialCandidateRevision: run.data.initialCandidateRevision,
      initialCandidateSourceRun: run.data.initialCandidateSourceRun,
      initialDirection: run.data.initialDirection,
      redirection: run.data.redirection,
      callerObservations: this.callerObservations(run),
    };
  }

  /** Emits each durable request once, excluding any coordination outside the current run. */
  private requests(assignments: ExecutionAssignment[], ids: Set<string>) {
    return assignments.flatMap((assignment) =>
      this.store
        .inbox(assignment.id)
        .filter((request) => request.from === assignment.id && ids.has(request.assignmentId)),
    );
  }

  /** Observes the caller checkout independently of the editable assignment workspaces. */
  private source(run: ExecutionRun): unknown {
    const source = (run.data.workspace as RecordData | undefined)?.source;
    if (!source)
      return { evidenceUnavailable: true, reason: 'Source workspace has not been prepared' };
    try {
      return {
        path: source,
        head: git(source, 'rev-parse', 'HEAD').trim(),
        status: git(source, 'status', '--porcelain', '--untracked-files=all'),
      };
    } catch (error) {
      return { evidenceUnavailable: true, reason: String(error) };
    }
  }

  /** Separates captured assignment intent and verified delivery references from activation observations. */
  private assignment(assignment: ExecutionAssignment) {
    return {
      id: assignment.id,
      runId: assignment.runId,
      data: assignment.data,
      owner: assignment.owner,
      objective: assignment.objective,
      acceptance: assignment.acceptance,
      status: assignment.status,
      replaces: assignment.data.replaces,
      replacedBy: assignment.data.replacedBy,
      replacementReason: assignment.data.replacementReason,
      dependencies: assignment.dependencies,
      milestones: assignment.data.milestones,
      deliveredRevision: assignment.data.deliveredRevision,
      verification: assignment.evidence,
      verificationReports: new DeliveryEvidence(this.root).capture(assignment),
      record: this.record(assignment.runId, assignment),
    };
  }

  /** Resolves only matching current-run records and makes missing evidence explicit instead of substituting it. */
  private record(runId: string, assignment: ExecutionAssignment): unknown {
    const id = assignment.data.recordId;
    if (!id) return null;
    try {
      const record = this.readRecord(id, runId);
      if (record.assignmentId !== assignment.id)
        throw new Error('Retained record belongs to a different run or assignment');
      return this.observations(record);
    } catch (error) {
      return { evidenceUnavailable: true, reason: String(error) };
    }
  }

  /** Includes current and recent combined checks so ordinary corrections can inspect their real outputs. */
  private assemblies(run: ExecutionRun) {
    const sources = [
      run.data.pendingAssembly,
      run.data.lastAssembly,
      (run.data.candidateRecord as RecordData | undefined)?.assemblyAssignments && {
        recordId: (run.data.candidateRecord as RecordData).id,
      },
    ].filter(Boolean) as Array<{ recordId: string }>;
    return [...new Set(sources.map((item) => item.recordId))].map((id) =>
      this.assembly(run.id, id),
    );
  }

  /** Labels combined check observations without granting access to another run or record role. */
  private assembly(runId: string, id: string) {
    try {
      const record = this.readRecord(id, runId);
      if (
        record.activationRole !== 'publication-checks' ||
        !Array.isArray(record.assemblyAssignments)
      )
        throw new Error('Retained record is not an assembled delivery');
      return {
        id: 'assembly:' + id,
        data: {
          assignments: record.assemblyAssignments,
          baseline: record.assemblyBase,
          findings: record.assemblyFindings,
        },
        record: this.observations(record),
      };
    } catch (error) {
      return { id: 'assembly:' + id, record: { evidenceUnavailable: true, reason: String(error) } };
    }
  }

  /** Applies the same identity and filesystem checks to assignment and combined acceptance records. */
  private readRecord(id: unknown, runId: string): RecordData {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
      throw new Error('Invalid retained record identity');
    const path = join(this.root, 'runs', id, 'report.json');
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.nlink !== 1 || realpathSync(path) !== resolve(path))
      throw new Error('Unsafe retained execution record');
    const record = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
    if (record.id !== id || record.executionRunId !== runId)
      throw new Error('Retained record belongs to a different run or assignment');
    return record;
  }

  /** Retains the actual owner catalog context supplied to engineering, without inferring private reasoning. */
  private activationInput(record: RecordData) {
    const captured = record.resolvedAssignment as
      { context?: unknown; related?: unknown } | undefined;
    return {
      context: captured?.context,
      related: captured?.related,
      objective: record.objective,
      authorityBase: (record.resolvedAssignment as { base?: string } | undefined)?.base,
    };
  }

  /** Separates authoritative checkpoint state from model claims and observed command evidence. */
  private checkpoint(record: RecordData) {
    return {
      source: record.source,
      workspace: record.workspace,
      base: record.base,
      status: record.status,
      stage: record.stage,
      nextStage: record.nextStage,
      threadId: record.threadId,
      checkpoint: record.checkpoint,
      safeCheckpoint: record.safeCheckpoint,
      changes: record.changes,
      plan: record.plan,
      frozenTests: record.frozenTests,
      regressionCheckpoint: record.regressionCheckpoint,
      finalVerifiedBase: record.finalVerifiedBase,
      finalVerifiedDigest: record.finalVerifiedDigest,
      reconciliationId: record.reconciliationId,
      editRecovery: record.editRecovery,
      error: record.error,
    };
  }

  /** Includes complete observed execution while preserving the original checkpoint and source authority. */
  private observations(record: RecordData) {
    return {
      recordId: record.id,
      ...this.checkpoint(record),
      activationInput: this.activationInput(record),
      turns: record.turns,
      commands: record.commands,
      operations: record.operations,
      operationInvocations: record.operationInvocations,
      services: record.services,
      currentOperation: record.currentOperation,
      pendingRequests: record.pendingRequests,
      pendingInboxActions: record.pendingInboxActions,
      independentFindings: record.independentFindings,
      workerClaims: record.agent,
      observations: new ExecutionObservations(join(this.root, 'runs', record.id)).capture(record),
    };
  }
}
