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

### Continued batch evidence and efficiency — 2026-11-03

- Nested simulated-task acceptance passed through three controlled fixture stewards,
  supplier requests, resumption, independent verification and final goal assessment.
  Its test took 46.544 s; all four selected host cases passed in 56.695 s. This is
  production wiring with controlled model inputs, not the real-director qualification.
- The post-extraction host/isolation feedback passed three selected native tests in
  5.811 s, with no skips. Extracting persisted run selection from the near-limit host
  kept lifecycle intent and candidate handoff rules together and allowed explicit
  database cleanup without compressing code to meet the line limit.
- Seven delivery-store/Publisher tests passed in 1.345 s. They exercise real Git
  candidate bytes, immutable capture, stale approvals, milestone ordering, rejection
  of changed source or missing review, and prohibition of automatic live releases.
  Provider receipts and reviewer outputs in these tests are controlled test inputs.
- The Publisher capture service now reuses the existing criterion-coverage validator
  instead of maintaining a second interpretation of independent acceptance. Git
  candidate comparison uses immutable trees: repeated internal snapshots can have
  different commit timestamps while containing identical reviewed bytes.

The Publisher currently captures and validates deliveries; Git/PR/release progression
and real promotion remain implementation work in this batch. Store transitions alone
are not provider effects. Workday setup now goes through the real director path before
fair rotation; empty setup/stewardship turns do not create tracking issues. Controlled
acceptance for this path is kept in the test system, never exposed as simulation mode.

An additional admission safeguard requires the captured host to advertise simulation
support before a client submits `--simulate`. An older stable supervisor must reject
this request rather than silently ignoring the new option and running against real
upstream services. Current supervisors continue to own retained runs; this guard does
not replace them mid-execution.

- Efficiency friction: formatted fixture constructors and inline scenario assertions
  repeatedly exceeded the 30-physical-line rule even when their behavior was small.
  Splitting repository setup, captured authority and assertions preserved readability
  and the current rule, but required extra edit/lint passes. Evaluate whether future
  guidance should distinguish declarative fixture data from procedural methods; no
  limit was waived during this batch.
- Fast: reusing the existing shared criterion validator and private Git snapshot
  implementation made Publisher rejection tests small and deterministic. Native Git
  delivery now uses the existing supervised executor and external-effect journal,
  rather than introducing another process runner or recovery protocol.

Publication authorization is one shared `upstream` operation with action
`delivery.publish`, a required target branch, and an optional explicit automatic-merge
grant. Its captured definition authorizes the fixed host publication workflow; agents
cannot substitute commands, branch heads or destinations. Provider-specific internal
steps retain that definition digest. Without an automatic grant, exact-revision local
approval is required; provider checks and review remain mandatory in either case.
Real default-branch merges, tags and package publication remain prohibited.

The simulated PR implementation now retains open/merged state, actual pushed heads,
check evidence and visibly synthetic provider review. Interrupted asynchronous checks
are journaled separately from completed provider receipts. Simulated merge assembly
uses actual Git trees and a private commit, then requests fresh independent assessment
before compare-and-swap integration. Controlled native acceptance passed five PR/merge
cases in 8.796 s; this tests provider behavior with controlled check outcomes, not the
real-agent or container gates. The production check adapter uses captured owner checks
through the existing confined operation service and independent verifier.

Simulation publication now has a composed host workflow for actual commit/push,
PR/check/review/merge and content-addressed release artifact retention. Its focused
native acceptance retained a pending PR across the exact-revision approval boundary,
then completed all seven effects without repeating checks on retry (4.245 s process
elapsed). Separate PR/release cases passed seven tests in 15.128 s. These use controlled
check inputs; actual independent model qualification remains a distinct gate.

Network qualification found a productive supported path: installed Codex
0.163.0-alpha.10.2 permits an allowlisted registry GET with its managed proxy, and
`permissions.<name>.network.mode="limited"` rejected HTTPS POST to a disposable local
TLS server before the server observed a request. Sources:
[permission enforcement](https://learn.chatgpt.com/docs/permissions) and
[configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
This is a disposable probe, not yet whole-runtime qualification. Capture narrowly
allowed download domains in the existing operation network field; simulation must
never interpret a boolean network grant as unrestricted external access. Retain the
read-only method policy and test direct/proxy-bypass attempts before enabling it.

Efficiency: actual local Git/provider acceptance is inexpensive enough to run while
assembling publication (seconds). Investigating the installed proxy before building a
custom download broker avoided a second networking implementation. A command initially
used an incorrect compiled-test path; reuse test inspection output for selection
instead of reconstructing build paths from memory.

Delivery resource reads and exact-revision approval now use shared application services;
built-CLI acceptance exercised them from outside a checkout. Explicit publication is
queued on the original host, which continues to serialize it with engineering work.
The declared Publisher grant targets staging and does not grant automatic merge;
local approval therefore remains a real lifecycle checkpoint. The artifact operation
packages the actual built CLI and captured architectural declarations.

Native network coverage established HTTP reads, HTTP mutation rejection, direct
connection rejection, and explicit HTTP 403 for an encrypted mutation before any
request reached the controlled TLS endpoint. A self-signed local TLS read returned
502 even with a fixture CA setting; no general conclusion about private CA support
is drawn. That extra read was separated from the encrypted-mutation test. Public
registry TLS reads succeeded in the disposable installed-runtime probe. A Node fetch
attempt in the TLS fixture timed out, so the TLS bypass assertion uses an explicit
child curl direct connection with a required connection-denied result; the separate
HTTP case retains the Node descendant check. No real upstream writes were attempted.

Efficiency observations: source/static checks found one formatting omission left in
the prior store-test commit; the smallest correction was formatting that metadata
block. The long-rule overhead continues mainly in orchestration and fixture setup;
extracting cohesive publication, selection and resource responsibilities keeps the
500/30 limits without compressing procedural code. The remaining live-provider and
promotion work must reuse the durable effect protocol rather than add another runner.

Committed-catalog validation caught a shared Git fixture imported through another
owner's private test directory. The fixture now belongs to the testing component and
has a declared public test-support entry point. This preserves reuse without exposing
an operations-private implementation. Cheap prevention: move reusable fixtures into
testing ownership when the second owner first consumes them, before catalog capture.

Real production submission against revision `3a01d33` retained task
`a551795d-1f96-4d62-9380-32cb8ab8afaa` in
`~/.local/state/arcnexus/qualification-148-3a01d33`. It correctly captured all 21
eligible project stewards, but stopped during setup before director selection: concurrent
npm downloads produced a mix of successful GETs and HTTP 403s. No engineering or
real-agent qualification is claimed for this attempt. The same tarball downloaded
successfully in a single confined request. A fresh disposable installation through
`SourceConfinement` with `npm ci --no-audit --no-fund --maxsockets=1` installed all
191 packages in 8 seconds. Capture that connection-concurrency safeguard in the one
setup operation; it is not an agent execution budget. Preserve the failed run and start
new authority rather than silently replacing its captured configuration.

Live-provider work will reuse a repository-scoped GitHub transport for collaboration
and publication. Preserve redirect refusal, host-only credentials, full pagination,
exact-head merge admission and explicit provider review/check evidence. API sources:
[GitHub PR operations](https://docs.github.com/en/rest/pulls/pulls) and
[branch protection](https://docs.github.com/en/rest/branches/branch-protection).

The next real submission, `69ddd63f-4f56-4675-8dda-4e46f82b9e52`, also
stopped before director selection at captured revision `5e6ba12`. Its evidence is
retained under `~/.local/state/arcnexus/qualification-148-5e6ba12`. The successful
single installer probe did not establish reliability: `--maxsockets=1` still
produced mixed HTTP 200/403 responses. A focused request-body probe exposed the
actual denial: `Sandbox policy blocks local/private network addresses.` Public
DNS lookup returned public registry addresses. Both desktop Codex
`0.166.0-alpha.6` and dependency Codex `0.166.0` reproduced the install failure;
this does not establish a universal runtime defect or justify disabling the guard.

Bootstrap intent: qualify sequential lockfile-based cache preparation followed by
an offline install within the unchanged source/network confinement. Keep the
lockfile authoritative, retain integrity checks, reject unsupported dependency
sources before download, and fail on any individual download error. Do not retry
uncertain engineering or replace the failed run's captured authority. If this
approach qualifies, one declared setup operation will invoke it; no new scheduler,
network broker or alternate installation authority is needed.

Efficiency observation: capture the HTTP response body in a bounded disposable
probe when a package manager reports a generic transport error. Repeating full
real-agent launches concealed the useful error and consumed setup time without
reaching a model. An isolated native preparation check is the cheapest useful gate
before the next expensive lifecycle submission.

Operation failure reports must identify the declared operation and retained log,
not merely the confinement wrapper executable. Preserve the raw command evidence
and cancellation/uncertainty classification while adding this diagnostic context.
This closes the observed need to search entire run directories for an installer
failure that the normal task result currently describes only as a Codex exit.

Two fresh confined installations using sequential cache preparation completed,
each installing 191 packages offline in approximately four seconds after cache
preparation. Total cold preparation takes approximately two minutes; this is a
measured startup cost, not a reason to widen source or network authority. The
bootstrap acceptance controls only npm's external process boundary and covers
platform selection, deduplication, offline installation, pre-download rejection
and failure propagation. Native shared-executor coverage passed six combined
cases with zero skips in 2.842 seconds before the bootstrap type-check refinement.

A portability check exposed that this host's Node 22.22.1 was compiled without
TypeScript stripping (`ERR_NO_TYPESCRIPT`). Keep the pre-install bootstrap as
strictly checked JSDoc JavaScript rather than introducing a compiler dependency
before dependency installation. This is a narrow, documented bootstrap exception;
TypeScript remains the application and test language. Also retain a private copy
of the qualified Codex executable for the next run: the desktop-managed executable
changed since the previous qualification, so its mutable installation path cannot
by itself establish a stable supervising tool binary.

The private-runtime submission `a56c22a1-e00f-4a45-97fd-0fedca94b6f6`
exposed a separate preflight defect: `NetworkQualification` omitted captured tool
directories, while ordinary operations and filesystem qualification already included
them. Its sandbox could not re-execute the private Codex binary. Extend the existing
external-binding acceptance to include allowed-network qualification and pass the
same captured tool roots to the network canary. This is a missing integration check,
not an installation or model failure. Preserve the failed task and its exact log.

Next live-publication boundary: create or reconcile a GitHub PR only for the
host-captured verified delivery branch and exact pushed head. Check repository,
branch and default-branch exclusion before mutation, retain an intent marker,
reject mismatched/duplicate observations, and keep absent uncertain PRs uncertain.
This provider adapter does not itself authorize merge, submit reviews, or publish
packages; those require the separate captured-policy, current-check and review gates.

Revision `50f0051` passed native preparation and reached the real director in task
`5ff1df6a-a50a-4d28-b12a-877586459338`. The director selected report, publisher and
CLI from the actual catalog, with ordinary dependency routing left to the workers.
This is planning evidence, not three executed/verified steward deliveries. The
retained director prompt is 749,798 bytes; its turn reports 372,482 input tokens,
186,112 cached input tokens and 1,499 output tokens. Review catalog/context
serialization for repeated material before future qualification, without changing
this run's captured inputs. Full cold dependency preparation is also repeated for
each isolated assignment; investigate integrity-checked package-cache reuse as a
separate optimization rather than disabling independent checks.

Foundation suites passed through the actual `test run --component foundation`
service, including confined preparation and selected built-program execution.
GitHub PR provider tests passed seven controlled HTTP cases in 0.210 seconds:
creation, exact-head/default-branch refusal, conservative recovery, duplicate reuse,
and existing collaboration behavior. These are deterministic provider-boundary
checks, not real GitHub publication or complete live Publisher wiring.

The report steward's baseline revealed a distinct installed-runtime/Node interaction:
under `network.enabled=false`, `spawnSync('git', ['--version'])` returned exit code
zero and actual Git output but also `EPERM`; a Node child's socket-backed stdin
arrived empty. This explains both registration failures and lint tests accepting
empty input. A focused probe with the managed proxy enabled, limited mode and an
empty destination allowlist preserved the same subprocess results and stdin.
Qualify this deny-all proxy configuration with actual direct-connection and
HTTP/HTTPS mutation tests before replacing the no-network adapter path. No domain,
private-network exception or unrestricted route is being granted. Reference:
[permissions](https://learn.chatgpt.com/docs/permissions), which distinguishes a
proxy with no allowed domains from unrestricted network access without the proxy.

The director also retained a warning that the private executable copy lacked its
Code Mode helper. Copy the complete installed binary bundle for the next run,
retaining the failed/incomplete environment unchanged. Issue #201 records the
preparation-qualification gap. Do not treat a valid director plan as proof that
its worker tool runtime is complete.

A local full-suite attempt found stale compiled suites under the preceding test
layout (`.test-build/assignment` and `.test-build/operations`) alongside current
owner directories. The broad Node glob executed obsolete suites; stop that attempt
without counting it as current acceptance. Fresh simulation workspaces did not
contain those stale outputs. Make test compilation clear its disposable output
before compiling, using the existing build utility rather than a second cleaner.
This directly prevents duplicated/obsolete execution after source moves and avoids
mistaking a dirty local artifact tree for current product behavior.

The measured catalog repeats 238,614 bytes of raw consumer relationships alongside
240,137 bytes of grouped imports, and repeats 57,666 bytes of inherited standard
snapshots. Compact consumer observations with the existing source/symbol-preserving
grouping and project shared standard snapshots once in whole-catalog director
context. Keep every eligible owner, public API, ownership boundary and relationship
available; do not narrow the team or raise the existing context-size acceptance
threshold. The authoritative catalog remains unchanged by its model projection.

The clean confined suite isolated another measured cost: catalog ownership acceptance
launches 21 built `inspect` processes, rebuilding the full real-project catalog for
each owner. Replace those duplicate reads with one complete built `validate` result;
retain equality with all declared owner IDs and the assertion that every source file
has exactly one owner. This preserves production CLI coverage and ownership acceptance
while removing repeated compiler/catalog construction. The combined native proxy and
stdio regression passed six cases, zero skips, in 7.803 seconds.

The corrected build-output, ownership and model-context acceptance passed five
cases with zero skips in 16.898 seconds. The complete ownership assertion now
uses one built validation call (16.720 seconds alongside context analysis), instead
of the old per-owner loop that was still running when the full-suite test watchdog
expired after 300 seconds. That timed-out suite is not counted as passed. Native
confinement checks established stdin, exit-status and network-denial behavior
separately. Full formatting, lint and strict checks passed before these final
context/test-output changes; refresh the affected checks on the assembled revision.

Measured current model projections retain all 21 owners: individual component
contexts total 637,259 bytes, and the shared-standard director catalog is 581,926
bytes. These are catalog projection sizes, not model token counts or a promise of
identical inference cost. The earlier 749,798-byte figure was the complete retained
director prompt, so do not report a percentage comparison between those different
artifacts. The next real turn will provide comparable full-prompt and usage evidence.

The clean confined suite completed in 166.840 seconds: 462 passed, eight failed,
and 334 were skipped. Seven failures attempted host Unix-socket listeners from
inside operation confinement. Classify those existing bridge/admission scenarios
as native-host checks and execute them there without removing their assertions;
do not grant operations host-socket authority to make tests pass. The remaining
failure expected an obsolete operation list without the declared `comment-issue`
capability. Refresh that exact expectation. Strict type checking and consolidated
architecture/guidance validation passed at this preparation checkpoint.

All seven socket-dependent scenarios passed natively with zero skips in 1.508
seconds. The affected experiment acceptance passed three cases with zero skips
inside confinement in 25.982 seconds. These focused results resolve all eight
failures from the clean suite; the confined lane now explicitly excludes the seven
native-host cases, whose evidence remains required separately. This classification
change does not relax operation confinement or remove acceptance coverage.

Next publication batch: obtain provider-computed PR review, mergeability and
current-head check state through a fixed repository-scoped GraphQL query. Keep
credentials in the existing GitHub transport, reject partial/error responses,
and expose observed readiness as evidence rather than inferring readiness from
local approval. Missing CI, pending reviews, stale heads, draft/conflicting PRs,
and default/main targets must prevent staging integration. The eventual merge
operation must recheck the exact head after fresh independent assembled verification
and use GitHub's expected-head merge contract. No endpoint may submit a review or
publish a real tag/package. Provider-unit coverage is distinct from live wiring
and real upstream qualification.

The GitHub collaboration/PR provider checks passed ten deterministic cases with
zero skips in 0.214 seconds. A read-only authenticated request against existing
`fractalsynapse/arcnexus` PR #200 confirmed the production GraphQL query: merged PR,
head `d3218e0b336e1a57d63b47e0cbd611d947d3312f`, successful check rollup,
unknown merge state and null review decision. No upstream mutation was attempted;
this proves the observation transport, not live publication or promotion.

The next real simulation is task `cb53dbe7-7be0-4553-89cf-b4b02237a4f5`, source
`9e910d330c35bc05cb146be6a38bd9ad9aec8116`, retained under
`qualification-148-9e910d3`. Preparation completed and the real director started
with the complete private runtime bundle. The useful delivery-evidence goal is
unchanged, and no steward roster was supplied. Publication development proceeds
against the checkout without replacing that run's captured supervisor.

The new director prompt is 587,554 bytes, versus 749,798 bytes in the previous
retained director run (21.6% smaller). Both directors selected report, publisher
and CLI themselves. New turn usage is 628,524 input tokens, 464,896 cached input
tokens and 1,478 output tokens across its investigation; those cumulative turn
counts are not a per-prompt size comparison. The complete bundle removed the
missing Code Mode companion error. The retained deprecated Landlock-setting
warning remains diagnostic noise, not evidence of failed native enforcement.

Formatting, repository lint and strict type checks passed after the readiness
batch. Shared readiness uses provider aggregate check/review state rather than
manually paging and reconstructing a parallel rule engine. The next remaining
publication boundary is connecting checked live Git delivery and exact-revision
integration; readiness alone does not close that gate.

While the real report steward prepares, complete component create/remove through
the existing configuration transaction service. Creation supplies schema version,
stable identity and selected package parent; callers must supply meaningful type,
purpose and ownership. Removal deletes only the definition, never maintained source:
remaining files, dependents or registered container references must make complete
catalog validation fail. Both operations use repository leases, immutable proposed
commits, optimistic revision checks and the same journaled authority selection as
updates. No caller checkout is edited and no active run gains the new authority.

Component create/remove passed all 12 portfolio cases (51.503 seconds); the eight
existing update/recovery cases also passed (88.633 seconds). Strict typing and
scoped lint passed. Reusing configuration transactions avoided another persistence
or mutation framework. Repeated CLI fixture startups dominate these acceptance
suites; preserve representative built-CLI coverage while moving future input
matrix expansion to the shared service boundary where it tests the same contract.

The real task's first worker baseline completed 804 cases in 141.982 seconds:
453 passed, 10 failed, 341 explicitly skipped. All ten failures involve fresh CLI
or catalog discovery inside the isolated worktree rejecting its local simulation
origin against the declared upstream. The original-checkout confined suite cannot
cover this difference. Stop task `cb53dbe7-7be0-4553-89cf-b4b02237a4f5` and retain
its records before another owner repeats preparation. No engineering model ran.

Fix child discovery by recording a host-created, read-only materialization snapshot
in the linked worktree's private Git metadata. Fresh CLI processes must validate
that exact worktree, HEAD, common Git directory and origin mapping before using it;
do not rewrite declared upstreams or loosen ordinary origin checks. The snapshot
is outside maintained source and cannot redefine captured runtime authority. Add
isolated-worktree built-CLI acceptance before another expensive real submission.

The new isolated-worktree discovery regression passed two built-program cases in
2.324 seconds. It also exposed that local `validate` formerly omitted automatic
bindings entirely, while legacy assignment inspection supplied empty bindings.
Normalize those reads to the same discovered binding path instead of adding a
simulation-only CLI flag. Qualification must now exercise a complete isolated
worktree baseline before spending another director turn. The prior confined
checkout check was insufficient because its real origin concealed this difference.

The native production-host simulation setup case also passed with zero skips in
5.023 seconds, including fresh discovery of the prepared worktree snapshot.
Type checks and affected lint passed. This is controlled-input acceptance, not a
real-agent completion gate. Retain that distinction when the full isolated baseline
and next genuine model run are reported.

The first complete isolated run exposed a regression in automatic bindings for
offline local validation: 420 passed, 50 failed and 341 skipped in 164.115 seconds.
Those failures require restoring the existing ability to inspect unbound catalogs,
not changing fixtures or skipping tests. Keep automatic materialization discovery
on assignment inspection, registered validation and test selection; preserve
offline `validate` without explicit bindings. The discovery acceptance now uses
built platform registration, which resolves actual repository identity without
requiring a model-executable assignment fixture. Draft PR #202 starts CI
for the assembled batch; it is not ready for integration or a phase-three gate.

The corrected discovery regression passed two cases with zero skips in 2.422
seconds, and five offline/unbound validation cases passed in 4.827 seconds.
The fixture now exercises built registration rather than growing unrelated
execution policies merely to test repository identity. PR #202 is a draft; its
first CI result is a failure and must be diagnosed separately from local evidence.

The corrected complete isolated verification passed at
`7f3c192952fa8218c2102d0a463324c459431e95`: 470 tests passed, zero failed,
341 native-lane skips, 165.185 seconds. All eight captured report verification
operations passed through the production executor, including types, build, test
compilation, full suite, consolidated validation, report suite, formatting and lint.
Evidence root: `/tmp/anx-isolated-baseline-XBlLqF`, record
`0b2b05f4-56ce-491d-848e-c5bd78e60c56`. An earlier disposable probe invoked an
uncompiled test glob and returned zero tests; that empty result was not accepted.
The final qualification used the complete declared operation plan, including
preparation, rather than the probe's abbreviated command.

Real task `9da40468-af92-4484-9410-bfb5000a5e4b` now runs on that exact source,
retained under `qualification-148-7f3c192`; environment
`716de42e-7976-4879-86a1-0b27c16004b5`. The director completed and engineering
preparation began. CI run `41766922624` on draft PR #202 is separate and pending.
The previous CI run `41766387710` failed on the same now-corrected offline
validation regression. GitHub staging currently reports no branch protection
and no branch rules; this does not remove ArcNexus verification or approval gates.

Next live-provider boundary: push only a host-captured verified commit to the
generated `arcnexus/<delivery-id>` GitHub branch. Validate its tree, base parent,
and delivery attribution before credential access; construct a separate private
bare transport repository so candidate Git configuration and hooks cannot affect
publication. Keep credentials in the host Git transport environment, out of argv,
logs and worker environments. Refuse changed remote heads and do not force-push.
Reconcile uncertain publication through the actual remote ref; missing uncertain
results remain unknown rather than authorizing blind replay. This transport is a
prerequisite for live Publisher wiring, not a claim that promotion or staging
integration is complete.

The live Git transport passed three focused compiled tests with no skips in
1.090 seconds, including actual local Git object transfer, exact-head reuse,
conflict rejection and separation of push credentials from preparation. These
are controlled-provider tests, not a real GitHub delivery. Strict type checking
and scoped formatting/lint passed. The report steward in real task
`9da40468-af92-4484-9410-bfb5000a5e4b` passed its baseline and retained planning
checkpoint `03543276-c9cd-4624-932d-c245a1ee9f7d`; publisher preparation followed
through the normal scheduler. No verified engineering delivery exists yet.

Efficiency observation: repository preparation and the complete baseline recur
for each assignment even when the candidate revision is unchanged. Preserve
isolation, but investigate reuse keyed by captured authority, tool bindings,
operation definitions and candidate content after observing the complete run.
Do not skip checks or change this active supervisor to accelerate qualification.
CI `41766922624` passed its built-CLI test step and entered native qualification;
that remains separate evidence from the real simulation.

The next shared boundary extracts deterministic verified delivery commits from
simulation transport. Both environments must use the same captured tree, single
base parent, immutable attribution, stable metadata and private-ref recovery;
only transport and provider effects differ. It must not change a checkout, stage
source, execute hooks or grant publication authority. Existing simulation Git
acceptance must continue to pass after adopting this shared commit service.

Shared commit qualification passed all 16 affected native Git/provider/publication
cases with zero skips in 25.755 seconds. Simulation still exercises actual local
push, conflict handling, approval and release; the new live commit case exercises
real supervised object creation and recovery without contacting an upstream.
One initial run used newly compiled tests against an older distribution and failed
on the changed diagnostic; it was discarded. Build the distribution before test
compilation/execution when using focused Node commands, or use the built test
service that manages preparation. This is a cheap ordering check, not a reason
to repeat the entire integrated suite.

While the real lifecycle progresses on captured authority, finish standard CRUD
through the existing configuration transaction service. Standards retain stable
IDs, explicit owner/document/check references and schema-approved fields. Create,
update and remove must validate the entire resulting library, reject stale resource
revisions and referenced removals, and leave attached checkouts untouched. Reuse
the same repository lease, journal and configuration branch as component updates;
do not introduce a second mutation engine or silently create missing documentation.

CI run `41766922624` passed the confined built suite but failed native qualification:
324 passed, 59 failed, zero skipped, 1011.611 seconds. The retained diagnostics
show `Missing optional dependency @openai/codex-linux-x64` when fixtures copy
`/usr/local/bin/codex`, which is the npm JavaScript launcher rather than the
self-contained native executable expected by those fixtures. Correct the CI
binding to the installed ELF binary and validate its version before the expensive
native lane. Do not relax confinement or skip the affected tests. This repeats
the executable-bundle class of failures tracked in #201; inspect packaging at the
binding boundary rather than letting dozens of downstream cases rediscover it.

The real publisher specification turn produced its intended failing regression,
but the assignment failed because the agent-operation catch matched a human error
message prefix. Adding operation identity to diagnostics invalidated that match.
Record `d56a81bf-81c9-4b22-9343-55482d9f41d5` retains the actual assertion and edits.
Replace prose-based classification with structured observed-exit metadata, preserve
fatal host verification and cancellation, and cover the agent operation boundary.
The active supervisor remains unchanged; this run is diagnostic evidence, not a
successful self-development delivery. Safe pause qualification is in progress with
report's real unfinished diff and checkpoint hashes retained.

Safe pause/resume of real task `9da40468-af92-4484-9410-bfb5000a5e4b` retained
identical SHA-256 hashes for report's unfinished 6486-byte patch and checkpoint.
The task reached `paused` after its active turn, then returned `running` via the
captured supervisor CLI. Publisher and CLI both encountered the observed-test
routing defect (#203); the run is not a successful delivery gate. Standard CRUD's
three built-CLI acceptance cases passed with zero skips in 59.165 seconds, covering
source preservation, invalid references, stale revisions and inherited references.

The resumed real run reached an honest `needs_input` director outcome after all
three assignments failed. Report attempted to change captured test selection and
was correctly rejected; publisher and CLI encountered #203's expected-red routing
bug. The director asked whether to retain partial candidates for recovery or use
fresh attempts. Preserve this run and all edits as diagnostic evidence, stop it,
and use a newly qualified captured supervisor for fresh work. Do not hot-patch
active authority. The metadata fix also needs to cross command-supervisor IPC and
replace prose checks in host expected-red and correction handling; executor-only
coverage missed these additional consumers. A retained controlled reproduction at
`/tmp/arcnexus-workflow-maK0Xh` isolated the host red-test failure after the agent
operation itself had correctly returned its nonzero result.

The corrected structured failure path passed three native production MCP/cancellation
cases with no skips in 48.685 seconds. The fix carries observed-exit metadata across
supervisor IPC, operation diagnostics and host expected-red/correction handling;
prerequisite failures cannot masquerade as the requested agent check. A separate
observed-exit/cancellation test passed. The public `test inspect/run` selection for
operations lifecycle effects passed 20 confined cases with 15 explicit native-lane
skips (record `fe16ff61-51ff-4633-8cc4-25255813c6dc`); the affected native Git/publication
cases were qualified separately. Full formatting, lint and strict checks passed
for the assembled batch; newly changed failure consumers require their focused
correction checks before another real model submission.

The remaining native baseline/refactor-review/corrective-diagnostic cases passed
three of three with no skips in 50.965 seconds. Five regression-selection and
observed-exit checks passed in 0.364 seconds. These establish expected-red and
correction routing without allowing failed mandatory verification to count as
completion. The next assembled source must pass isolated production verification
before spending another director turn. Keep the same useful architect-facing goal;
do not force a steward roster or weaken inherited test metadata to manufacture the
three-owner or dependency-discovery gates.

At `dbb2ce9`, complete isolated suite execution observed 475 passes, two failures
and 343 native-lane skips in 185.524 seconds. Both failures were release acceptance
assertions still requiring the old npm launcher path; production behavior and the
other suites passed. Update those assertions to require native executable discovery,
version checking and the shared exported binding. Run the four release cases and
remaining checkpoints; retain unchanged suite evidence instead of repeating the
whole baseline for this test-only correction. Efficiency lesson: CI YAML belongs
to release, so its cheap structural acceptance must accompany changes even when
the motivating defect appears in operations. Track this coverage miss with #201.

Fresh real task `26f75a70-fb8d-4354-b8e4-709149154c34` captures `ee36ef0` under
`qualification-148-ee36ef0`, environment `91b80566-2c4c-4d03-9143-9d519902057e`.
The actual director selected report, publisher and CLI; report preparation began.
No roster was supplied. Four updated release cases passed in 0.229 seconds, and
remaining isolated validation/report/format/lint checkpoints passed. CI
`41772180248` is the latest separate run.

Next live publication foundation: share immutable merge assembly and supervised
Git evidence between simulated and live providers. Assembly must take an exact
captured target head and verified delivery head, preserve conflicts, pin a private
merge object and never update the target. Transport retains responsibility for
fetching approved objects and atomically checking target identity at integration;
only checked assembled objects may advance. Keep provider mutation and permission
checks outside this reusable local object operation.

Shared merge assembly passed 18 native Git/provider/publication cases with no
skips in 19.882 seconds. Live-mode assembly retained the verified bytes and exact
parents without changing checkout or upstream; retained-object substitution and
cancellation were rejected. Existing simulated conflicts, integration, approval
and release behavior remained covered. The shared command path removes duplicate
commit metadata and supervision setup. This is controlled-provider evidence,
not live upstream integration or promotion qualification.

Next publication batch connects verified live deliveries to host-managed commit,
HTTPS push and GitHub PR creation through the existing durable effect protocol.
Both modes share effect identity, uncertainty recovery and milestone persistence;
only provider adapters differ. Live observations of CI/review remain refreshable,
not permanently cached mutation receipts. No GitHub review is submitted, and no
main/tag/package operation is exposed. Staging integration remains blocked until
exact-target assembly, fresh independent assessment and provider gates can all be
established. An explicit publication request can refresh pending provider gates
without repeating a completed commit, push or PR. Tests substitute only external
transport and use real local Git and SQLite. This is bootstrap work while the
seventh captured real simulation continues independently.

Live publication orchestration and unchanged simulation publication passed three
native acceptance cases with no skips in 5.530 seconds. These used actual local
Git, supervised processes and SQLite; only HTTP/remote transport and verification
inputs were controlled acceptance boundaries. CI changed from pending to success
without repeating checks, push or PR creation; failed verification prevented all
upstream requests. This is not real GitHub integration evidence. Sharing the
effect protocol removed duplicated recovery code while keeping the provider
behavior explicit. The ongoing real-agent run now has two publisher dependencies
on report and CLI; that is real dynamic assignment creation, not yet discovery
of an additional owner or verified delivery.

For live staging integration, the host must first read provider gates, capture the
exact target revision, assemble the two-parent result and independently verify it.
Reobserve CI/review and both heads before transport. The transport may advance only
the captured non-default branch to that assembled descendant: no rewritten history,
branch deletion or alternate ref is authorized. Use Git's explicit expected-ref
lease as compare-and-swap protection in addition to proving the target is the
assembled commit's first parent. The lease is not authority to force a non-fast-
forward update. Reject a changed target, missing provider gates or server policy
rejection; never override GitHub rules. Reconcile actual target ancestry after a
lost receipt instead of repeating an uncertain merge. No real release is added.
See Git's `--force-with-lease=<refname>:<expect>` contract in
https://git-scm.com/docs/git-push; implicit tracking-ref leases are not sufficient.

CI `41772180248` passed formatting, lint, strict checking and the confined built
program suite. Native qualification observed 377 passes, eight failures and zero
skips in 908.891 seconds. Remaining failures assume the old pre-director workday
activation sequence: wait for an engineering gate after dispatching only setup,
look for a stewardship record after only setup, or assert idle/failure before
its activation. Update these scenarios to observe persisted lifecycle state and
execute actual director setup, without bypassing it or increasing arbitrary
waits. This 15-minute feedback cost reinforces the value of focused native
lifecycle cases whenever dispatch ordering changes. Keep the real simulation's
captured supervisor untouched.

Live integration passed five native publication cases with zero skips in 16.502
seconds, including a target change during verification, a concurrent ancestor
update immediately before push, and receipt loss after a real local merge. The
explicit expected-head lease rejected the ancestor race that ordinary fast-forward
push would permit. Lost-receipt recovery reused the actual pinned target without
rerunning checks or mutation. Three existing GitHub transport cases and complete
simulation publication also passed in the preceding seven-case run (8.373 seconds).
These remain controlled-provider acceptance, not real GitHub staging integration.

Issue #204's four affected native suites now pass all 18 cases with zero skips in
48.110 seconds. The tests execute actual director setup and assert initialization
before the engineering/policy condition under test. No production lifecycle code,
confinement boundary or timeout was weakened. State-driven idle observation replaces
an assumed four-tick sequence. This focused reproduction was far faster than another
15-minute full native run; the assembled CI still needs a new current-head result.

Observed remaining efficiency cost: the seventh real task runs the same inherited
full-package baseline for separate assignments, including a second report assignment
created by publisher dependency routing, before any candidate delivery changes.
One CLI baseline alone ran 820 tests (477 pass, 343 native skips) in 179.596 seconds.
Consider reusing successful baseline evidence only when candidate, captured authority,
operation definition, resolved arguments and confinement/tool bindings are identical.
Owner-specific checks and checks after changes must remain independent; do not relax
this run's captured acceptance or substitute skip counts for evidence. No cache change
has been made to the running supervisor.

Container readiness next requires orderly supervisor shutdown, independent of any
HTTP server. SIGTERM/SIGINT must close mutation admission, stop new dispatch, cancel
and drain the managed activation, persist interruption and release IPC/database
ownership. This is host interruption, not an explicit user stop or a completed task;
terminal outcomes and manual pause/stop intent remain intact. Reuse existing recovery
and operation evidence; never replay an uncertain command. There is no application
drain deadline. Docker may still kill a host at its external shutdown boundary, where
existing parent-death supervision and next-start recovery remain required.

A default Docker probe using image `arcnexus-qualification:node22` (image digest
26381efc3c7e7a60601ac4577c64e5c240cf00d81a5294380c44d4090809c9fb), Node
22.23.4, `--network none`, observed no writable cgroup mount and no bundled Codex.
This is a failed prerequisite of that configuration, not a statement that container
execution is unsupported. No privileged or unsupervised fallback was attempted.

The seventh real CLI activation failed on an update with omitted `content`. The
advertised edit schema allowed that shape; later untyped semantic rejection killed
the activation before source mutation. Fix the contract to require replacement
content for create/update, and return typed pre-transaction request rejection so a
steward can correct syntax in the same turn. Keep authorization, frozen tests,
filesystem aliases and uncertain journals fatal. Retain the exact failed request
and its clean source evidence; do not hot-patch the captured real supervisor. The
report steward continues independently and has reached its regression stage.

Orderly host shutdown passed 14 native host-loss, signal, mode-control and retirement
cases with zero skips in 52.919 seconds. Actual background hosts received SIGTERM
and SIGINT while managed engineering was active; processes exited and interrupted
state was visible before a replacement host started. Twelve durable inbox cases
passed in 0.215 seconds, including interruption leaving a dependent waiting while
unrelated ready work completes. Splitting activation admission/drain into its own
small class kept the project host below the 500-line limit without compressing code.
Container deployment qualification is still separate from this native evidence.

Issue #205's schema and checked-edit bridge regression passed nine cases with no
skips in 0.747 seconds. The exact omitted-content shape is rejected without source
or journal changes, then a corrected request commits. Existing owner/stage/frozen
regression protections, identity/stale conflicts, filesystem alias prevention and
crash recovery remain covered. Typed schema failures distinguish invalid input
from unavailable trusted schemas; no diagnostic-prefix parsing was introduced.
The actual running supervisor remains unchanged and its failed CLI evidence stays
retained. The report worker has meanwhile passed observed expected-red verification
and entered implementation, providing real evidence for #203's corrected routing.

Container probe follow-up: Docker 29.9.1 with its systemd cgroup driver passed all
three process-scope tests (0.515 seconds) using a dedicated `arcnexusq148.slice`
subtree, read-only application/runtime mounts and private tmpfs. The default
seccomp profile denied Bubblewrap namespace creation. A pinned Moby default profile
plus the namespace/mount syscalls required by the inner sandbox permitted userns
creation, then the unchanged `docker-default` AppArmor profile denied mount
propagation (`Failed to make / slave`). This isolates two deployment prerequisites;
it is not a passed container confinement gate.

Prepare a dedicated, reviewable AppArmor profile based on Moby's existing container
restrictions, allowing inner namespace mounts while keeping outer capabilities
dropped and source/runtime mounts read-only. Do not change docker-default, disable
AppArmor, run privileged, or expose all host cgroups. Loading this separate named
profile needs host administrator authentication, which this session lacks. Keep
static parsing and actual enforcement qualification distinct.

The dedicated container profile passed AppArmor syntax parsing without loading a
kernel policy. The seccomp generator fetched the pinned Moby revision, verified
its SHA-256 and reproduced the earlier probe's exact policy bytes; scoped ESLint
and formatting passed. This is policy preparation, not native enforcement or
container recovery qualification. Keep the required administrator load separate
from ordinary repository development; the application must not try to install
host security policy through a privileged container workaround.

After the administrator loaded the dedicated profile, the first all-capabilities-
dropped Docker probe passed three process-scope cases but failed Bubblewrap UID
mapping when the supervisor ran as UID 0. Linux requires CAP_SETFCAP to map parent
UID 0; granting that to engineering is not the solution. A disposable probe delegated
only the test container's own cgroup, then switched to UID/GID 1000 and dropped the
complete capability bounding set with no-new-privileges before invoking tests.
That advanced confinement to an explicit AppArmor `pivotroot` denial, confirmed in
the kernel audit. The profile now permits the inner sandbox's root change and
awaits an administrator reload. The base test image also lacked OpenSSL, required
by the existing TLS interception acceptance; the qualification image now includes
it. These are separate prerequisite failures, not waived tests.

The real report research dependency reached independently verified completion,
and its publisher requester resumed. It made no source changes and therefore does
not establish the self-development delivery gate. Verification inspection also
identified an efficiency cost: a 14.7 MB execution artifact and 19.1 MB review
report produced approximately 110 MB of raw verifier events. Preserve raw evidence,
but investigate eliminating repeated expanded context in structured summaries and
using bounded evidence retrieval. Do not truncate authoritative evidence or change
the active verifier's captured input to save time.

CI run 41775419180 passed at cabed86: the confined built-program run reported 827
cases (477 passed, 350 explicitly skipped native cases, zero failures), and the
separate native stage passed all 392 cases with zero skips in 1128.773 seconds.
Static checks and consolidated architecture/guidance validation also passed. Newer
shutdown, edit-schema and container changes require their own refreshed evidence;
this green run does not retroactively cover them.

Container confinement now passes ten existing acceptance cases with zero skips,
including actual HTTP/TLS proxy denial and descendant cleanup. Installing the
runtime bundle in a captured system tool location and supplying curl/OpenSSL fixed
missing-runtime prerequisites without changing application permissions. The first
container host-loss probe exposed inherited HOME=/root; the next exposed orphaned
zombies because no PID 1 init reaped them. Use an accessible non-root home and
Docker --init. Do not extend watchdogs or weaken process-exit assertions to hide
these deployment defects. Fixed prerequisites are cheap to check before a long
lifecycle suite. The immutable product image builds separately from managed source;
its entrypoint delegates only its own cgroup and drops capabilities before dispatch.

The packaged product image passed 13 native enforcement/host-loss cases with zero
skips in 37.499 seconds. Tests mounted only compiled acceptance inputs, so this
qualifies the image's own distribution, production dependencies and installed Codex,
not a writable checkout overlaid on the application. The runtime identity probe
observed UID/GID 1000, zero effective/permitted/inheritable/ambient/bounding capabilities,
and no-new-privileges. A real managed clone/registration survived replacing its
container and moving the volume mount from /var/lib/arcnexus to /relocated with the
same repository ID, base and revision token. Unfinished execution relocation and
whole-container lifecycle recovery remain separate; do not infer them from a
portfolio read. Packaging the supervisor independently took one initial build;
subsequent entrypoint corrections reused the dependency and compile layers.

Finish unattended container lifetime through the existing execution-runtime owner:
a small headless lifetime service keeps the container alive for normal CLI controls,
and drains answering hosts on container signals. It owns no scheduler or automatic
recovery. Use private IPC live identity (PID/start/storage root), never stale PID
files, before signalling host shutdown. Qualify it against the same actual managed
host fixture and then an actual Docker stop with a retained volume. This closes the
returning-workday-command lifetime gap without adding HTTP or changing public CLI.


The headless lifetime service passed its actual-host shutdown/replacement case;
all four native lifetime and host-loss cases passed with zero skips in 104.651
seconds. Two deterministic admission cases passed in 0.263 seconds: a foreign
answering endpoint is refused, shutdown stays closed until replacement, and only
one lifetime owner can hold the volume. The service schedules no work and has no
automatic continuation policy.

Whole-container stop then exposed a topology difference: Docker's root-owned init
could not forward SIGTERM to the non-root child with the four startup capabilities.
The fixed image starts its own tini after the privilege drop, so PID 1 and the
application both have zero capabilities and the same non-root identity; no KILL
or SYS_ADMIN grant was added. Actual Docker stop subsequently exited zero and
persisted both the task and active assignment as interrupted before replacement.
The next container preserved those states and byte-identical model-call evidence.
An earlier hard loss preserved its uncertain operation and correctly refused
explicit unsafe resumption. This is native, controlled-input deployment evidence,
not real-agent simulation. The complete volume is retained at
`~/.local/state/arcnexus/qualification-148-container-volume`; test containers and
the dedicated cgroup keeper were removed. The cheapest missing check was an actual
Docker stop, since killing a project host inside a container cannot exercise PID 1
signal forwarding. Keep that distinction in future deployment qualification.

The seventh simulation's publisher also attempted to change a frozen regression
file, so the director requested a bounded recovery investigation. That investigation
was authorized within the existing objective, without authorizing policy changes,
waiving criteria, changing the runner or selecting investigating stewards. Three
research dependencies completed independently; original engineering delivery is
still blocked. Issue #206 records a concrete prompt/enforcement mismatch: guidance
says to preserve regression intent, but the edit tool freezes exact file bytes and
turn context does not list newly frozen paths. Correct future per-turn guidance,
including where additional tests may go, while preserving all existing enforcement.
Two expensive failed activations make this a demonstrated cost, not a speculative
process improvement.

The real director selected the assignment steward for that investigation, adding a
fourth actual project owner during execution without a caller-selected roster.
This establishes observed dynamic selection, not completed engineering or the full
phase-two gate. The context fix now renders current checkpoint paths/hashes on each
turn; three built-program context cases pass. Existing frozen-edit enforcement is
unchanged. Record this bootstrap fix separately from the captured simulation, which
continues under its original supervisor.

## Promotion assembly intent

Implement promotion as a new live delivery, never an environment switch. Its first
operation imports the retained simulation's immutable base/candidate objects into
the current target object store and applies only their attributed difference using
an explicit three-way base. A normal history merge could accidentally include
unrelated bootstrap commits present in the simulation baseline. Preserve target
changes, retain conflicts, pin the resulting unverified candidate with only the
current target as parent, and leave both checkouts, branches and upstream untouched.
Use the existing supervised local Git command service. Fresh target-authority checks,
independent review and live issue/publication wiring remain mandatory subsequent
steps; object assembly alone is not promotion completion or authorization to push.

The seventh real task was stopped with all failed records retained after its actual
assignment steward confirmed the captured safe-checkpoint contract prohibits
continuation. A new task `b0943121-18c9-48dc-b951-9bd4a7207399` captures `7aa7eac`
and the identical engineering goal under `qualification-148-7aa7eac`. No original
checkpoint or supervisor was modified. Issue #207 records unavailable evidence in
the recovery handoff. The selected assignment acceptance suite passed 17 cases with
79 native-lane skips through the production test CLI; these skips are not native
qualification. CI `41782502012` is running separately.

Promotion assembly passed three actual native Git cases with zero skips in 6.773
seconds: target changes survive while unrelated simulation-baseline content stays
out, conflicts preserve both versions and logs, and linked-worktree or substituted
candidate inputs are refused. Both checkouts and upstream remain unchanged. The
first focused run exposed only an incorrect test expectation for the supervised
command error text; the corrected assertion checks exit code and retained conflict
output instead. This is operation-level evidence, not completed promotion, fresh
model verification, or real upstream integration.

Issue #208 corrects a lane classification introduced by the container batch. The
eighth real task failed its first confined baseline on a host Unix-socket bind in
container-admission: 481 passed, one failed, 353 native skips. Stop the other owner
baselines rather than paying for the same known failure. Keep the socket assertion
in native qualification, keep the non-socket ownership assertion runnable in the
confined service, and teach the existing AST-based lane guard about actual imported
node:net server creation. Fixture strings and unused imports must not trigger it.
Run the affected production confined selection and native test, then the complete
confined baseline before starting a new real task. No sandbox permission, regression
criterion or active runner changes are authorized by this classification correction.

Promotion review also found that a target's configured custom Git merge driver
could execute while processing candidate-controlled attributes. Assembly now refuses
those local driver definitions before import and immediately before comparison.
Four native cases passed with zero skips in 6.762 seconds, including no driver
execution and no imported refs on rejection. This does not broaden host commands
or authorize publication.

## Retained promotion proof

Before importing a simulation candidate, revalidate its captured run, environment,
assignment set, source authority, exact candidate and independent evidence digest.
Retain the candidate record identity on new deliveries; preserve optional historical
records and allow their evidence to establish the record instead of trusting a
workday's mutable latest-candidate pointer. Changed review content must invalidate
retained proof even when a revised review still claims success. This is source
provenance validation; it never substitutes for fresh target verification.

At `add2dc8`, the full production confined test selection passed 840 tests: 482
passes, zero failures and 358 native-lane skips. Both native admission cases passed
in 0.256 seconds; the three selection guard cases passed. Formatting, lint, strict
checking, build and consolidated validation passed. CI `41782502012` separately
passed its older `7aa7eac` revision (482 confined-lane passes/353 skips and 395 native
passes/zero skips). The ninth real task `328f21ef-bfd1-4f39-87e5-91a089f93861` now
captures `add2dc8` with the unchanged goal and no selected roster. Its state root is
`qualification-148-add2dc8`; prior tasks and their failures remain retained.

Six built publisher cases passed in 5.157 seconds, including historical optional
record metadata, changed latest-candidate pointers, altered independent review
content, and substituted source/assignment authority. Capture and revalidation now
share one identity calculation. This validates retained source proof only; it does
not claim fresh-target acceptance or a completed promotion command.

Retained receipt resolution now finds the original candidate by captured record ID
or historical assignment receipts, rechecks its tree and independent digest, and
rejects missing, aliased or substituted receipts. Eight built publisher cases passed
with zero skips in 1.920 seconds; scoped lint and production/test builds passed.
This reuses existing retained proof rather than introducing a second evidence model.

The ninth real run reached specification for report but the CLI steward supplied
the tracking issue identity in the dependency request's assignmentId field. The
host rejected that unknown assignment; unrelated ready work continued. The schema
allowed nullable assignmentId without explaining that it means an existing supplier
assignment, not tracking. Record this integration defect and clarify the typed
contract rather than silently deleting a requested identity or hotpatching the
captured runner. Failed real runs continue to expose gaps that isolated success
fixtures miss; small production-contract checks are cheaper than repeated baselines.

Issue #209 will clarify nullable supplier-assignment linking in the active schema
and per-turn context. Resolve explicitly linked recipients within the same run and
owner before mutating any request state. Unknown issue/message IDs and mismatched
links become actionable dependency blockers with the rejected outcome retained;
never reinterpret them as new work. Test atomic fan-out rollback and unrelated
scheduler progress against the built store and scheduler. This does not repair the
ninth run's captured supervisor or authorize rewriting its returned request.

The dependency-identity correction passed 15 built scheduler/inbox cases with zero
skips in 0.244 seconds, including atomic rollback and continued unrelated work.
The first run exposed a test comparison against an undefined property that JSON
correctly omits; the assertion now compares the serialized durable intent. Production
build, test compilation and scoped lint passed. This does not claim that the ninth
captured runtime contains the fix. Its CLI checkpoint is safe and waiting; its real
director retains responsibility for deciding whether and how to continue it.

Promotion wiring now uses the existing task queue and sole repository host. A
current-target run retains original simulated assignment provenance without fake
live completions, performs fresh confined checks plus verifier and director review,
and queues normal live publication only after a new immutable delivery exists.
Repeated submission is idempotent for source delivery plus target authority.
Candidate acceptance and publication readiness are committed together; explicit
pause suppresses publication dispatch. Interrupted verification remains an honest
attention state rather than replaying uncertain operations. No real-provider
qualification or phase-two completion is claimed from this implementation.

The initial three native promotion cases passed with zero skips in 10.819 seconds.
Two focused failures exposed missing fixture record attribution and a missing
current-run identity in the goal-evidence envelope; both were corrected without
relaxing evidence validation. Further goal-pointer/replay assertions are being
assembled before final checks. This short production-wiring feedback loop is more
efficient than another complete native suite after each small interface edit.

CI 41785987986 passed at add2dc8. The ninth real report steward reached implementation
but then failed test preparation with TS2339 in its new report-cli regression.
Its original failed CLI assignment and this compiler diagnostic remain retained;
publisher-discovered report and CLI dependency assignments continue independently.
Observed compilation failures currently terminate some engineering paths instead
of returning corrective feedback. Diagnose the invocation and checkpoint boundary
before changing recovery behavior; a prerequisite failure must never count as the
selected expected-red regression, and active captured authority must remain stable.

The assembled promotion source-proof, native Git and production-host cases passed
15 tests with zero skips in 15.208 seconds. Four deterministic candidate-store cases
passed with zero skips in 0.242 seconds, including fresh goal evidence, rejected
foreign authority, atomic readiness and no pointer rewind on duplicate acceptance.
Formatting and strict checking passed. Full lint found one oversized fixture data
builder; it was split by receipt construction and run setup, with scoped lint then
passing. The ninth task was stopped through its captured CLI and retained as
cancelled once the unsafe compiler-failure checkpoint established that another
baseline could not recover its original required assignment. Issue #210 records the
corrective prerequisite-feedback defect. No ninth-run engineering delivery passed.

Consolidated validation caught a private cross-owner import for the new promotion
fixture. The fixture is used only by execution-runtime, so it now lives under that
owner's test support directory instead of expanding testing's public API. This
keeps reusable infrastructure separate from one feature's scenario setup.

## Observed prerequisite feedback correction (#210)

For agent-invoked finite operations, an observed nonzero prerequisite exit must
return failed feedback identifying the requested and actual failed operation. Do
not run the dependent command or claim its artifacts were produced. The steward
can then correct authorized source. Cancellation, uncertain completion, invalid
operation authority and transport failure remain fatal. This changes only the
agent bridge: expected-red capture still requires the selected regression's own
observed failure, and mandatory verification still throws on failed prerequisites.
Test the real MCP/harness path with a failed compiler prerequisite, a subsequent
successful operation, and no dependent side effects; retain raw invocation evidence.
