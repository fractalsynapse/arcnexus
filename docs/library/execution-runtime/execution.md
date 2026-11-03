# General agent execution

Issue #78 records this approved contract. Normal execution uses the shared project
host; legacy component, two-owner manifest and proposal execution are retired.
Historical inspection remains available. Phase three requires the final deterministic
and live qualification recorded in the [qualification ledger](../../plans/general-agent-execution-qualification.md).

## Public interface

`arcnexus workday start|pause|resume|stop|status` resolves the current project and
package without arguments or options. `arcnexus task run "<prompt>"` captures an
external goal and performs internal planning automatically. Existing diagnostics,
component testing and historical report inspection remain available.

A workday rotates fairly through eligible stewards. Each considers its purpose,
objectives, questions and inbox, proposes bounded useful work or records no action.
An unchanged full pass becomes idle. Relevant deliveries, verified changes and an
explicit resume wake work; there is no repeated inference against unchanged input.
A no-work stewardship result may name the reviewed owner without proposing an
assignment. This records consideration, not task decomposition or verified delivery.

A task director selects starting owners and retains goal acceptance. Owners can
request additional existing package owners. A task pauses a running workday at a
safe checkpoint and resumes it afterward, unless a user pause/stop or integrity
problem intervened. Interactive task questions retain the same task; noninteractive
questions retain needs_input evidence. Additional tasks queue FIFO.

## Execution and authority

One background host owns each canonical repository and executes one activation at
a time. No participant count is hardcoded. Assignments, stewards, activations,
messages, dependencies and candidate revisions have distinct identities. A steward
may own several assignments. Durable delivery and readiness commit atomically.
Ready assignments use a persistent FIFO queue: a yielded continuation rejoins the
tail, and an already-ready assignment retains its place when unrelated state changes.
Dependency wakeups and clarification answers enter the same queue. Reopening the
store preserves that order; creation order alone must not starve later work.
The stewardship rotation also persists its last visited owner and continues after
that owner, even when an earlier owner receives new relevant input.

Requests carry originating assignment, recipient owner, purpose, expected outcome,
acceptance and required milestone. Acceptance is intent, not verified delivery.
Support nested dependencies, fan-out/fan-in, rejection, clarification and duplicate
delivery protection. Reject blocking cycles with retained evidence. Unrelated ready
work continues when another assignment is blocked. Unknown owners and expanded
authority require the architect; relationships aid discovery rather than grant writes.

Use isolated assignment workspaces and one accumulated verified candidate. Preserve
unfinished edits; reconcile against the current candidate without silent overwrite.
Recheck assembled changes before promotion. Workers cannot publish, switch branches
or commit. Captured architecture, instructions, checks and supervising build remain
stable; candidate edits cannot redefine active authority. Policy and goal-assessment
workspaces are materialized from the pinned verified revision, not a delivery
workspace that might have changed later. Validate retained policy workspaces before
reuse. An integrity mismatch preserves evidence and requires attention; it must not
automatically resume a paused workday.

Trusted checks come from captured project declarations. General assignments run
the owner’s declared checks followed by checks from containing package/platform
definitions, deduplicated by executable and arguments. Owner check indices remain
stable for regression references. Container checks apply to the assembled candidate
and cannot be omitted because the selected owner’s own checks passed. Behavioral changes retain
expected-red regression evidence; other assignment kinds use appropriate workflows.
A separate read-only verifier assesses acceptance against observed evidence. Task
completion additionally requires director assessment. If that assessment identifies
missing goal coverage after deliveries, return its findings to the director for
additional bounded assignments against the current verified candidate. Preserve
earlier deliveries and the original goal; no completed checklist waives the missing
criteria. Unresolved blocked work also receives director diagnosis, with required
clarification/architectural decisions retained explicitly. Missing proof remains explicit.

## Lifecycle

Workdays expose running, idle, pausing, paused, stopping, stopped, interrupted and
needs_attention states. Pause stops new dispatch and finishes the active checkpoint;
stop cancels promptly and preserves partial evidence. Repeated controls are idempotent.
A stopped workday cannot resume. Starting again may reuse compatible verified results,
but must not silently restart old unfinished assignments.

Remove work deadlines and turn/call/attempt quotas. Keep elapsed-time telemetry,
progress loop detection, cancellation, transport/cleanup safeguards and test watchdogs.
Obsolete executable limit configuration receives migration diagnostics; historical
reports remain readable. A missing model thread can be replaced from validated
checkpoint context with recorded provenance. An uncertain operation is never replayed.

## Delivery and qualification

Implement in verified slices: general scheduling; durable continuation/candidates;
automatic acceptance and tasks; persistent workdays; mode coordination and migration;
live qualification. Bootstrap the orchestration where the current runtime cannot
reliably implement it; use ArcNexus itself for bounded work as soon as it can.

Deterministic built-program acceptance covers three/five owners, nested and shared
dependencies, repeated owners, duplicate delivery, cycles/rejection, unrelated progress,
conflicts, restart transitions, controls, task/workday overlap, idle/wakeup and captured
authority. Run formatting, lint, strict typing, build, ownership/guidance validation
and affected component tests, then the integrated suite.

Live gates require a real three-owner prompt with dynamically discovered ownership,
self-directed verified improvement, inbox delivery, pause/resume, task interruption
and return, cancellation/recovery, and a real ArcNexus improvement under a stable
supervising build. Retain actual diffs, host results and independent verification.
Report simulation, local checks, CI and live evidence separately.

## Project defaults

Committed `architecture/execution.yaml` selects `directorProfile`, `reviewerProfile`
and optional `defaultPackage`. ArcNexus uses its `astra` profile for direction and
independent review; owners retain their declared engineering profiles. Local machine
bindings are discovered at `<git-common-dir>/arcnexus/bindings.yaml`; `tools.codex`
selects a local executable. Captured bindings and profiles are immutable per run.
The normal interface does not accept work budgets; obsolete configured budget fields
produce an actionable migration error. Unknown execution-default keys are rejected
rather than ignored; malformed package selectors and verification paths fail preflight.

## Inbox decisions

The general result contract exposes correlated inbox decisions independently of
ordinary boundary requests. Recipients accept, reject or ask clarification; the
originating assignment answers in a read-only control activation. The host records
verified delivery itself. A completed model turn with outstanding structured requests
still yields the assignment; turn status never implies dependency delivery. Requests may deliberately link an existing assignment and
specify accepted intent or verified delivery as their required milestone. An inbox
reply must match its captured sender/recipient identities. A clarification does not
restart engineering or mark the original assignment complete.

Requests may narrow the recipient assignment with an explicit work kind, change
type and writable paths. Null values inherit the originating work kind/change type
and the recipient owner’s declared scope; an empty writable list is read-only.
These fields can only narrow captured recipient authority. A request for an actual
artifact uses the delivered milestone; accepted is reserved for dependencies that
need only an agreed intent. Independent delivery verification is automatic and
does not require a worker to invent a reviewer-owner assignment.

Captured verification inputs remain stable even when an assignment edits tests or
check configuration. `verificationInputs` in `architecture/execution.yaml` declares
additional trusted source paths used by project checks; the host also captures the
owner's existing test sources and tracked command-argument files automatically.
When these inputs change in a candidate, the host reruns checks with their captured
source contents restored temporarily, retaining both candidate and baseline results.
Worker regressions and independent review remain additional, distinguishable evidence.

## Supervising runner capture

Before launching a background host, the client captures the installed distribution,
package metadata and installed dependencies in private application state. The host
and its managed helpers execute from that retained copy. Rebuilding the caller’s
installation cannot replace a running host’s modules. Capture compares content
hashes before and after copying and refuses an installation that changes during
capture. Host evidence records the retained runner location and content hash.
Machine-bound external executables remain separately identified by captured bindings.

## Correcting blocked work

Direction may propose an explicit continuation of an existing assignment, with its
run-local assignment ID, owner and diagnosis. Stewardship may do the same for its
own owner. The host validates retained checkpoints before reactivating work; the
proposal cannot change its objective, acceptance criteria, plan, owner or scope.
Uncertain operations, changed candidates and incomplete workspace transitions still
require attention. Completed deliveries cannot be reopened.

A known rejected routing outcome may be replaced by a new activation after its
diagnosis is retained. Original requests and failure evidence remain inspectable.
Dependents return to waiting for the original required milestone; continuation is
neither acceptance nor delivery. Only assignments blocked by the resumed dependency
are released from that propagated block. Other independent failures remain blocked.
This allows an accepted request to be clarified and a rejected cycle proposal to be
restructured without inventing delivery or silently waiving the goal.

Recovery includes read-only policy activations as well as engineering assignments.
An unfinished director, stewardship or goal-assessment record is retained as an
interrupted activation. Its run cannot resume dispatch while operation completion
or the policy checkpoint remains uncertain. A completed policy record does not
block recovery; the host still validates the candidate and engineering checkpoints.
Stopping retains the uncertainty and evidence with the old workday. Starting a new
run uses only a compatible verified candidate, never unfinished policy state.

An inbox or verified-delivery transition that makes work relevant to an idle
workday atomically wakes that run. Idle ticks without changed input remain quiet.
Incoming work cannot override a user pause, a stop, an interruption or an attention
state; those lifecycle decisions continue to require their normal control flow.

Read-only stewardship preserves captured read authority and existing writable
locations as read-only inputs. A declared future-write directory that does not yet
exist grants no additional read access and is not created for policy inference.
Explicit read declarations must still resolve, and symlink/path violations remain
invalid. This permits every eligible owner to participate in stewardship before
its first test or documentation directory has been created.

Cancellation is idempotent at terminal task outcomes (#107). A late cancellation
cannot rewrite completed verification, failure, interruption or attention evidence.
Queued/running tasks and tasks awaiting input remain cancellable; managed execution
still receives prompt cancellation.

Every new run captures an execution identity covering committed authority, package
selection and resolved local bindings (#108). Recovery, continuation and dispatch
must compare that identity with the host's captured context before any new work.
Missing or mismatched identity requires attention and a new run; retain the old
candidate and evidence without importing the new source revision. Historical terminal
outcomes remain readable. A still-running original host may observe source drift,
but its captured authority and candidate never change silently.

Supervising-runner snapshots preserve source permission modes on copied files and
directories, including empty generated directories. The destination hash and a
second source hash must still match the initial capture. An active umask cannot
make an unchanged installation appear to be a concurrent rebuild, and permission
normalization must not relax the source-change or byte-integrity checks.

### Correlated model inbox context

Model-facing inbox envelopes expose the durable request identity as `requestId`,
matching the reply schema. Internal retry keys remain in host persistence and
chronology evidence; they are not alternative reply identities. Resume rebuilds
this projection from the store, and acknowledgements validate the durable identity
and sender authority. Never reinterpret an arbitrary key as a request ID.

### Control transport waiting

Initial endpoint discovery retains a bounded stale-endpoint probe. Once a caller
sends a control request, it waits for that request's response or an explicit socket
disconnection. Checkpoint elapsed time is not a control failure, and the client
never replays a mutation whose outcome is uncertain. Task cancellation continues
through the attached task identity; process supervision still governs host loss.

### Strengthening an existing delivery wait

A requester can return a correlated inbox action `require_delivery` with the
existing `requestId` and an explanation. The host strengthens that existing edge
to verified delivery without requiring another copy of the recipient's objective,
acceptance criteria or write scope. It creates no assignment and does not relax
shared-request matching. The host checks sender authority and blocking cycles in
the same transaction; a rejected wait leaves the previous milestone and replies
unchanged. Retries do not duplicate work, and unrelated ready assignments continue.
Only actual verified delivery releases the wait; an acknowledgement cannot do so.

Dependency acceptance describes the recipient's bounded contribution. The overall
goal supplies context, but an owner's delivery must not depend on future requester
integration. The director assesses that assembled goal separately.

Model-facing inbox context also identifies each envelope as incoming or outgoing
relative to the active assignment, and includes current requester/recipient states,
the effective required milestone and currently available reply actions. These are
projections of the durable request, not owner-wide reply permissions. Completed
supplier delivery requires no acknowledgment or additional `require_delivery`
action. Reply validation remains transactional and authoritative even when retained
model context has become stale. Internal reply receipt identities stay out of the
model-facing projection, alongside request retry keys.

Dependency continuations carry assignment identity, owner, objective, acceptance,
status, required milestone and delivered candidate identity. Independent delivery
assessments retain their complete criterion conclusions and reviewed candidate
identity. They do not inline raw tool observations, command logs, retained thread
state or prior activation payloads. Full delivery evidence remains in the private
reports and in the independent verifier's paged evidence artifacts. This projection
prevents recursive evidence growth; it does not truncate acceptance criteria or
impose an execution quota.

Runner capture preserves source bytes and executable/directory modes under the
production operation sandbox. Mode repair is necessary only when copying changed
a mode; it must not issue redundant source-write operations against already correct
snapshot entries. The `host-lifecycle` test selection exercises background startup,
host-loss recovery and installation replacement through the shared executor.

Canonical host ownership is independent of temporary-storage and evidence-root
settings. The IPC endpoint uses a fixed private per-user directory under `/tmp`;
`TMPDIR` selects operation storage only. The exclusive host lease lives in the
canonical Git common directory, so another socket or linked worktree cannot start
another scheduler. Changes to temporary-storage settings must attach to the same
host and preserve its captured authority. Live task
`1be5cdf7-5c9f-4ccd-917d-a5150206b2bb` exposed the former duplicate-host defect;
its failed evidence remains retained and is not automatically replayed (#137).

The #137 local regression passes alternate-socket lease rejection, and all four
`host-lifecycle` cases pass through the shared executor, including a second CLI
with both another evidence root and another `TMPDIR`. Evidence is retained at
`test-runs/b256161f-80b7-48ab-9a49-d9b04d777f52`. Formatting, lint, strict checking,
build, ownership validation and guidance validation pass locally. This is deterministic
qualification; a new live self-development task must still produce its own delivery.

## Run queries independent of a terminal or checkout

`task list [field=value...]`, `task get <id> [--follow]`, `task follow <id>`,
`workday list [field=value...]`, and `workday get <id> [--follow]` read the
versioned execution stores directly. They never start a host, recover activations,
create absent state storage or change source. Retained runs remain observable after
host loss. Historical proposal/workday readers remain separate read-only views.

Lists use the common report query contract: allowlisted equality filters with AND
semantics (`id`, `status`, `packageId`), case-insensitive `--search`, `--limit`
from 1 through 100 (default 50), and opaque `--cursor`. Status values must be known
lifecycle states. A cursor binds its query and result revision; changed results
require restarting pagination rather than silently skipping or duplicating entries.
Reads include revision tokens. Missing or ambiguous run identities fail explicitly.

Following observes ordered, run-correlated events after exclusive `--after` cursors
and updated projections. It stops at terminal outcomes; interrupting the follower
only detaches and returns successfully. Waiting, paused and idle work stays observable.
SQLite snapshots keep persisted run, assignment and event records consistent; live
command progress remains a separately observed evidence projection. Read-only reopening
never migrates databases or replays uncertain operations. Runtime owns run discovery,
coordination-store owns persistence, report owns common filtering/pagination, and the
CLI only parses, renders and follows. Task controls build on this resource identity.

## Task lifecycle controls and retained supervisors

`task run [package] "<prompt>" [--async]` submits durably through the existing
project host. Explicit package targets resolve through the portfolio; local shorthand
is unchanged. Async submission returns the retained identity without waiting for
model execution or tying the host to the submitting terminal.

`task pause/resume/stop <id>` and `task answer <id> "<response>"` resolve the
retained run independently of the current directory. Pause records user intent and
finishes the active activation/checkpoint; paused work releases dispatch ownership.
Resume validates checkpoints, reconciles against the current verified candidate,
and retains the goal, accepted plans, dependencies and unfinished assignment files.
Stop cancels active execution and may also cancel paused/interrupted work. Answer
requires a nonempty response to an actual needs-input task. Terminal runs cannot
resume. Application controls support expected-revision checks at the host mutation
boundary; the CLI never fabricates authorization from a resource projection.

Recovery reuses the retained supervisor only after verifying its executable snapshot
and captured execution identity. It never replaces a retained run's supervisor with
the caller's newly built code. Unsupported older control protocols or unavailable,
changed or ambiguous recovery evidence fail explicitly. Historical runs remain readable.
A host loss marks incomplete activations interrupted before any resumed dispatch;
uncertain operation completion still requires attention. Following remains observation,
while interrupting an attached task submission retains its existing cancellation behavior.
