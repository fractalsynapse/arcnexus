# Coordination sessions

The [contract](contract.md) defines the accepted persistence boundary. The
following intent supports #615 before behavior changes; it does not establish
implementation or live qualification. Workflow owns sequencing through its
[refinement lifecycle](../workflow/contract.md).

## Writer and child sessions — CO-21

Use the existing SQLite runs, events and rounds for one verified project.
Foreground refinement retains the project writer across sequential Plan,
Architect and goal sessions, including phase transitions and active approval
handling. Admit sessions through `Journal.child` on that writer. Each child has
its own logical task identity and journal; completing or closing it leaves the
parent writer and shared connection intact. Independent roots cannot borrow the
writer. Standalone commands retain their normal admission path.

Recovery uses the existing departed-writer reconciliation before a replacement
continues the retained invocation. It preserves observations from interrupted
ancestors and descendants. No additional scheduler, writer store or state
database participates.

## Invocation, round and inventory identity — CO-22

Reuse foreground cycle identities to distinguish attempts at one unfinished
invocation from a fresh invocation after completion. Journal the requested total
and the round, phase and goal position. Retrying the same command resumes the
first unfinished position with that total; a changed total is refused while the
invocation is unfinished. After completion, a subsequent invocation receives
fresh phase and goal identities even when its requested total and goal text match.

Reuse existing round storage to capture the exact approved priority-ordered
inventory after Plan and Architect. Keep that inventory immutable through an
interrupted Run phase. Capture a fresh inventory after the next round's Plan and
Architect. Namespace round selection by its consumer and refinement invocation
and round, so standalone task-run inventory cannot be selected as refinement
inventory or vice versa. Attempts retain the same logical phase or inventory-entry
task identity; identical goal text in a fresh round identifies fresh work.

## Recovery observations and decisions — CO-22, CO-23

Expose complete ordered child history through `Journal.childEvents` using the
same goal and scope used for admission. Before starting unfinished work, Workflow
reads retained phase and goal outcomes. If a child completed but its parent
crashed before recording completion, the successful child terminal observation
is sufficient to recover that position without repeating assessment or delivery.
Successful read-only planned and no-change assessments must remain recoverable
alongside task delivery outcomes. An interruption or pending decision is not
successful completion.

Retain exact proposals and their baselines, approvals and declines, complete
answers, goal outcomes, issues, branches, PR references and acknowledged file
checkpoints. An unanswered noninteractive gate remains durably pending. Interactive
answers and later invocations continue the same phase and round; elapsed time
cannot advance approval. A decline preserves submitted intent and accepted
authority. Reconcile uncertain external effects against their observations before
replay, preserving original acceptance and ownership.

Record the actual runtime identity used and retain validated runtime-adoption
observations at the existing safe boundary. A validated newer installed runtime
can continue retained progress. Workflow admits each phase or task against freshly
accepted staging authority and retains the approved in-run adoption boundary;
Coordination does not freeze authority for the invocation or authorize declarations.

## Descendant history intent — CO-REF-DESCENDANT-HISTORY

For Workflow consumers assembling retained phase evidence, the intended public
addition is `Journal.childTimeline(goal: string, scope: string): JournalEvent[]`.
This query is not implemented or demonstrated by this intent note. It reads the
existing connection without admission, writes, another store or a new cursor.
An unknown child returns an empty array.

Use the exact full goal and admission scope passed to `Journal.child` on the
parent journal. Child identity uses the same derivation: the full-goal digest and
the scope encoded with the parent's logical `taskID`. A logical task identifies
retained work; each `runs.id` identifies one attempt. The same goal in a different
scope or parent logical task is different work. A resumed parent retains its
logical identity, while a fresh completed invocation has a new identity.

Start with every `runs` row for that child `task_id`. Follow
`runs.parent_id` to children of those attempts, include every attempt sharing
each discovered descendant's `task_id`, and repeat through their children.
Both relationships are necessary: following only the current attempt loses older
findings, while following physical descendants alone can miss a later
continuation of a nested logical task. Select each resulting event once from
`events`, joined by `events.run = runs.id`, in global numeric `events.id` order.
The query must exclude the calling parent, sibling phases, other rounds, other
invocations and unrelated roots; matching goal text alone never widens its scope.

Return the canonical `JournalEvent` shape defined in the
[public entry](src/index.ts): `sequence` is the original event ID rendered as a
string, `run` is its originating attempt, `taskID` and `goalID` come from that
attempt, `parent` is its actual parent run when present, `timestamp` is the
recorded timestamp or honest historical null, and `observation` is the complete
parsed content. Preserve artifact references and correlation fields within that
content. Do not renumber, synthesize replay timestamps, invent parents or turn
old observations into new execution. Repeated reads expose the same acknowledged
prefix and any subsequently committed events, without duplicate sequences.

`Journal.child` continues to admit ordinary sequential children sharing the
writer. `childEvents` continues to return only the named immediate logical
child's unframed observations across attempts. `timeline` continues to return
canonical events for the receiving journal's own logical task across attempts.
Neither existing read gains descendant semantics. The new query requires no
schema change or historical rewrite: existing additive initialization retains
`task_id`, `parent_id` and timestamps, including null historical timestamps.
Only recorded relationships establish ancestry; absent historical relationships
must not be guessed.

Coordination records observations through `record` and atomically records an
attempt's terminal outcome through `finish`. Workflow owns the decision to
advance after reading a successful child outcome, including the crash window
between child completion and parent acknowledgement. Workflow also owns report
production, round isolation at admission and the actual nested Architect supplier
integration regression. [Execution](../execution/contract.md) owns checkpoint
and filesystem reconciliation: a checked edit is acknowledged after its checkpoint,
an answer is stored before continuation, and uncertain publication is observed
before replay. This read changes none of those boundaries or retained approvals,
issues, branches, PRs and answers. Historical interrupted outcomes remain visible.

Real SQLite regressions must create children through the public admission API,
close and reopen storage, and exercise nested interrupted attempts and later
continuations. Give attempts distinct findings, complete multiline answers,
explicit profile usage and terminal outcomes. Assert complete canonical records,
global ordering, unique sequences and exclusion of sibling phases, other rounds,
fresh invocations and unrelated roots, including equal goal text in different
scopes. Retain existing `childEvents` and standalone assertions. The supplier
handoff must identify this API, exercised public fixture usage and retained
verification evidence; deterministic results do not establish live acceptance.
No event cap, paging protocol, scheduler or duplicated evidence store is required.

## Evidence and derived reports — CO-24, CO-25

The journal and its referenced external artifacts remain the evidence source.
Preserve complete originating findings, answers, provider and tool observations,
correlations, terminal outcomes and recovery events. The existing observer follows
persisted events without a competing log store.

A readable round report outside source derives references to phase assessments,
exact guide decisions, goal outcomes, issues and PRs, checks, recovery events,
source and runtime identities, and delivered commits. Derive elapsed time and
provider-reported token usage by execution profile from the existing event-derived
measurements. Missing usage and unknown pricing or cost remain unknown.

Make completed-round findings and measurement references directly available as
observations to subsequent Planner, Architect and Director assessments. Preserve
access to their complete originating artifacts without previews, truncation,
paging loops or automatic profile substitutions. Reports are derived views;
objective and goal files do not become execution records or another evidence store.

## Evidence required

Real SQLite boundary scenarios must establish writer retention across sequential
children and transitions, refusal of competing roots during active gates, child
completion without parent release, and departed-writer recovery. Recovery scenarios
must establish unchanged-total resume and changed-total refusal, fresh completed
cycles, inventory isolation, and recovery of successful child completion before
parent acknowledgement. They must also retain exact decisions, outcomes and
historical observations for subsequent assessments. Documentation records intent;
deterministic evidence and the separate production refinement streak establish
their respective acceptance.
