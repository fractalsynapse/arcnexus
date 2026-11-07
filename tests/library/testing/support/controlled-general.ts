import { ControlledClient } from './controlled-client.js';
import { ControlledEvidence } from './controlled-evidence.js';
import { StructuredOutputCheck } from './structured-output-check.js';
import { appendFileSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

/** Supplies deterministic SDK events while exercising the production host, permissions and scheduler. */
export class ControlledGeneral {
  private retainedDirection: any;

  private assessment: unknown;

  private assignmentEvidenceValue: any;

  /** Retains an external trace that survives candidate workspace switches. */
  constructor(
    private readonly calls: string,
    private readonly gate?: string,
  ) {}

  /** Handles version/preflight or emits one structured inference result. */
  async run(): Promise<void> {
    const args = process.argv.slice(2);
    if (ControlledClient.inventory(args, 'controlled general execution')) return;
    if (args[0] === 'sandbox') return;
    new StructuredOutputCheck().inspect(
      JSON.parse(readFileSync(args[args.indexOf('--output-schema') + 1]!, 'utf8')),
    );
    let prompt = '';
    for await (const chunk of process.stdin) prompt += chunk;
    appendFileSync(this.calls, JSON.stringify({ args, prompt }) + '\n');
    await this.assignmentEvidence(args, prompt);
    await this.directionEvidence(args, prompt);
    await this.checkpointGate(prompt);
    await this.verificationEvidence(args, prompt);
    const result = prompt.startsWith('ArcNexus task direction.')
      ? this.startingWork(this.direction(prompt), prompt)
      : this.worker(prompt);
    this.emit(result, prompt);
  }

  /** Reads the actual assignment capability before returning a deliberately shared supplier identity. */
  private async assignmentEvidence(args: string[], prompt: string): Promise<void> {
    if (
      !/READ_ASSIGNMENT_EVIDENCE|LINK_EXISTING_WORK/.test(prompt) ||
      !prompt.includes('Activity turn: planning')
    )
      return;
    this.assignmentEvidenceValue = await new ControlledEvidence(
      this.calls,
      'assignment.evidence',
      32768,
    ).inspect(args, true, true);
  }

  /** Supplies two starting owners only for the controlled existing-work discovery scenario. */
  private startingWork(result: any, prompt: string): any {
    if (prompt.includes('REASSESS_PREPARED'))
      return {
        ...result,
        assignments: [],
        continuations: [],
        selectedOwners: [{ id: 'c', reason: 'Retained owner context, not a new dispatch' }],
      };
    if (!prompt.includes('LINK_EXISTING_WORK')) return result;
    result.selectedOwners = ['a', 'b'].map((id) => ({ id, reason: 'Starting owner' }));
    result.assignments = [
      {
        ...this.assignment('a', false, ''),
        kind: 'change',
        changeType: 'documentation',
        objective: prompt.includes('CALLER_PURPOSE_LINK')
          ? 'LINK_EXISTING_WORK CALLER_PURPOSE_LINK: retain caller evidence'
          : 'LINK_EXISTING_WORK: reuse matching supplier work',
      },
      { ...this.assignment('b', false, ''), objective: 'Supply shared evidence' },
    ];
    return result;
  }

  /** Retrieves assessment inputs through the real verifier bridge when a controlled criterion depends on them. */
  private async verificationEvidence(args: string[], prompt: string): Promise<void> {
    if (
      !prompt.startsWith('Independent read-only verification.') ||
      !/READ_HOST_EVIDENCE|REPLAN_GOAL/.test(prompt)
    )
      return;
    const result = await new ControlledEvidence(
      this.calls,
      'verification.evidence',
      prompt.includes('LARGE_ASSESSMENT') ? 32768 : 64,
    ).inspect(args, prompt.includes('FORBIDDEN_ARTIFACT'), prompt.includes('RETRY_INVALID_PAGE'));
    this.assessment = JSON.parse(result.artifacts.assessment!);
  }

  /** Reads blocked-task state through the real MCP capability instead of extracting inlined private history. */
  private async directionEvidence(args: string[], prompt: string): Promise<void> {
    if (
      !prompt.startsWith('ArcNexus task direction.') ||
      !/Blocked task diagnosis|Self-directed stewardship for|READ_DIRECTION_EVIDENCE/.test(prompt)
    )
      return;
    const result = await new ControlledEvidence(this.calls, 'direction.evidence', 32768).inspect(
      args,
      true,
      true,
    );
    this.retainedDirection = result.artifacts.state
      ? JSON.parse(result.artifacts.state)
      : undefined;
  }

  /** Emits the SDK event stream for a completed controlled inference. */
  private emit(result: unknown, prompt: string): void {
    console.log(JSON.stringify({ type: 'thread.started', thread_id: 'general-thread' }));
    this.observation(prompt);
    console.log(
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'result', type: 'agent_message', text: JSON.stringify(result) },
      }),
    );
    console.log(
      JSON.stringify({
        type: 'turn.completed',
        usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
      }),
    );
  }

  /** Emits controlled tool output from the real fixture file for evidence-boundary acceptance. */
  private observation(prompt: string): void {
    if (prompt.includes('READ_TOOL_OBSERVATIONS') && prompt.includes('Activity turn: research'))
      console.log(
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: 'observed-read',
            type: 'command_execution',
            command: 'cat source.txt',
            aggregated_output: readFileSync(
              join(process.argv[process.argv.indexOf('--cd') + 1]!, 'source.txt'),
              'utf8',
            ),
            exit_code: 0,
            status: 'completed',
          },
        }),
      );
  }

  /** Holds a real managed process at a test-controlled turn boundary, without an execution deadline. */
  private async checkpointGate(prompt: string): Promise<void> {
    if (!this.gate || !prompt.includes('Activity turn: planning')) return;
    writeFileSync(this.gate + '.entered', String(process.pid));
    while (!existsSync(this.gate)) await delay(10);
  }

  /** Selects only the first owner for tasks and reports no work during unchanged stewardship. */
  private direction(prompt: string) {
    const setup = prompt.includes('Workday setup:');
    const idle = setup || prompt.includes('Self-directed stewardship for');
    const correction = prompt.includes('Goal correction');
    const blocked = prompt.includes('Blocked task diagnosis');
    if (blocked && /RECOVER_BLOCKED|RECOVER_CYCLE|REPLACE_WORKFLOW/.test(prompt))
      return this.continuation(prompt);
    const owner = this.startingOwner(prompt, setup, idle, correction);
    return {
      status: blocked ? 'needs_clarification' : 'ready',
      summary: 'Controlled direction',
      selectedOwners:
        blocked || setup
          ? []
          : [
              {
                id: owner,
                reason: idle ? 'Reviewed owner; no action' : 'Starting owner',
              },
            ],
      rejectedOwners: [],
      questions: blocked ? ['Which authorized resolution should replace the blocked work?'] : [],
      assignments: idle || blocked ? [] : [this.assignment(owner, correction, prompt)],
      dependencyRetirementProposal: null,
      continuations: [],
      dependency: null,
      architectureProposal: null,
    };
  }

  /** Models owner selection at the external response boundary, including an explicitly injected mistake. */
  private startingOwner(
    prompt: string,
    setup: boolean,
    idle: boolean,
    correction: boolean,
  ): string {
    if (setup) return 'a';
    if (!idle) return correction ? 'c' : 'a';
    const assigned = prompt.match(/Self-directed stewardship for ([a-z]+)/)![1]!;
    return assigned === 'a' && existsSync(this.calls + '.wrong-owner') ? 'b' : assigned;
  }

  /** Selects only the retained failed supplier for a diagnosed continuation without replacing its intent. */
  private continuation(prompt: string) {
    const assignment = this.retainedDirection.state.find((item: any) => item.owner === 'c');
    return {
      status: 'ready',
      summary: 'Diagnosed supplier continuation',
      selectedOwners: [{ id: 'c', reason: 'Resume retained supplier scope' }],
      rejectedOwners: [],
      questions: [],
      assignments: [],
      dependencyRetirementProposal: null,
      continuations: [
        {
          assignmentId: assignment.id,
          ownerId: 'c',
          ...(prompt.includes('REPLACE_WORKFLOW') ? { replacementChangeType: 'refactor' } : {}),
          reason: 'Use the clarified retained scope; preserve all original acceptance criteria',
        },
      ],
      dependency: null,
      architectureProposal: null,
    };
  }

  /** Supplies bounded initial or corrective research without changing the external goal. */
  private assignment(owner: string, correction: boolean, prompt: string) {
    return {
      ownerId: owner,
      objective: this.assignmentObjective(prompt, correction),
      kind: prompt.includes('INHERIT_DOCUMENTATION') ? 'change' : 'research',
      changeType: prompt.includes('INHERIT_DOCUMENTATION') ? 'documentation' : 'behavior',
      acceptanceCriteria: ['Evidence-backed result'],
    };
  }

  /** Retains only scenario directives needed by the assigned worker rather than copying director history. */
  private assignmentObjective(prompt: string, correction: boolean): string {
    if (correction) return 'Additional goal evidence';
    const markers = [
      'READ_TOOL_OBSERVATIONS',
      'READ_ASSIGNMENT_EVIDENCE',
      'RECOVER_CYCLE',
      'INHERIT_DOCUMENTATION',
    ];
    const scope = prompt.includes('INVALID_REQUEST_SCOPE_AFTER_PLAN')
      ? 'INVALID_REQUEST_SCOPE_AFTER_PLAN'
      : 'INVALID_REQUEST_SCOPE';
    return (
      [...markers, scope]
        .filter((marker) => prompt.includes(marker))
        .map((marker) => marker + ': ')
        .join('') + 'Research the dependency chain'
    );
  }

  /** Requests additional owners during planning and completes resumed research with evidence. */
  private worker(prompt: string): any {
    const result = this.result();
    if (prompt.startsWith('Independent read-only verification.')) return this.review(prompt);
    const coordination = this.coordination(result, prompt);
    if (coordination) return coordination;
    if (
      prompt.includes('REPORT_BLOCK_ONCE') &&
      !prompt.includes('Use the clarified retained scope')
    ) {
      result.status = 'blocked';
      result.blockers = ['Required contract decision'];
      return result;
    }
    result.planUpdates = [
      {
        id: 'research',
        status: 'completed',
        evidence: ['source.txt'],
        explanation: 'Source inspected',
      },
    ];
    return result;
  }

  /** Selects planning and retained dependency coordination separately from ordinary research completion. */
  private coordination(result: any, prompt: string): any {
    const owner = prompt.match(/active component identity ([a-z]+) as fromComponent/)?.[1];
    const stage = prompt.match(/Activity turn: ([a-z]+)/)?.[1];
    if (prompt.includes('Correct rejected dependency requests'))
      return this.correctRequests(result, prompt);
    if (
      prompt.includes('INVALID_REQUEST_SCOPE_AFTER_PLAN') &&
      !prompt.includes('Dependency assignment states')
    )
      return this.afterPlan(result, prompt, stage!, owner!);
    if (stage === 'planning' && prompt.includes('LINK_EXISTING_WORK'))
      return this.linkExisting(result, prompt);
    if (stage === 'planning') return this.planning(result, prompt, owner!);
  }

  /** Reads the observed supplier identity and optionally supplies deliberately different caller terms. */
  private linkExisting(result: any, prompt: string): any {
    const observed = this.assignmentEvidenceValue;
    const entry = observed.manifest.assignments.find((item: any) => item.owner === 'b');
    const intent = JSON.parse(observed.artifacts[entry.artifact]);
    result.requests = [
      {
        ...this.request('a', ''),
        ownerId: intent.owner,
        assignmentId: intent.assignmentId,
        request: prompt.includes('CALLER_PURPOSE_LINK')
          ? 'Use supplier evidence for caller integration'
          : intent.objective,
        acceptanceCriteria: prompt.includes('CALLER_PURPOSE_LINK')
          ? ['Distinct delivery evidence']
          : intent.acceptance,
        ...intent.scope,
      },
    ];
    return result;
  }

  /** Corrects the entire rejected batch from observed host feedback without changing expected deliveries. */
  private correctRequests(result: any, prompt: string): any {
    const marker = 'Host admission feedback: ';
    const feedback = JSON.parse(prompt.slice(prompt.lastIndexOf(marker) + marker.length));
    result.requests = feedback.requests.map((request: any) => ({
      ...request,
      request: request.request.trim() || 'Research supplier evidence',
    }));
    result.inboxActions = feedback.actions;
    return result;
  }

  /** Emits initial supplier requests, a deliberate cycle, or the accepted retained research plan. */
  private planning(result: any, prompt: string, owner: string): any {
    if (
      owner === 'c' &&
      prompt.includes('RECOVER_CYCLE') &&
      !prompt.includes('Use the clarified retained scope')
    )
      return this.cycle(result);
    if (owner !== 'c' && !prompt.includes('Verified dependency deliveries:')) {
      result.status = owner === 'a' ? 'completed' : 'blocked';
      result.blockers = ['Needs supplier evidence'];
      result.requests = this.requestBatch(owner, prompt);
    } else result.plan = this.plan(prompt);
    return result;
  }

  /** Suspends actual accepted research work with an invalid dependency batch after planning has completed. */
  private afterPlan(result: any, prompt: string, stage: string, owner: string): any {
    if (stage === 'planning') result.plan = this.plan(prompt);
    else result.requests = this.requestBatch(owner, prompt);
    return result;
  }

  /** Retains a valid sibling so rejection must remain atomic across the entire deliberately invalid batch. */
  private requestBatch(owner: string, prompt: string): any[] {
    const requests = [this.request(owner, prompt)];
    if (prompt.includes('INVALID_REQUEST_SCOPE'))
      requests.push({ ...this.request(owner, 'valid sibling'), ownerId: 'c' });
    return requests;
  }

  /** Rejects one goal assessment until an additional observed assignment addresses the gap. */
  private review(prompt: string): any {
    const indexed = prompt.match(/^Captured acceptance criteria: (.+)$/m);
    if (indexed) return this.indexedReview(prompt, JSON.parse(indexed[1]!));
    const result = this.result();
    if (
      prompt.includes('REPLAN_GOAL') &&
      !JSON.stringify(this.assessment ?? null).includes('Additional goal evidence')
    ) {
      result.status = 'blocked';
      result.blockers = ['Missing goal evidence'];
      result.reviewFindings = ['Missing goal evidence'];
    }
    return result;
  }

  /** Returns explicit criterion coverage, including deliberate invalid evidence for acceptance regressions. */
  private indexedReview(prompt: string, criteria: string[]): any {
    const assessments = criteria.map((_criterion, index) => ({
      index,
      verdict: 'verified',
      evidence: ['source.txt'],
      explanation: 'Controlled observed source',
    }));
    if (prompt.includes('REPEATED_REVIEW_GAP')) return this.repeatedGap(criteria);
    if (prompt.includes('VERIFY_OMIT')) assessments.pop();
    if (prompt.includes('VERIFY_DUPLICATE')) assessments[1]!.index = 0;
    if (prompt.includes('VERIFY_UNKNOWN')) assessments[1]!.index = criteria.length;
    if (prompt.includes('VERIFY_GAP')) assessments[1]!.evidence = [];
    const deficient =
      prompt.includes('REPLAN_GOAL') &&
      !JSON.stringify(this.assessment ?? null).includes('Additional goal evidence');
    return {
      status: deficient ? 'blocked' : 'completed',
      summary: 'Controlled verification',
      criteria: assessments,
      deficiencies: deficient ? ['Missing goal evidence'] : [],
    };
  }

  /** Varies review prose without changing which acceptance criterion lacks evidence. */
  private repeatedGap(criteria: string[]) {
    const wording = 'Still missing observed acceptance at ' + Date.now();
    return {
      status: 'blocked',
      summary: wording,
      deficiencies: [wording],
      criteria: criteria.map((_criterion, index) => ({
        index,
        verdict: 'gap',
        evidence: [],
        explanation: wording,
      })),
    };
  }

  /** Requests the next owner without predeclaring the full chain to task intake. */
  private request(owner: string, prompt: string) {
    return {
      assignmentId: null,
      kind: null,
      changeType: null,
      milestone: 'delivered',
      fromComponent: owner,
      ownerId: owner === 'a' ? 'b' : 'c',
      request: prompt.includes('INVALID_REQUEST_SCOPE')
        ? ' '
        : (prompt.includes('RECOVER_CYCLE') ? 'RECOVER_CYCLE: ' : '') +
          'Research supplier evidence',
      evidence: ['source.txt'],
      acceptanceCriteria: ['Evidence-backed result'],
      reason: 'Dependency',
    };
  }

  /** Produces an actual blocking ancestor request before accepting the director's retained diagnosis. */
  private cycle(result: any): any {
    const request = this.request('c', 'RECOVER_CYCLE');
    request.ownerId = 'a';
    request.request = 'RECOVER_CYCLE: Research the dependency chain';
    result.status = 'blocked';
    result.blockers = ['Need ancestor delivery'];
    result.requests = [request];
    return result;
  }

  /** Supplies the required evidence fields shared by worker and verifier responses. */
  private result(): any {
    const result: any = {
      status: 'completed',
      summary: 'Observed source',
      blockers: [],
      findings: [
        { summary: 'Read source.txt', evidence: ['source.txt'], uncertainty: 'Controlled fixture' },
      ],
      activities: [],
      regression: null,
      reviewFindings: [],
      requests: [],
      plan: null,
      planUpdates: [],
    };
    return result;
  }

  /** Creates a valid minimal plan covering the captured research acceptance criterion. */
  private plan(prompt: string) {
    return {
      approach: 'Inspect source',
      assumptions: [],
      activities: [{ activity: 'research', reason: 'Establish evidence' }],
      questions: [],
      items: [
        {
          id: 'research',
          activity: 'research',
          result: 'Evidence-backed result',
          criteria: prompt.includes('Plan omits acceptance criterion') ? [0, 1] : [0],
          expectedEvidence: ['source.txt'],
          dependencies: [],
          status: 'pending',
          evidence: [],
          explanation: '',
        },
      ],
    };
  }
}
