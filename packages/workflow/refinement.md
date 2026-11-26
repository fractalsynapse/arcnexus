# Continuous refinement implementation intent

This records intent before behavior changes for #615 and WFL-REF-SEQUENCE,
WFL-REF-RESUME, WFL-REF-LIFECYCLE and WFL-REF-REPORT. It elaborates WFL-9 and
WFL-12 in the [Workflow contract](contract.md), under CO-21 through CO-25 in the
[Coordination contract](../coordination/contract.md). It does not establish
implemented behavior, assembled acceptance or the separate WFL-10 live streak.

## Sequence and shared lifecycle

Expose the contract's public `Workflow.refine(directory, rounds, observer, signal)`
through [Workflow's public entry](src/index.ts). Commands supplies validated
transport-neutral input; CLI owns argument parsing and rendering. The default is
one positive integer round. Reject invalid, duplicate or unsupported arguments
before admission, without a safe-integer ceiling or other resource cap.

Use the canonical admission, observer, cancellation, cleanup and terminal lifecycle
already shared by `run` and `update`. Hold one foreground Coordination writer
through sequential Planner, Architect and goal child sessions. Inner completion
must not release the live parent writer; competing foreground roots remain refused.
Keep standalone commands. Reuse the normal task executor for Director, steward,
independent Reviewer and verified staging delivery. Remove superseded orchestration
rather than introducing another task loop, scheduler, worker lane or state store.

Every round invokes Planner, then Architect, then every approved goal in priority
order through Direction, even when its measures already pass. Plan and Architect
may justify no change. Capture inventory after both phases complete. Keep those
exact entries throughout interrupted Run recovery; capture fresh inventory after
the next round's new assessments. Namespace existing round storage by consumer,
invocation and round so standalone task rounds cannot consume refinement inventory.

Use the accepted `refine-coordination` supplier contribution, recorded complete
at run 101 timeline sequence 27259, as the persistence boundary for this candidate.
Its public [Coordination and Journal entry](../coordination/src/index.ts) supplies
foreground cycles, `Journal.child`, `Journal.childEvents` and namespaced round
storage. The [Coordination session guide](../coordination/README.md) describes
their intent. Retain the [Execution contribution](../execution/docs/refinement.md)
and its shared-writer, fresh-staging, checkpoint, observation and recovery work;
this milestone does not replace that machinery.

## Exact round counts and current-phase observations

This section records the intended correction for `refine-workflow-exact-rounds`
before its behavioral changes. It serves Workflow implementers and Commands/CLI
consumers, addressing WFL-REF-EXACT-COUNT, WFL-REF-EXACT-RESUME,
WFL-REF-PHASE-OBSERVATIONS and WFL-REF-EXACT-HANDOFF. The retained
`106-1693-owner-tests.log` exposes decimal rounding, rejection of larger valid
totals and missing Architect progress in the built CLI. Current
[src/index.ts](src/index.ts), [services](src/services.ts) and
[refinement sequencing](src/refinement-run.ts) use numeric counts and positions;
the round-entry progress call does not announce uninterrupted Architect and Run
transitions. This correction is intended behavior, not a claim that those
regressions pass. Existing completed Workflow contributions remain retained.

The public round-count representation is `RoundCount = string`, exported from
Workflow's public entry and reused by Commands. Its semantic value is a positive
base-ten integer. Accept only a nonempty sequence of ASCII decimal digits with
at least one nonzero digit; remove leading zeroes to obtain canonical form.
Thus `"0002"` and `"2"` request the same total. Reject zero, signs, whitespace,
fractions, exponent syntax and non-string values before admission. CLI supplies
`"1"` when the option is omitted and passes the decimal operand without a
Number conversion. CLI alone rejects duplicate/unsupported arguments. There is
no maximum digit count, safe-integer ceiling or finite-Number restriction.
For example, `"9007199254740993"` and a decimal one followed by 400 zeroes are
valid exact totals.

Normalize once at the public boundary. Persist new requested totals and current
rounds as canonical decimal strings in existing refinement journal observations.
Use exact integer arithmetic for comparisons and increments, converting any
internal bigint back to decimal text before recording JSON. Never compare,
increment or serialize these values through Number. Child scopes, inventory
namespaces, report identities and headings, progress messages and
`CompletedRefinementRound.round` use the same canonical round text. Goal array
positions and unrelated standalone round-store identifiers retain their existing
meaning; this change does not create a second cursor or store.

Read previously persisted numeric totals and round positions as legacy records.
A finite positive integral Number means the exact integer represented by that
stored Number, expanded to canonical decimal text without exponent notation.
Do not impose a safe-integer check that makes an existing record unrecoverable.
A rounded historical Number cannot reveal the original user's decimal operand;
do not invent those lost digits. Compare the normalized new request with the
interpreted stored value, and refuse a different total while unfinished.
Malformed historical positions yield an explicit diagnostic instead of a fresh
invocation or guessed position. Interpret legacy observations on read without
rewriting them, their authority or originating evidence. Retain already recorded
child and inventory identities, including their historical spelling, when
reconciling unfinished legacy work. A representation change cannot replay a
completed assessment or publication. New identities use canonical decimal text.

Before executing each Plan, Architect or Run phase, persist and expose
`{ refinement: RefinementProgress }` with exact `total`, `round` and current
`phase` through the existing ordered observer. Publish the corresponding human
progress naming round, total and phase through the same lifecycle. This applies
at uninterrupted transitions, resumed entry and before successful-child recovery.
The observation announces the position being entered, not completion of that
phase. Preserve the existing goal progress and completed-round observation.
Both event subscribers and progress-only callers must see Architect and Run
entry, including an empty Run inventory. Announce a phase before resolving its
retained successful child; reuse that outcome before any provider assessment
or delivery. Keep complete provider/tool observations, measurements and one
foreground terminal result through the existing observer.

Testing must first retain a meaningful failing public regression for this
correction. Use the existing real SQLite/Git refinement fixtures and explicit
providers: pause a huge-total invocation, reopen it with the same canonical
value, refuse a different value and preserve its first unfinished position.
Cover values above Number.MAX_SAFE_INTEGER and beyond finite Number
representation, leading-zero normalization, invalid input without admission,
legacy numeric continuation, and fresh identities after completion. Reuse the
existing multi-round, gates, inventory, publication and child/parent crash
scenarios; assert ordered phase entry on uninterrupted, resumed and reused-child
paths, including exact round strings in reports and completion observations.
A deliberate pause establishes exact large-total recovery without executing an
artificially capped subset or claiming completion of that total.

Implementation follows the retained red and demonstrates the same public
scenarios passing. The eventual complete supplier answer to Commands and
`refine-cli` must give the exported type, normalization, durable and legacy
interpretation, resume comparison, phase-event shape, exercised fixture paths
and actual evidence references. This documentation supplies the intended
handoff; runtime availability and that exercised answer belong to subsequent
Testing and Implementation, with assembled verification and staging delivery
remaining host responsibilities.

## Durable cursor and recovery

Persist requested total, phase, round and goal position in the existing journal
and round storage. An exact retry resumes the same invocation and first unfinished
position. Refuse changed totals while unfinished. Once complete, a subsequent
invocation obtains fresh phase and goal identities even when goal text and total
match. Preserve completed phases and goal outcomes across attempts.

Before replaying an unfinished parent position, read the complete retained child
history using the goal and scope used for admission. A successful read-only
Planner mapping, Architect assessment or delivered goal can finish the parent
position when the child succeeded before the parent acknowledged it. Record the
recovery and reuse that outcome without repeating assessment or delivery. Failed,
interrupted and pending outcomes are not success. Reconcile uncertain issues,
branches, pushes, PRs and merges through existing task/publication recovery before
replay.

Retain exact pending proposals and baselines, approvals, declines, submitted
intent, answers, issues, branches, PRs and acknowledged file checkpoints.
An unanswered noninteractive gate yields a durable pending outcome. Interactive
answers and later invocations continue the same phase and round; elapsed time
cannot approve. A decline preserves submitted intent and accepted authority.
Objectives and architecture use human approval; routine repair and
verified staging integration add no gate.

Each phase/task admission resolves freshly accepted staging authority. The parent
writer does not freeze authority for the invocation. Retain approved in-run
adoption, original task acceptance and ownership; validate implementation and
available handlers before using declarations. Record actual source/runtime
identities. A validated newer installed runtime may resume retained progress at
the existing admission/adoption boundary, preserving historical identities and
revalidating affected evidence. No runtime supervisor or upgrade framework is needed.

Cancellation stops the active child through the shared signal, retains the cursor,
answers, checked work and evidence, and performs normal task-owned cleanup. Each
session records its terminal observation; the foreground observer returns one
aggregate terminal result. Stream complete phase, provider/tool, progress and
measurement events through the existing observer. Human progress names round and
phase. Preserve unknown provider events and complete originating content.

## Public completed-round handoff for Execution

The following handoff and red-stage descriptions retain the original intent and
its historical availability statements. The current source exports the handoff
and implements refinement; the exact-count correction above extends that work
without discarding its retained evidence. These descriptions do not assert
current runtime unavailability or establish completed acceptance.

This is the target public handoff for the `refine-execution` supplier request.
Testing authors the public consumer scenario and records its expected failure at
the missing refinement boundary before implementation. Implementation then makes
that same scenario executable and demonstrates actual completed-round production
and later consumption before the handoff is offered to Execution as available.
Testing does not need a successful completed round from an absent public method.
No completed-round event or reusable refinement fixture currently exists in the
public entry. The existing
[goal-round scenario](tests/unit/goal-round.test.ts) covers standalone Run only;
the [observer scenario](tests/unit/run-observer.test.ts) covers forwarding and
measurement projection only. Neither establishes a completed refinement round.

Export a `CompletedRefinementRound` observation from `src/index.ts`, using the
same definition in the public `TaskEvent` union as
`{ completedRound: CompletedRefinementRound }`. Publish it only after all captured
goals and both phase outcomes have completed and the derived report is retained.
Its public fields have the following meaning:

| Field          | Meaning                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `invocation`   | Stable logical foreground identity across attempts; fresh after full completion.                                                       |
| `round`        | Round position within that invocation.                                                                                                 |
| `report`       | Registered external readable round-report artifact.                                                                                    |
| `findings`     | References to complete originating phase assessments, exact guide decisions and answers, and goal findings, in execution order.        |
| `measurements` | References to the existing event-derived measurements and their originating timeline records, including execution-profile attribution. |
| `evidence`     | Canonical evidence references for goal outcomes, issues/PRs, checks, recovery, source/runtime identities and delivered commits.        |

References identify complete immutable artifacts or canonical journal observations,
not previews or newly authored summaries standing in for findings. A report
organizes these references and explains outcomes; it does not replace them.
Empty collections mean no such observation was produced, never a fabricated
success or zero usage. Missing measurement values and unknown pricing/cost remain
unknown. Derive elapsed time and provider-reported token totals by actual profile
through the existing RunMeasurements projection; do not double-count nested
durations, cached-token subsets or repeated stream observations.

Execution consumes this public observation through the normal HostTask/journal
and activation-request path. It makes the complete originating findings, answers,
report and measurement references directly available to subsequent Planner,
Architect and Director assessments, including later invocations. Use existing
registered artifact access. Do not copy results into objective/goal files or build
another evidence store, preview, truncation or paging loop. Workflow owns producing
the observation; Execution owns carrying it into actual actor context. Consumers
must not import Workflow implementation helpers or invent a matching journal event.

## Deterministic consumer scenario

Use `new Workflow(services).refine(directory, "2", observer, signal)` from the public
entry, with real Execution admission/HostTask, Coordination SQLite and a temporary
Git repository with accepted staging authority. This is a scenario recipe for the
forthcoming public regression, not an available helper export. Execution can keep
its fixture on its own side of the service boundary; it needs no Workflow-internal
test imports or synthetic completed-round records.

Supply controlled explicit provider responses at the normal Planner, Architecture
and Direction/Agent ports. In the first round, return a justified no-change Planner
mapping, a justified no-change Architect assessment and evidence-backed Director
satisfaction for each captured goal. Emit distinct complete findings and answers
and provider usage under explicit profiles through the normal provider path.
Observe the resulting completed-round event via `TaskObserver.event`; read its
registered report and originating references through the ordinary artifact path.
Do not prepopulate either the completion marker or the report.

During the second round's Planner, Architect and Director activations, assert that
the actual prepared requests expose the first round's originating findings,
complete answers and measurement references. The provider fixture should consume
and cite a distinct first-round finding in each assessment, rather than merely
asserting that a report path exists. Observe a second completed-round event and
compare the public measurements to retained provider records, preserving unknowns.
This proves the handoff without requiring a guide or code change in every round;
it does not prove live model acceptance.

For cross-invocation retention, complete the invocation, start another through
the same public entry and storage, and require fresh phase/task identities with
the prior completed-round observations still available. For recovery, interrupt
after a child terminal event but before parent phase acknowledgement, reopen the
same SQLite/Git state, and retry with the same total. Require reuse of the observed
successful child and no repeated provider assessment or delivery. The fixture
must create that crash at a lifecycle boundary, not manufacture journal content.

Extend this scenario with approved guide delivery and ordinary task publication
using the existing Execution/publication fixtures. Keep deterministic provider
responses explicit; never substitute a default profile or claim live inference.

## Regression sequencing at the missing boundary

The retained owner-test log `101-2028-owner-tests.log` observes the public
refinement-boundary assertion failing because the method is absent. It includes
the same-total interrupted-invocation regression. Keep those scenarios and their
original observations; the expected failure establishes the missing entry, not
successful recovery, report generation or prior-finding consumption.

Testing adds meaningful public scenarios for the remaining acceptance before
behavior changes. The completed-round consumer scenario above initially fails at
the absent entry or handoff. Do not require it to generate a successful round
during that red stage, invent completion observations to proceed, or mark the
downstream assertions satisfied merely because an earlier assertion failed.

Implementation supplies the entry and handoff, then runs the scenarios far enough
to produce the first actual completed round, read every originating reference and
prove later prepared-request consumption. Correct ordinary fixture defects at the
accountable activity while retaining the original red evidence. A scenario that
cannot yet reach its consumer assertions remains unproven until those assertions
execute and pass. This sequencing changes no WFL-REF acceptance criterion.

The Execution supplier answer remains the documented target entry and recipe,
with availability explicitly pending. Once the genuine scenario passes, return
its actual public observation and fixture usage with the retained evidence to
`refine-execution`; Execution can then exercise its context handoff without
guessing event bytes. No private Workflow test helper is part of that handoff.

## Same-child continuation evidence

The report recovery regression must also stop an unfinished Planner child after
a controlled provider has emitted a distinct finding, a complete durable answer
and reported usage through native observation. Reopen Workflow, Execution and
Coordination against the same Git/SQLite state, resume that child with distinct
observations, then complete another round. Compare every originating sequence,
terminal outcome and measurement reference with canonical retained history, in
order. Repeated timeline prefixes must contribute once, and the next round must
exclude earlier usage. Keep successful-child-before-parent-acknowledgment recovery
as a separate scenario requiring durable reuse without another assessment.

## Nested lifecycle history

Completed-round reconstruction uses `Journal.childTimeline(goal, scope)` for
each admitted phase and captured goal. This public read-only query includes normal
nested Architect supplier and prerequisite tasks across all attempts. Merge by
canonical sequence identity in execution order; do not reconstruct origins from
immediate-child artifact lists. Retain the existing successful-child recovery path.

The nested regression runs Architect's real inbox, normal supplier task admission,
native provider observations and durable clarification answers against SQLite/Git.
Interrupt the supplier after reported usage, reopen all services, resume its logical
task and complete two rounds. Compare exact origin sequences, terminal outcomes and
explicit Planner/supplier profile totals with independently read SQLite history.
This rejects omitted descendants, omitted continuations, duplicate accounting and
prior-round carryover without manufacturing completion events.

## Required regression coverage and delivery boundary

Focused public regressions must establish multiple sequential Plan → Architect →
all-goal rounds, parent-writer retention and competing-root refusal, fresh
subsequent invocations, unchanged-total resume and changed-total refusal, gates
and declines, interruption in each phase and goal, and successful-child/parent
crash recovery. Cover immutable Run inventory and fresh next-round inventory,
prior-finding consumption and report/measurement reconciliation.

Use real SQLite/Git boundaries where recovery depends on them. Reuse existing
task, local repair, checked-edit, approved adoption, independent verification and
publication regressions for unchanged machinery. CLI/Commands regressions cover
parsing before admission, general JSON/JSONL observation and shared cancellation.
Behavioral regressions must first exhibit their meaningful expected failure;
existing accepted Coordination and Execution evidence remains retained.

The host owns assembled verification, independent assessment and one normal
issue-linked task PR's verified staging delivery. These documentation decisions
do not establish that delivery. The separate production acceptance is
`arcnexus refine --rounds 3`, with all phases and goals, useful approved guide/code
refinement, later use of prior findings and no operator edits, database repair,
bypassed checks or uncontrolled aborts. Execution-path changes restart that streak.
