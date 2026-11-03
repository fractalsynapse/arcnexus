# Managed lifecycle and CLI — issue 148

Status: accepted intent; implementation and qualification are incomplete. Phase three
remains blocked. This extends the verified minimal configuration foundation (#109).

## Product contract

One coordinator runs director, accountable engineering agents, independent verifier
and publisher. Normal execution uses real upstream services under captured authority.
`--simulate` uses real agents and actual engineering against isolated repositories,
persistent simulated collaboration services and retained release artifacts. There is
no `--live-mode` and no scripted-agent simulation option. Deterministic/recorded
campaigns belong in component acceptance tests through the normal test interface.

The project volume manages repository registrations, application-owned architecture
branches, SQLite state, candidates, evidence, artifacts and stable supervisors.
Identities survive relocation. Local checkouts remain attachable, never silently
moved or overwritten. Packages use qualified `platform/package` references and may
share repositories. One repository execution owner prevents concurrent writers.

Platform policies/standards and package-local component definitions compose into a
pinned multi-repository authority. The registry locates definitions without copying
their architectural facts. Explicit architecture transactions create validated local
commits; active executions retain their original authority. Journal multi-repository
transactions and refuse dispatch until uncertain mutations are reconciled.

## Public command families

Configuration provides get/update and preview/write schema migration. Platform and
package provide list/get/create/migrate/update/remove. Component and standard provide
list/get/create/update/remove. Schema-approved field patches are atomic, revision
checked, and cannot rename IDs. Missing creation intent is requested interactively
or reported as required input. No repository argument creates a managed local Git
repository; existing local paths attach and existing remotes materialize. Migration
never provisions a remote, force-pushes or discards divergent history. Removal only
unregisters inactive, unreferenced resources and retains source/evidence.

Workday provides start [package] [--simulate], status/pause/resume/stop [id], list
and get [--follow]. Task provides run [package] prompt [--async] [--simulate],
get/follow/pause/resume/stop/answer and list. Local shorthand remains when unique;
there is no mutable last-selected target. Following detaches on interrupt; attached
task execution cancels on interrupt. Async submission persists before returning.

Architecture provides validate [package] and inspect package component [prompt]
with research/document/design/implement/review/release intent. Inspection cannot
execute work or grant authority. Workspace provides prepare/list/get/cleanup with
safe disposable collection and optional workspace targeting. Test provides inspect/run
with package, component, level, category and tag selection. Delivery provides
list/get/approve/publish/promote. Approval binds an immutable revision and cannot
override provider reviews. Promotion creates a fresh real delivery from a simulation.

Shared CLI infrastructure supplies typed equality filters, search, stable pagination,
JSON output, event cursors and exit codes 0/1/2/130. Application services, not parsers,
own validation, authorization, transactions and lifecycles. Read operations do not
start hosts. Historical readers remain; retired command spellings explain replacements.

## Lifecycle and delivery authority

Capture mode/environment at creation and preserve them across recovery and handoffs.
Tasks use goal direction; workdays use director setup/escalation plus deterministic
fair rotation. Eligible stewards expand through inbox dependencies. Registry and
contract libraries project captured component authority, not maintained duplicate lists.
Safe task pause/resume reconciles unfinished work; answer handles needs-input explicitly.
Compatible tasks share a workday environment; incompatible modes remain isolated.

Host-bound MCP operations implement issues, comments, authorized delivery commits,
pushes and publication requests. Agents never supply trusted ownership/environment
identity. Keep credentials outside workers; deny mutation bypasses through commands,
HTTP, hooks or descendants. Simulation permits declared real research/dependency/model
access while isolating target upstream effects. Unsupported enforcement fails preflight.

Create issues before actionable engineering, record meaningful lifecycle comments,
and correlate dependencies. Durable operation identities prevent duplicate external
effects; uncertain results require reconciliation. Independent verification precedes
delivery acceptance; candidate changes invalidate stale acceptance.

The simulated provider implements real state transitions, conflicts, failure and
checks over local Git remotes and isolated artifacts. Live GitHub delivery implements
issues/comments/branches/PRs and staging merges only. Automatic merge requires an
explicit platform grant, unchanged verified head, green CI and satisfied review rules.
Otherwise retain approval-needed state. Never self-approve GitHub reviews, merge main,
or publish real tags/packages in this increment. Workdays may deliver repeatedly.

Promotion preserves simulation evidence, checks current real authority, reconciles
changes and repeats verification/CI/review before real integration. Simulation success
never substitutes for real-target evidence.

## Delivery priorities and gates

The accepted scope remains unchanged. The current development strategy supersedes
this plan's original small-slice delivery order:

1. Complete the production lifecycle, collaboration operations, persistent real-agent
   simulation, verified publisher and promotion as one coherent implementation batch.
   Include the minimum portfolio and command support needed to exercise that lifecycle.
2. Use the stable lifecycle for a useful ArcNexus improvement and for remaining
   interface work as soon as it is reliable. Record direct bootstrap work separately.
3. Finish composed authority, portfolio/CLI breadth, acceptance migration and supported
   container qualification, retaining every agreed phase-three prerequisite.

Follow [AGENTS.md](../../AGENTS.md) for implementation and verification cadence.
Write tests alongside implementation, use focused feedback, and run long suites on
the assembled batch instead of requiring a full cycle for each small increment.
Shared services and a qualified headless container remain included; HTTP, web
authentication and React follow in phase three.

Real self-development uses the production director and the actual project's eligible
component steward catalog. Give it a useful goal broad enough to require collaboration;
do not preselect participants, force dependencies or script direction. At least three
stewards, including one discovered during execution, must participate observably for
the multi-owner gate. If fewer participate, retain that honest result and choose a
substantively broader useful goal; never manufacture a team to satisfy the count.

Qualification must cover three/five-owner scheduling, mode isolation, task lifecycle,
CRUD conflicts/recovery, migration idempotence, optional/malformed guidance, external
effect deduplication, denied bypasses, publisher gates, promotion conflicts and container
restart/volume relocation. Preserve historical readers and checked source confinement.

Retain six real demonstrations: dynamic simulated task with at least three observed
stewards; useful simulated workday/inbox; full issue/comment/commit/push/PR/check/merge/artifact lifecycle; unfinished
work across pause/container interruption; denied real-target writes; and an actual
ArcNexus improvement simulated then freshly verified/promoted to real staging.
Report deterministic/native checks, CI, real-agent simulation and upstream integration
separately. Run affected test inspect/run suites, full suite, format/lint/type/build and
consolidated validation. Preserve documented code, ownership and 500/30 line limits.

## First slice: consolidated validation

Architecture validation includes distinguishable guidance findings alongside catalog
validation. Optional absent skills are valid; tracked malformed skills and unreadable
instruction files fail. Guidance validation remains structural, never semantic approval.
Read working guidance bytes (including tracked deletions) and identify that source
separately from the captured architectural revision. Retain a library-only required
skills option for callers whose declared policy requires an inventory.

Bootstrap this cross-owner wiring directly: guidance-validation owns metadata checks,
architecture owns catalog validation, and CLI composes their public results. Retire the
standalone guidance command after migrating its tests and declared operations/CI.

## Standards migration contract

Component schema six uses `standards`; schema-five `patterns` remains historical
inspection/migration input only after active fixtures migrate. Standard definitions
retain their existing identity and artifact/check contract under `architecture/standards`.
The v4 recipe migration feeds the same final v6 conversion; v5 converts without
re-authoring operations. Preview and write preserve owner scope by renaming exact
standard-directory/file ownership declarations with their artifacts. Mixed old/new
references or conflicting destinations require an explicit decision. Current catalogs
and prompts expose standards only; historical snapshots retain their original vocabulary.

## Upstream relocation

The architect transferred ArcNexus to `https://github.com/fractalsynapse/arcnexus.git`.
Update the active origin constraint and repository links to that location. Stable
repository identity, issue/PR numbers and captured historical execution evidence remain
unchanged; new runs capture the updated committed repository declaration.


## Captured validation operation

The platform's inherited validation operation invokes the consolidated architecture
and guidance command, with a declared build prerequisite (#165). Keep its stable
operation identity; replace the retired command in its one authored definition.
Built-program acceptance executes that referenced recipe's actual arguments and
checks both architecture and guidance results. A separately written CI command
is insufficient evidence that captured steward verification uses the current CLI.

The real #164 task exposed the stale recipe after its baseline test suite passed.
Its failed assignment and cancelled task remain evidence; do not alter its captured
operation definitions or replay the old check. A fresh task against the corrected
committed authority is required for the documentation delivery.

## Component resource increment (#173)

Implement `component list <package> [field=value...]` and
`component get <package> <id>` through a shared read-only application service.
This increment excludes mutations, multi-repository composition and publication.
Existing registered package resolution must work outside any source checkout.

The caller authorizes this bounded API design within the existing architecture
public boundary: export `ComponentResources` from
`src/library/architecture/inspection.ts`. Its constructor needs no arguments;
`list(target, query?)` and `get(target, componentId)` receive the existing
`Portfolio.packageTarget()` shape `{source, base, packageId}`. `base` is the captured
Git revision; it must not be confused with the portfolio resource revision digest.
Private implementation files are allowed, but no new public module declaration or
owner is needed. The CLI resolves registered targets; architecture owns catalog
loading, selected-package ancestry checks and safe component projections.

Use the public ResourceQuery implementation for equality filters, case-insensitive
search, pagination, revision tokens and cursor validation. Allow `id`, `type` and
`parentId` equality filters; validate type values against component types. Search
`id` and `purpose`. Keep its existing default of 50 and maximum of 100. Results
include the selected package and its descendants, never other package subtrees.
Expose architectural intent and resource identity/revision; omit machine bindings,
raw execution records and model evidence. Reads cannot start a host, alter source
or initialize missing execution storage. List accepts the common JSON/search/limit/
cursor options; get accepts JSON only. Reject irrelevant options and invalid inputs.

Preserve the existing combined unknown-or-ambiguous package InputError. The accepted
caller goal requires rejection of both cases, not a new distinct-diagnostic contract.
Unknown and out-of-package component lookups must also fail honestly. Do not add
unrelated compatibility requirements or treat this newly authorized service as a
pre-existing API that another steward must prove already exists.

One CLI assignment can own the end-to-end command goal and request the architecture
service as a verified dependency. Do not create a duplicate initial architecture
assignment for that same requested delivery. Use correlated clarification for an
incoming request when needed; routine method and implementation choices within this
specified boundary do not require new architectural authority. Additional eligible
owners remain available for actual missing capabilities.

Keep actual owned documentation, expected-red built-program acceptance, checked
edits, host verification and independent review. Earlier failed/blocked #173 tasks
retain their original criteria, partial work and evidence; this new contract does
not rewrite them or claim their incomplete assignments were delivered.

## Lifecycle implementation batch: durable external effects

The coordination store owns immutable live/simulation environment identities and
external-effect intents. Each intent captures run, assignment, operation, target,
authority digest and input digest before a provider can mutate anything. Reusing
an identity with different inputs is an error. An interrupted attempt remains
uncertain until the provider reconciles it; absence must be established before
retry. Completed effects return their retained results without executing twice.

Operations owns the provider boundary and its persistent simulated upstream model.
The same effect executor will serve real and simulated providers; environment
identity and operation destinations come from the host, never agent-supplied identity.
Provider state is separate from execution evidence so recovery can demonstrate a
provider mutation that completed before its host receipt was persisted.

These foundations alone do not enable `--simulate` or establish a live gate.
Production wiring, source/network confinement, real Git delivery, independent
verification and publication qualification remain required before exposing it.

### Development efficiency observations

- 2026-11-03: Repeated whole-suite regression attempts and CI cycles for small patches
  delayed lifecycle delivery. Batch implementation and use applicability-aware focused
  feedback; measure final qualification separately.
- 2026-11-03: Existing director catalog selection, sequential scheduling, checked edits
  and SQLite transaction support can be reused. Avoiding a second scheduler/director
  removes substantial implementation and qualification work.
- 2026-11-03: Historical evidence and runtime authority are distinct. Extending durable
  state without rewriting old run records keeps the recovery surface smaller.

Record subsequent observations with the concrete event, consequence and practical
adjustment. These notes are observations, not new process gates or timing claims.

The GitHub collaboration adapter uses the official
[issue](https://docs.github.com/en/rest/issues/issues#create-an-issue) and
[comment](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment)
contracts. Credentials are acquired only inside the host provider; redirects are
rejected. Correlation markers identify exact intents. An absent listing result is
not proof that a request never succeeded, so live recovery retains uncertainty
instead of automatically resubmitting a potentially duplicated mutation.

- 2026-11-03: Catalog validation resolves public modules from committed source.
  Declaring a new public module in the intent commit makes intermediate branch
  revisions non-executable until its implementation is committed. Keep intent in
  documentation first and commit executable boundary declarations with their files;
  avoid wasting test runs on an intentionally incomplete catalog.

- 2026-11-03: The first 13 focused lifecycle/provider tests ran against built modules
  with no failures or skips (229 ms test-process duration, excluding builds). They
  cover SQLite recovery, deduplication, destination/mode rejection, cancellation,
  controlled GitHub transport and assignment-bound collaboration input. This is fast
  development feedback, not integrated lifecycle or real-provider qualification.

Current batch checkpoint: environment/effect journals, simulated issue/comment
persistence, GitHub issue/comment transport and an assignment-bound MCP tool adapter
are implemented as shared library boundaries. They are not yet wired into task/workday
host dispatch. No `--simulate` command, Publisher, real Git delivery, promotion or
real-agent qualification is claimed by this checkpoint. GitHub transport tests use
controlled responses exclusively; no real upstream effect has been invoked by them.

Candidate accumulation now has an explicit environment dimension independent of task
versus workday mode. New captured environments cannot read another environment's
candidate pointer; historical unbound runs keep their original pointer format.
Continuation rejects a delivery from a different environment before restoring any
assignment. This preserves historical evidence without implicitly promoting simulated
changes into live work. Host creation of environments and CLI simulation selection
remain part of the pending wiring.

- 2026-11-03: Production `test run --tag lifecycle-effects` passed the 13 initial
  collaboration tests. Recorded commands spent 6.730 s building production code,
  4.109 s building tests and 1.171 s running the two selected test groups. Selection
  and confinement overhead are outside these command timings. Focused built-program
  execution is useful feedback without a full-suite round.
- 2026-11-03: Environment isolation required separating candidate pointers from the
  nearly 500-line execution store. The extraction kept candidate promotion inside
  the original assignment transaction. A focused built-program run covering store,
  inbox and provider behavior passed 34 tests, no skips, in 2.163 s excluding builds.

Latest focused feedback also covers three/five-owner scheduler behavior and prevents
reconciliation while a provider request is active: 40 built-program tests passed,
zero skips, in 2.457 s excluding builds. Build, test compilation and changed-file
lint passed. Reports now expose the immutable environment separately from run mode.
Long integrated suites, CI, native simulation enforcement, real-agent simulation and
real upstream integration have not been run for this batch. Phase three remains
blocked; these checks are not substitutes for the six real qualification gates.

Next integration dependencies: capture provider policy and environment at host run
creation; bind collaboration tools to actual steward sessions; create tracking issues
before engineering; implement verified Git delivery/Publisher and promotion; then
exercise the real director against the real component catalog. Complete remaining
portfolio/CLI/container work against that functioning lifecycle. Do not treat the
library checkpoint as a shipped task/workday simulation interface.

## Host collaboration integration

Upstream actions are shared operation definitions, granted through the existing
component `operations` policy with `agent` usage. A new `upstream` operation kind
names its provider action; it has no arbitrary command or URL. Required setup,
refresh and verification cannot invoke upstream mutation. The host resolves the
repository destination from captured workspace declarations and binds each tool to
its run and assignment. Task tracking is created after direction is actionable and
before engineering; workday tracking attaches to accepted bounded assignments.

Simulation mode must propagate into every prepared policy/assignment workspace and
operation sandbox. Ordinary operation network access is denied in simulation until
an explicitly confined download path is available; models remain host-connected.
A failed setup retains evidence rather than permitting unrestricted network access.
Real and simulated provider receipts share the durable effect protocol. Existing
runs retain their captured authority; newly granted operations affect new runs only.

### Host integration feedback — 2026-11-03

Task/workday CLI simulation selection now reaches the existing project host, scheduler,
director and steward sessions. Shared upstream operation grants determine which
assignment-bound collaboration tools are exposed. The host creates task tracking
once direction is actionable and workday tracking before a bounded assignment runs.
Simulation copies captured repository objects into independent source stores and
local bare remotes, including declared repository dependencies. Captured materialization
bindings preserve the architectural repository identity while validating the exact
source, revision, Git directory and fetch/push destinations. Authored bindings cannot
supply these host-private mappings.

- Fast: a focused native host acceptance run exercised real Git, SQLite and installed
  confinement with controlled model inputs: both initial scenarios passed without
  skips in 5.720 s, excluding builds. This exposed integration assumptions earlier
  than a long real-model run would. It is deterministic acceptance, not real-agent
  qualification.
- Slowdown found: workspace preparation assumed every checkout's origin was the
  architectural upstream. Removing origin from the simulated clone correctly exposed
  this assumption. Explicit host materialization bindings fix the mismatch without
  weakening ordinary repository identity checks or retaining a real upstream remote.
- Efficiency recommendation: continue testing boundary transitions (capture → prepare
  → direction → engineering) with focused built-program acceptance while implementing
  delivery. Reserve real-model time for the complete useful objective and retain its
  actual director choices; do not substitute scripted acceptance for that gate.
- Direct bootstrap work: host/CLI propagation, repository isolation and collaboration
  tool wiring were implemented by the supervising developer. These changes are not
  counted as ArcNexus self-development deliveries.

Additional native feedback passed: replacing the isolated push URL with an external
URL stopped host dispatch before an engineering activation. A network-enabled shared
operation in simulation was denied a POST from its child process to a real listening
local endpoint; the endpoint observed zero requests. This directly qualifies that
installed network boundary, not real GitHub authentication or the container deployment.
The three host cases passed in 10.786 s alongside a fixture-directory setup failure
in the new network test; correcting that test setup produced a passing isolated
network case in 3.228 s. No product check was weakened to resolve the fixture failure.

A propagation audit found that fresh director/verifier records copied workspace
configuration but omitted the immutable execution environment. This would have left
host-requested checks outside simulation's network restriction. The record factory
now carries environment identity, and nested-task acceptance checks every retained
engineering and independent policy record. Stewardship fingerprints also use the
isolated repository so candidate commits need not exist in the caller's object store.
These are concrete reasons to test the entire production wiring, not only the provider.

## Verified delivery implementation intent

The Publisher owns delivery policy and progression as a library service; release
continues to own this repository's shipping workflows. Coordination-store persists
immutable delivery identities, revision-bound approvals and ordered state changes.
A delivery's engineering verification, upstream integration and publication outcomes
are distinct. Creating or approving a delivery does not execute Git or satisfy a
provider check. Publication actions use the same captured-operation effect ledger;
no arbitrary command path or source-writable worker is introduced.

Deliveries retain their environment and exact source/candidate revisions. Host
capture must refuse missing independent evidence or a candidate different from the
reviewed result. Any reconciliation creates fresh verification requirements. Approval
names an exact immutable revision, and stale resource revisions fail before mutation.
Simulation promotion creates a different live identity and must repeat real-target
checks; neither approval nor promotion rewrites the original simulation.
