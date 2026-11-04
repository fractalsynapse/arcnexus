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
