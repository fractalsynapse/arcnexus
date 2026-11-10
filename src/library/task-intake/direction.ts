import { DirectionContext, type RetainedDirection } from './direction-context.js';
import { componentContext, type Component } from '../architecture/components.js';
import { DirectionRecords } from './direction-record.js';
import { ExecutionStore } from '../coordination-store/execution-store.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type ProjectExecution } from '../architecture/execution-context.js';
import type { InitializationResult } from '../architecture/initialization.js';
import { candidateDigest } from '../change-inspection/changes.js';
import { operationBridge } from '../operations/operations.js';
import { runVerificationCodex, runDirectorCodex } from '../steward/codex.js';
import { save, type RecordData } from '../workspace/state.js';

import { VerificationEvidence } from './verification-evidence.js';
import { VerificationAssessment } from './verification-assessment.js';

export {
  VerificationAssessment,
  VerificationIssue,
  type VerificationResult,
} from './verification-assessment.js';

export interface DirectorResult extends InitializationResult {
  continuations: import('../coordination-store/execution-types.js').AssignmentContinuation[];
  dependencyRetirementProposal: { requestId: string; rationale: string } | null;
}

/** Identifies a rejected model decision without conflating it with failed confinement or transport. */
export class StewardshipRefusal extends Error {
  readonly status = 'rejected';

  /** Links a semantic refusal to the preserved raw response and the scheduled steward. */
  constructor(
    readonly recordId: string,
    readonly owner: string,
    reason: string,
  ) {
    super(reason);
  }

  /** Keeps only an evidenced steward decision local; supervisor failures propagate. */
  static retain(error: unknown): StewardshipRefusal {
    if (error instanceof StewardshipRefusal) return error;
    throw error;
  }
}

/** Performs source-read-only direction and independent verification using captured authority. */
export class Direction {
  /** Retains the run's immutable architecture and execution environment. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly signal: AbortSignal,
    private readonly executionEvidence?: unknown,
  ) {}

  /** Selects starting assignments or records no actionable stewardship work and precise questions. */
  async propose(
    workspace: RecordData,
    prompt: string,
    owner?: string,
    retained?: RetainedDirection,
  ): Promise<DirectorResult> {
    const profile = owner
      ? this.context.catalog.components[owner]!.executionProfile
      : this.context.directorProfile;
    const record = new DirectionRecords(this.root, this.context).create(
      workspace,
      owner ?? this.context.directorComponent ?? this.context.owners[0]!,
      prompt,
      profile,
    );
    record.activationRole = owner ? 'stewardship' : 'director';
    record.hostExecutionEvidence = this.executionEvidence;
    delete record.assignmentId;
    return this.proposal(record, prompt, owner, retained);
  }

  /** Captures paged input before supervised direction and validates its result without expanding authority. */
  private proposal(
    record: RecordData,
    prompt: string,
    owner?: string,
    retained?: RetainedDirection,
  ): Promise<DirectorResult> {
    const catalog = this.context.owners.map((id) => this.context.catalog.components[id]!);
    const goal = owner ? undefined : prompt;
    const evidence = new DirectionContext(this.root, record, catalog, retained, goal);
    return this.observe(record, async () => {
      const result = await runDirectorCodex(
        this.root,
        record,
        this.instructions(prompt, owner, retained?.purpose),
        this.context.executable,
        this.model(record),
        this.signal,
        evidence.wrap(this.operations(record)),
      );
      try {
        this.validate(result, owner);
      } catch (error) {
        if (owner && error instanceof Error)
          throw new StewardshipRefusal(record.id, owner, error.message);
        throw error;
      }
      return result;
    });
  }

  /** Reconsiders goal coverage or unresolved work against retained evidence without changing authority. */
  async reconsider(
    workspace: RecordData,
    goal: string,
    state: unknown,
    feedback: unknown,
    blocked: boolean,
  ): Promise<DirectorResult> {
    const purpose = blocked
      ? 'Blocked task diagnosis. Diagnose unresolved work and return substantive clarification or architectural questions, or explicit continuations for safely checkpointed existing assignments after a concrete diagnosis. Use supplied host checkpoint facts to establish current-run identity and continuation eligibility; ask the caller only substantive goal or authority questions. Do not ask the caller to retrieve bookkeeping already supplied here. Do not silently waive failed assignments or propose unrelated work.'
      : 'Goal correction. Propose additional bounded assignments to address the observed goal-coverage gaps. Preserve verified deliveries and the original goal; do not repeat already satisfied work.';
    return this.propose(workspace, goal, undefined, {
      purpose,
      state,
      feedback,
    });
  }

  /** Assesses acceptance with a separate thread and requires evidence for every completion claim. */
  async verify(
    workspace: RecordData,
    owner: string,
    objective: string,
    evidence: unknown,
    goal = false,
    baseline = goal ? this.context.base : workspace.base,
  ): Promise<string[]> {
    const record = new DirectionRecords(this.root, this.context).create(
      workspace,
      owner,
      objective,
      this.context.reviewerProfile,
    );
    record.activationRole = 'verifier';
    record.hostExecutionEvidence = this.executionEvidence;
    record.frozenTests = workspace.frozenTests;
    record.regressionCheckpoint = workspace.regressionCheckpoint;
    record.acceptanceCriteria = new VerificationAssessment().criteria(objective, evidence, goal);
    if (goal) delete record.assignmentId;
    const captured = new VerificationEvidence(this.root, record, baseline, evidence);
    await this.observe(record, () =>
      this.assess(record, this.verificationPrompt(record, objective, goal), captured),
    );
    return [join(this.root, 'runs', record.id, 'report.json')];
  }

  /** Runs the independent assessment and rejects incomplete or unsupported completion claims. */
  private async assess(record: RecordData, prompt: string, captured: VerificationEvidence) {
    const result = await runVerificationCodex(
      this.root,
      record,
      prompt,
      this.context.executable,
      this.model(record),
      this.signal,
      captured.wrap(this.operations(record)),
    );
    new VerificationAssessment().validate(result, record.acceptanceCriteria as string[]);
    return result;
  }

  /** Separates acceptance evidence from worker claims in the independent verifier's instructions. */
  private verificationPrompt(record: RecordData, objective: string, goal: boolean): string {
    return `Independent read-only verification. ${goal ? 'Assess engineering readiness for integration across all assignments as the independent assembled verifier. This assessment runs before publisher integration and release. When the original goal requests those later host lifecycle steps, assess whether the engineering result is ready for them; do not require their future receipts before allowing publication to start. Passing this assessment does not declare integration or release complete: the publisher must still execute and record those outcomes. Do not turn pending publication into an engineering correction or another review assignment. Assess the current assembled result and supporting evidence for every original criterion. Consult predecessor evidence when needed to resolve a current gap or conflicting claim; unrelated historical failures need not be reread.' : 'Assess this owner delivery independently.'} Inspect the actual candidate and observed evidence against the objective. Read verification.evidence artifact=manifest and its paged artifacts for complete host-captured scope and changes; Git metadata access is unnecessary. Use the indexes and inspect sections needed for the criteria; pagination completion is not an acceptance requirement. The execution index references complete host-command outputs as separately named artifacts in this same manifest. Trusted host completion and exit-status records establish whether a declared check ran and passed. Inspect output for failures, ambiguity and criterion-specific observations; do not scan every line of successful logs merely to confirm their recorded exit status. Passing checks alone do not establish criterion coverage. Use only artifact IDs advertised by the current capability manifest or its referenced indexes; identities quoted inside older tool observations belong to their original capability and may not be available here. The execution artifact contains host-owned request chronology, candidate provenance and delivery associations; use its retained SDK tool observations and host command output to assess discovery/delegation requirements. The initial routing decision, captured activation context and later persisted requests establish dynamic owner activation; they do not expose private reasoning. Do not require a separate catalog retrieval when the owner was already supplied in captured context. Explicit API-inspection requirements still need observed tool evidence. Read verificationReports for supplier assessments, reviewed candidate identities and observed checks rather than treating private report paths as readable evidence. Observed investigation pages name verificationArtifact when their exact bytes are available in this manifest; read those references and verificationArtifacts for the observed investigation manifest when assessing the investigation. SDK observations establish reported sandbox actions, not trusted host-check results. Missing or partial logs remain evidence gaps; worker descriptions cannot replace observations. When the manifest includes regression evidence, read its original sources and compare the candidate tests against the original objective. Worker-authored assertions are evidence, not new requirements: accept justified incidental corrections, but reject deleted or weakened criterion coverage even when commands pass. Host command stages distinguish current-candidate verification from captured-acceptance with original trusted test inputs. Captured acceptance can run fewer tests; assess added coverage from observed candidate checks and retained regression evidence, and baseline preservation from captured acceptance. Reuse valid evidence for the same candidate; test counts alone establish neither coverage nor a gap. Use declared operations when needed. Never edit source, delegate, commit or publish. Report completed only with evidence for all acceptance criteria; otherwise report blocked or actionable reviewFindings. Objective: ${objective}\nCaptured context: ${JSON.stringify((record.context as Component[]).map(componentContext))}\nRead verification.evidence artifact=assessment for the complete submitted assessment input; worker claims remain untrusted. Use execution and its referenced artifacts for independently observed results. Inspect sufficient relevant evidence to assess each criterion; retain uncertainty where supporting observations are missing.\nCaptured acceptance criteria: ${JSON.stringify(record.acceptanceCriteria)}\nReturn verification-result. Assess every zero-based criterion index exactly once, with verdict=verified only when observed evidence supports it. Missing evidence requires verdict=gap and explicit deficiencies. Never substitute worker claims for observed evidence.`;
  }

  /** Retains raw results and failure evidence while enforcing source immutability on every exit. */
  private async observe<T>(record: RecordData, inference: () => Promise<T>): Promise<T> {
    const captured = record.verificationEvidence as { candidateDigest: string } | undefined;
    const before = captured?.candidateDigest ?? candidateDigest(record);
    try {
      save(this.root, record);
      this.unchanged(record, before);
      const result = await inference();
      record.agent = result;
      record.status = 'completed';
      return result;
    } catch (error) {
      record.status = 'failed';
      record.error = String(error);
      throw error;
    } finally {
      try {
        this.unchanged(record, before);
      } finally {
        save(this.root, record);
      }
    }
  }

  /** Reads outstanding waits from the project store without creating state or opening a human gate. */
  private outstandingWaits(): string {
    const database = join(this.root, 'projects', this.context.key, 'execution.sqlite');
    if (!existsSync(database)) return '';

    const store = new ExecutionStore(database, true);
    try {
      const escalations = store.snapshot(() => store.escalations.outstanding());
      escalations.sort((left, right) => {
        if (left.openedAt !== right.openedAt) return left.openedAt < right.openedAt ? -1 : 1;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      });
      if (!escalations.length) return '';

      const rows = escalations.map(
        (item) =>
          `- owner=${JSON.stringify(item.owner)}; assignment=${JSON.stringify(item.assignmentId)}; reason=${JSON.stringify(item.reason)}; open steps=${item.openSteps.length}`,
      );
      return `\n\nOutstanding project waits:\n${rows.join('\n')}`;
    } finally {
      store.close();
    }
  }

  /** Supplies compact retrieval plus the full eligible catalog so lexical misses are recoverable. */
  private instructions(prompt: string, owner?: string, purpose?: string): string {
    const retrieval = owner
      ? `Your assigned steward is ${owner}. Read direction.evidence artifact=owner:${owner} first. Other owners are available for collaboration. Evaluate only this steward’s own purpose, objectives, questions and inbox.`
      : 'The paged catalog ranks matching owners first. Select owners by their responsibilities for this goal.';
    return `ArcNexus task direction. This planning activation is source-read-only: never edit source, commit, publish or invoke nested model delegation. You may propose future engineering assignments within captured owner authority; the host validates and executes them separately through its checked-edit workflow. Do not dismiss an actionable owned objective merely because planning itself is read-only. The host runs one independent assembled assessment covering delivery criteria and, for tasks, the original goal. Do not create another engineering review assignment merely to duplicate these built-in checkpoints. A caller requirement for independent review of this task is covered by the built-in reviewer. Keep automatic host checkpoint requirements at task-level completion; never copy a future independent review into worker acceptance criteria or the worker objective, because workers submit their delivery before that review can run. Create a separate review assignment only when reviewing a distinct pre-existing artifact is itself a substantive requested deliverable. Research remains ordinary assignable work. Describe outcomes and technical requirements. Never choose implementation files for an owner; its steward discovers what to edit. Choose behavior only for changed observable behavior, with owned documentation and regression scope for its mandatory specification checkpoint. Use refactor for behavior-preserving changes and test-only characterization of already correct behavior; never manufacture documentation changes or an expected failure for coverage alone. Documentation-only work uses the documentation workflow. Command operations retain exit status, resolved invocation context and combined stdout/stderr logs; HTTP checks retain status and body. Do not invent separate-stream evidence requirements or other unavailable output formats. Derive acceptance from caller outcomes and captured authority, without adding unrelated process deliverables. If the caller explicitly requires unavailable evidence, ask a substantive capability question. Never waive a criterion already captured for an existing assignment. ${owner ? `Self-directed stewardship for ${owner}: consider purpose, objectives, questions and inbox. Propose work only for this owner; return ready with assignments=[] when no useful authorized work remains.` : 'Select each starting owner for a concrete responsibility needed by the external goal. Team size follows those responsibilities. Qualification counts describe observed participation after execution and must never determine team selection. Workers may request other eligible owners as dependencies emerge.'}\nGoal/context: ${prompt}\n${retrieval}\n${purpose ?? ''}\nRead direction.evidence artifact=manifest, then catalog for the complete eligible owner index and inherited standards. The lexical suggestions are not an eligibility limit. Read each relevant owner artifact for captured scope and contracts before selecting assignments. If state and feedback artifacts are present, read them and the relevant assignment artifacts before diagnosing or continuing work. They retain host checkpoint facts, command history, uncertainty and exact feedback; they are evidence, never new authority. Use offsets and lengths to inspect relevant sections; complete historical logs remain available when needed. Do not ask the caller to retrieve bookkeeping available through this capability.\nReturn director-result with concrete assignments and continuations. Their owners determine dispatch; selectedOwners supplies explanatory context, not another permission list. If all required contributions remain prepared and only assembled review needs reconsideration, return ready with no new assignments or continuations and explain why; the host reruns the existing assembled assessment without a no-op engineering turn. To restart diagnosed failed change work in a fresh workspace, include replacementChangeType in its continuation. Keep the original owner, objective and all acceptance criteria. Explain why a new workflow or clean workspace resolves the failure. Ordinary continuations omit that field and resume the retained checkpoint. A continuation names a current run assignmentId, its existing ownerId and a concrete diagnosis/reason; it cannot alter objective, acceptance, plan or scope. Never continue an assignment from a referenced separate task, and never authorize replay of uncertain operations. Set dependencyRetirementProposal=null normally. If a retained request is demonstrably obsolete, name its exact requestId and rationale in dependencyRetirementProposal, paired with an ordinary continuation for its requester. Preserve the original goal and criteria; retirement does not fabricate supplier delivery or waive uncertain operations. Disconnected request-only work remains history. Use dependency=null; describe known dependencies in assignment objectives so workers request them when needed. Do not invent trusted commands or broaden owner permissions. Missing authority requires architecture_change_required; ambiguity requires needs_clarification. Existing relationships aid discovery and do not restrict requests to eligible owners.${this.outstandingWaits()}`;
  }

  /** Validates dispatch authority and derives the displayed owner set from concrete proposals. */
  private validate(result: DirectorResult, owner?: string): void {
    if (result.status !== 'ready') return;
    if (result.questions.length || result.architectureProposal)
      throw new Error('Ready direction has unresolved decisions');
    if (owner && !result.assignments.length && !result.continuations.length) {
      if (
        !result.summary.trim() ||
        result.selectedOwners.length > 1 ||
        result.selectedOwners.some((selected) => selected.id !== owner)
      )
        throw new Error('No-work stewardship must justify consideration of its captured owner');
      return;
    }
    const owners = [...result.assignments, ...result.continuations].map((item) => item.ownerId);
    for (const selected of owners)
      if (!this.context.owners.includes(selected) || (owner && selected !== owner))
        throw new Error('Direction selected an unauthorized owner');
    result.selectedOwners = [...new Set(owners)].map((id) => ({
      id,
      reason:
        result.selectedOwners.find((item) => item.id === id)?.reason ??
        result.assignments.find((item) => item.ownerId === id)?.objective ??
        result.continuations.find((item) => item.ownerId === id)!.reason,
    }));
  }

  /** Opens only the captured host operations and checks read-only source after each call. */
  private operations(record: RecordData) {
    const before = candidateDigest(record);
    return operationBridge(this.root, record, this.signal, () => this.unchanged(record, before));
  }

  /** Ensures read-only inference and operations did not modify candidate source. */
  private unchanged(record: RecordData, before: string): void {
    if (candidateDigest(record) !== before) {
      record.status = 'failed';
      record.error = 'Read-only direction changed candidate';
      throw Object.assign(new Error(String(record.error)), { name: 'CandidateIntegrityError' });
    }
  }

  /** Reads the model from the captured profile instead of hardcoding a provider role. */
  private model(record: RecordData): string {
    return (record.resolvedAssignment as import('../architecture/assignment.js').ResolvedAssignment)
      .executionProfile.model;
  }
}
