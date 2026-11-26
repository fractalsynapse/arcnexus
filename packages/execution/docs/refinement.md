# Execution handoffs for refinement

This records implementation intent for #615 before Execution behavior changes.
It implements EX-REF-ADMISSION, EX-REF-RETENTION and EX-REF-OBSERVATIONS through
the [Execution contract](../contract.md), especially EX-7, EX-8, EX-17, EX-18,
EX-22 and EX-25 through EX-28. It does not establish delivered behavior or the
separate three-round live qualification.

The accepted supplier milestone `refine-coordination` provides the persistence
boundary described in [Coordination sessions](../../coordination/README.md)
under CO-21 through CO-25. Its retained task timeline records milestone completion
at sequence 27259 in run 101. This is a contribution to the same task candidate,
not a separately integrated release. Consume its public
[Journal and Coordination services](../../coordination/src/index.ts);
[Workflow](../../workflow/contract.md) owns round and phase sequencing.

## Admission and authority

[Execution.admit](../src/execution.ts) admits the foreground invocation through
the existing verified-project Coordination writer. Workflow supplies
`TaskInput.scope: 'refine'` for a resumable foreground cycle; Execution captures
fresh staging authority and passes the cycle flag to `Coordination.admit(remote, goal, fresh, scope, cycle)`. This
distinguishes an unfinished retry from a new invocation after a `refined` result.
Each sequential Planner, Architect or goal task is an ordinary child admitted by
`Execution.admit(input, signal, parent)`. Verify the parent belongs to the same
canonical project store before using `Journal.child`. Child completion, cleanup
and close leave the live parent writer intact. Competing foreground roots remain
refused through phase transitions and active approval handling. Standalone task,
planning and architecture commands retain their existing admission path.

For goal inventories, Workflow calls
`Execution.round(directory, namespace?)`. Omitting the namespace preserves the
standalone `task` inventory. Refinement selects a stable invocation-and-round
namespace such as `refine:<invocation>:<round>`; Execution forwards it to
`Coordination.round(remote, captureInventory, namespace)` so unfinished task
rounds cannot consume the captured refinement inventory.

Resolve freshly accepted staging authority at every phase or task admission
through [Execution.goals](../src/goals.ts)'s `stagingCapture` and the existing
preflight validation. The parent writer provides exclusion, not an invocation-wide
frozen authority snapshot. Validate required operations, handlers and runtime
availability before activation; accepting declarations cannot enable unavailable
capabilities. Record each child's actual source and runtime identity.

Retained tasks keep their original engineering acceptance, owner attribution,
proposal baselines and acknowledged checkpoints. Revalidate pending work and
affected evidence against current accepted authority before continuing. Legitimate
updates use the existing [approved adoption boundary](architecture-adoption.md),
including Architect prerequisite implementation. Historical activations keep the
authority and profile actually used; a candidate cannot authorize adoption.

## Inventory and successful-child recovery

Extend the existing `Execution.round` / `goalRound` handoff only as needed for
Workflow to select round storage by consumer, refinement invocation and round.
Standalone task-run records remain isolated. Workflow captures the approved,
priority-ordered inventory after Plan and Architect, retains those exact entries
through an interrupted Run, and requests fresh inventory after the next round's
assessments. Each captured goal reaches Direction even when its measures pass.

Workflow journals the requested total and first unfinished round, phase and goal.
The same unfinished invocation requires the same total. A completed invocation
permits new phase and inventory-entry identities even when text and total match.
Execution preserves the logical child identity across attempts and exposes
complete ordered `Journal.childEvents` for that same goal and scope.

Before replaying an unfinished parent position, recover the successful child
terminal observation. A completed read-only Planner mapping, Architect no-change
assessment or delivered goal must remain reusable if the process exited before
the parent recorded completion. A pending gate, interruption or failed result
cannot establish success. Workflow records the recovered position through the
same journal; Execution does not repeat assessment or delivery to fill that gap.

[HostTask](../src/index.ts) retains its normal checkpoint, workspace, publication
and cleanup responsibilities. Reconstruct acknowledged files from secured
checkpoints, preserve complete answers and findings, and reconcile uncertain issue,
branch, PR, push or merge effects through the existing recovery paths before
replay. A successful external delivery remains evidence even when parent
acknowledgment is missing. Do not create another task loop or recovery store.

## Gates, refusals and cancellation

Use the existing host clarification and exact-proposal decision receipts.
Noninteractive absence of an answer yields a durable pending outcome at the same
phase and round. Interactive answers and later invocations resume that position.
Elapsed time grants no approval. A decline retains the submitted intent, exact
proposal and accepted authority. Objectives and architecture retain their
human approval; routine implementation, check repair and verified staging integration
gain no additional gate.

Admission and operation refusals retain their exact diagnostics and prior
successful receipts. Changed requested totals, foreign parents, stale edits,
ownership conflicts and unavailable handlers do not advance the cursor or expand
authority. Cancellation stops active descendants, secures checked work, retains
the pending position and evidence, and removes only task-owned worktrees through
normal cleanup. Each session records its own terminal outcome; the foreground
observer returns one aggregate terminal result.

## Activation observations and runtime continuity

Use [HostTask's journal and artifact access](../src/index.ts) and the existing
[activation request path](../src/activation.ts) to make completed-round findings
and measurement references directly available to subsequent Planner, Architect
and Director assessments. Include them as observations without changing objective
or goal bytes, the canonical task identity or accepted criteria. Preserve complete
originating findings, exact guide decisions and answers, and authorized access to
their immutable artifacts. An index or report reference must not replace the
originating content with a preview, truncation or mandatory paging loop.

Workflow derives a readable round report in external application storage from the
existing journal and evidence. Execution supplies references to phase assessments,
guide decisions, goal outcomes, issues and PRs, checks, recovery events, source and
runtime identities and delivered commits. The report is a derived view, not a
second evidence store.

Forward complete ordered provider and local-tool observations, unknown raw events,
progress and measurement references through the existing observer while work runs.
Correlate phase, round, child and activation identities. Reuse event-derived
elapsed time and provider-reported token measurements by actual execution profile;
avoid adding nested durations or token subsets twice. Missing usage and unknown
pricing or cost remain unknown. Do not substitute profiles or impose capacity caps.

A later invocation using a validated newer installed runtime resumes retained
progress at the existing admission or approved adoption boundary. Record the
actual runtime used and the validated transition, reconcile uncertain effects and
revalidate affected evidence. Retain historical runtime identities. This requires
neither a supervisor nor an automatic runtime-upgrade framework.

## Completed-round consumption correction

This intent precedes the behavior change for EX-REF-ROUND-CONSUMPTION and
EX-REF-ROUND-RECOVERY. Its audience is the Execution implementer and the Workflow
consumer authoring the real prepared-request scenario. Retain the completed
`refine-execution` admission/recovery contribution and
`refine-workflow-implementation` round producer. The missing responsibility is
carrying their observations into the normal actor request.

The originating supplier finding from `refine-workflow` is retained in run 103's
canonical task timeline at sequence 42772:

> Workflow's real two-round prepared-context regression needs the existing Execution activation boundary to expose the completed parent refinement round to child assessments. HostTask invocationContext currently adds only the child's timeline and the first invocation does not include retainedEvidence; the completedRound belongs to its parent. A stub calling activate without a real Planner assignment cannot prove the production consumer and was removed.

Its exact question is:

> Provide the accepted public mechanism by which a normal Planner, Architect and Director child activation receives readable completed-round report, originating findings and measurement references from its parent refinement journal, and a realistic fixture exercising that mechanism. Preserve normal child admission and all originating evidence.

The complete finding, including its evidence collection, remains in that journal;
the original admission/inventory supplier request remains at its original identity.
This correction supplements EX-REF-OBSERVATIONS rather than replacing either
finding with a new diagnostic.

### Producer and consumer boundary

Workflow exports `CompletedRefinementRound` through its
[public entry](../../workflow/src/index.ts) and records
`{ completedRound }` on the foreground parent after retaining a report.
Its `invocation`, `round`, `report`, `findings`, `measurements` and `evidence`
fields are the public handoff described in the
[Workflow refinement guide](../../workflow/refinement.md#public-completed-round-handoff-for-execution).
The current producer derives complete canonical child and descendant frames using
`Journal.childTimeline(goal, scope)`. Findings and measurement entries are
canonical sequence identities, not file paths; the registered report contains
their full frames and the existing measurement projection. Do not invent
completion records in an Execution fixture.

Execution must discover completed-round observations from the verified project's
existing journal, including earlier completed invocations, and pass their report
and originating artifact references into the normal `HostTask.activate` context.
The live parent link supplies current-invocation context; it cannot alone discover
a previous invocation with a different logical task identity. Project-level
discovery belongs to Coordination's existing journal read boundary. Its current
`Journal.findings()` selects failures and repairs only, so it must not be described
as already returning completed rounds. Any necessary selection extension belongs
to Coordination and must retain complete observations and canonical identities.

Enrich the existing task evidence at the shared activation boundary before the
first provider invocation, on returning caller invocations and after reopening
state. Preserve explicit input evidence, the child's timeline and complete
clarification/research/supplier answers. An immutable index may organize references;
the current returning-caller-only `retainedEvidence` enrichment is insufficient.
Every discovered report and originating artifact must be directly readable through
`HostTask.readFile` and mapped read-file under the existing registered-artifact
authorization. Merely listing inaccessible sequence numbers or a parent task ID
does not supply the findings. Preserve complete originating content and answers;
do not replace them with excerpts, summaries or a paging protocol.

Planner, Architect and Director continue to build their real assignments and call
the same HostTask/Agent/Architecture request path. Workflow supplies ordinary
parented child admissions; consumers need no new activation flag, alternate prompt,
or private Workflow helper. Observations remain distinguishable from instructions
and acceptance. They cannot change goal bytes, owner scope, approved profiles,
pending proposals or recorded authority.

This section specifies the correction, not an implemented handoff. The inspected
`invocationContext` currently adds the child's timeline and indexes retained
evidence only when returning within its actor invoker. Parent/project completed-round
discovery and first-call exposure still require behavioral implementation and
evidence. Existing report production does not establish consumption.

### Discriminating public evidence

Use public `Workflow.refine` with real Execution/HostTask, Coordination SQLite
and a temporary committed Git project with explicit accepted staging, actor,
operation and provider bindings. Let normal Planner, Architect and Director
assignments produce the first completed round, with distinct findings, complete
answers and explicit profile usage. Read the observed registered report and its
originating references. In each second-round provider request, require the actor
to consume and cite a distinct earlier finding and its measurement reference.
Assert full answer contents and originating identities, rather than only finding
a report path in a request.

Complete that invocation and begin a fresh one in the same project store. Require
fresh phase/task identities and prior completed-round observations in the very
first Planner, Architect and Director requests. Preserve round/invocation identity
and canonical order, with each originating sequence represented once. A test must
fail when only the child's timeline, current observer frames or same-invocation
parent history is consulted.

Interrupt an actual assessment after distinct findings, a durable complete answer
and provider usage have been recorded. Reopen SQLite/Git and resume through
validated admission using an explicitly different installed-runtime fixture.
Verify retained completed-round observations, original task acceptance and owner,
acknowledged file checkpoints, exact answers and historical runtime attribution
alongside the new activation's actual identity. Reuse existing checkpoint and
approved-adoption fixtures for those unchanged effects. Keep successful-child
recovery without parent acknowledgment as a separate retained scenario; never
reassess a completed child just to regenerate context.

These controlled provider scenarios demonstrate prepared-request consumption and
state recovery only after their assertions execute. They do not establish native
model acceptance, independent assembled acceptance, staging delivery or the live
three-round streak. Unknown pricing/cost and unavailable usage remain unknown.

## Evidence required before behavioral acceptance

Focused public-boundary regressions must use real SQLite and Git for shared-parent
admission, competing-root refusal, fresh staging capture, namespaced inventory,
checkpoint and publication recovery, and successful-child/parent crash recovery.
Cover interruption in each phase and goal, pending and declined proposals,
unchanged-total resume, changed-total refusal and fresh subsequent invocations.
Controlled explicit provider fixtures must demonstrate complete prior-finding
consumption and runtime identity continuity. Reuse existing confinement,
cancellation, checked-edit, local repair, approved adoption and publication
regressions for unchanged machinery.

These deterministic observations support their engineering criteria. Mandatory
assembled verification, independent assessment and host-observed staging delivery
remain separate, as does the production `arcnexus refine --rounds 3` streak.
