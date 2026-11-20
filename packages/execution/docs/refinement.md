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
`TaskInput.refinement: true` and `TaskInput.scope: 'refine'` for a resumable
foreground cycle; Execution captures fresh staging authority and passes the
cycle flag to `Coordination.admit(remote, goal, fresh, scope, cycle)`. This
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
proposal and accepted authority. Objectives, goals and architecture retain their
human gates; routine implementation, check repair and verified staging integration
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
