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

The prerequisite correction passed five focused built cases with zero skips in
26.686 seconds. The native MCP scenario observed compiler exit 7, returned the
actual failed operation to the steward, skipped dependent output/artifacts, then
completed two subsequent operations after checked source correction. A direct
mandatory invocation still failed, and four regression-selection cases retained
the rule that prerequisite failure is not expected-red evidence. Scoped lint and
build/test compilation passed. No real-agent success is inferred from these scripted
inputs. The next real run will capture this correction instead of modifying any
previous supervisor.

## Assembled qualification and recovery handoff — 2026-11-04

Revision `b2bc240906e5cc460b522fdca25f7b29216eac13` passed the complete production
confined test selection: 854 cases, 492 passes, zero failures, 362 native-host
qualification skips. Counts are summed from all retained operation logs, not the
last suite's output. Evidence is retained at
`~/.local/share/arcnexus/state/test-runs/3fa81c55-6e36-41b6-8ee7-972ab241d557`.
Formatting, lint, strict checking and consolidated architecture/guidance validation
also passed. Current-head CI remains separate evidence.

A fresh real-agent simulated task `c77ed720-cfb7-4fc1-9e57-8c38aaf39589` captured
that clean revision under `qualification-148-b2bc240`. It receives the same useful
delivery-inspection goal; the real director chooses from the actual project catalog.
No team is prescribed. Starting this run establishes neither delivery nor completion.

Issue #207 supplies the next bounded bootstrap change: research/review assignments
must receive a host-bound read-only view of current-run recovery evidence. Pin the
selected checkpoint, checked-edit journals, operation/service state and observed
request/receipt records outside source; page complete content through a fixed MCP
capability rather than granting private filesystem reads. Include director feedback
and caller clarification in the retained handoff. Reject foreign identities and
unsafe file aliases, preserve unavailable evidence explicitly, and never treat an
investigation as permission to replay uncertain operations. Reuse the verifier's
artifact paging contract instead of creating a second evidence transport.

Efficiency observations: the ninth report assignment spent 118.894 seconds on
locked dependency setup and 179.116 seconds on the inherited full-suite baseline;
its owner test command took 0.718 seconds. Repeated baseline/setup work therefore
costs substantially more than focused feedback. Any future reuse must be keyed by
immutable authority, source/candidate, operation and environment identities; this
observation does not waive checks or authorize mutable evidence reuse. A separate
editing-script variable reuse briefly replaced changelog contents in one local
commit; inspection of the commit's line count caught it immediately, and the next
commit restored the original plus the intended two edits before qualification.
Prefer direct patches and inspect the complete diff statistic before committing.

The #207 bootstrap implementation now shares one `EvidencePages` transport between
verification and investigation. Actual director → assignment → MCP handoff passed
with controlled model inputs; original checkpoint bytes and caller clarification
arrived without reopening failed work. Boundary cases cover foreign identities,
symlink records, immutable capture, invalid pages and arbitrary path rejection.
The assembled focused group passed 13 tests, zero failures/skips, in 24.571 seconds.
Production and test builds plus scoped lint passed. This is deterministic/native
handoff evidence, not a new real-agent investigation claim. The tenth simulation
continues using its original `b2bc240` supervisor, which predates this addition.

A follow-up alias boundary check passed eight report cases with zero skips in
0.331 seconds, including a hard-linked record and safe timeline/log observations.
Existing verifier artifact paths and the `verification.evidence` contract remain
unchanged. These short targeted checks reused the already passing native MCP
handoff rather than repeating the entire integrated suite after a small boundary fix.

## Scripted campaign retirement intent

Move the remaining prompt-campaign executor out of production source into the
experiments owner's acceptance-test support. Its cases continue to invoke the
ordinary built task command with controlled model inputs, preserving cancellation,
source pinning, expected-outcome assertions and supervisor-integrity checks. The
existing `test inspect/run --component experiments` selection remains the way to
run these scenarios. Do not add a scripted mode to tasks or workdays.

Retire `experiment run` before reading any manifest or creating state, with explicit
replacement guidance for acceptance tests and real-agent `task run --simulate`.
Keep read-only historical manifest inspection while historical resource readers
are consolidated; it must never import an executable campaign runner. Remove the
production campaign-runner public module and its help entry. Existing schema/report
vocabulary remains historical evidence, not the meaning of current simulation.

Campaign retirement passed the production confined experiments selection at
`2879d70`: 24 passes, zero failures, seven native-host skips. The selected native
group initially had 11 passes and two failures: the intermediate committed-boundary
inspection noted above, and a captured-input scenario whose assertion omitted its
retained cause. The three-case CLI rerun passed against the assembled commit. The
unchanged captured-input case passed separately with zero skips in 92.094 seconds.
A concurrent `test run` rebuilt shared outputs during the original native case;
that overlap is a supported explanation, not a proven diagnosis of the lost report.
Issue #211 adds concise retained failure diagnostics and records build/test ordering.
No original outcome or supervisor-integrity requirement was weakened. Avoid repeating
the full group for this assertion-message correction.

CI 41792602428 passed at `b2bc240`: confined selection 492 passes/362 native skips,
native qualification 405 passes/zero skips in 1,137.002 seconds. Later bootstrap
commits require their own CI. The tenth real simulation's CLI steward independently
requested report and publisher research plus an architecture-maintenance changelog
assignment; this is an additional actual project owner discovered during execution.
The original report assignment retained specification edits and observed expected-red
regression evidence and safely advanced to implementation. These are progress facts,
not completed delivery or full self-development qualification.

The tenth task subsequently passed a real unfinished-work pause/resume check through
its captured production CLI. Pause waited for the active turn and checkpoint; resume
retained five records' plans, model threads, regression evidence, checkpoint bytes,
checked-edit snapshots and dependencies. The simulation environment and dependency
graph were unchanged. The full assignment comparison intentionally differs because
the previously unstarted architecture-maintenance assignment moved from ready to
running after resume; that is dispatch, not lost continuation state. Hashed snapshots
and control responses are retained under
`qualification-148-b2bc240/qualification-control/tenth-pause-resume` in the local
qualification state. This proves task continuation, not container recovery or final
delivery acceptance.

CI 41798007233 passed at `b633d8f`, including confined tests, native-host qualification,
formatting, lint, strict typing and architectural ownership validation. The report
steward's new regression tests and owner lint also passed during implementation;
formatting correction and independent verification remain separate pending work.
Observed formatting proposals require the worker to apply their returned content
through checked edits. Repeated proposal/check cycles are an efficiency observation,
not authorization for the supervising caller to modify the agent's candidate.

Issue #212 identifies the actual contradiction behind that formatting delay: the
host accepted and froze an unformatted regression. Required formatting subsequently
failed while implementation correctly preserved frozen bytes. Before freezing a
behavioral specification, execute its captured mandatory lint-category operations.
Completed source-quality failures use existing specification correction; uncertain
operations and cancellation do not. Keep final checks and frozen-test protection
unchanged. This is bootstrap prevention for new supervisors, not a hot patch or
permission to rewrite the tenth run's accepted regression.

The #212 focused built-program group passed eight unit cases with zero skips in
0.687 seconds. Native execution then demonstrated the new pre-freeze failure path
with a real supervised operation (one pass, zero skips, 10.015 seconds); the existing
expected-red correction scenario also passed in 18.967 seconds. An initial fixture
omitted permission for its new lint category and correctly failed preflight; the
fixture now explicitly captures that permission. No production authority was widened.
Real-agent use of the new checkpoint is still pending a future captured supervisor.

The migrated repository format/lint definitions were still classified as `cli-check`.
Their declarations now use the already permitted `lint` category, preserving command
definitions and usages while making their static-quality purpose explicit. The host
does not infer semantics from command names or expand agent-only operation authority.

The native #212 scenario was extended through correction, expected-red, implementation
and final verification on the same retained thread: one pass, zero skips, 25.060
seconds. Only the controlled model boundary supplies the corrected specification;
the actual checked-edit, operation and stage machinery runs unchanged. This additional
focused execution closes the distinction between safe rejection and successful
continuation without another long integrated suite.

Production `test inspect/run --component assignment --level unit` selected and passed
nine cases with zero failures/skips at `89b4759`; evidence is retained at
`~/.local/share/arcnexus/state/test-runs/6980793d-7cb1-4e44-a7b7-db10555e67f8`.
Assembled formatting, lint and strict type checks passed. The tenth task separately
completed and independently accepted its report research dependency; this does not
count as a verified engineering change or simulated publication.

Issue #213 closes the settings resource's missing revision contract before phase-three
gateways consume it. Return deterministic revisions from effective settings reads;
accept optional expected revisions in the shared update service and compare under
the existing SQLite writer lease before atomic JSON replacement. Keep configured
values separate from environment overrides, retain allowlisted settings and do not
create storage on reads. The CLI keeps its simple argument contract. This is direct
bootstrap work during the real simulation, not agent-delivered implementation.

The #213 settings service and existing built CLI passed seven focused cases with
zero skips: four persistence/revision cases in 0.610 seconds, three CLI compatibility
cases in 6.592 seconds. Builds and scoped formatting/lint passed. Reusing the existing
SQLite lease avoided a new lock protocol or second settings source. Expected revisions
are service inputs, not additional required CLI arguments. The concurrent real-agent
publisher assignment has begun implementation; its evidence remains separate.

Issue #214 records a directly observed transport defect: publisher's formatter emitted
a 25,110-byte JSON edit proposal, but each operation response contained a 14,446-character
diagnostic excerpt that could not be parsed. Four repeated calls returned the same
unusable excerpt. Retain complete successful checked-edit proposals as immutable
host evidence bound to their invocation; return compact metadata and let the existing
`source.edit` tool consume that reference through its unchanged authorization and
transaction engine. Reject foreign, incomplete, tampered or aliased evidence, preserve
stale-hash and frozen-test checks, and identify truncated diagnostics explicitly.
This removes model-mediated copying without giving commands direct source writes.

The #214 implementation passed 13 focused bridge/context cases with zero skips in
1.140 seconds, including a proposal larger than the excerpt, immutable capture after
the original log changes, replay, stale hashes, foreign/incomplete identities,
ownership/stage/frozen-test rejection, tampering, hard links and symlinks. A native
MCP scenario passed in 22.130 seconds: a real confined operation emitted a large
proposal, the actual bridge applied complete bytes by reference, and a repeated
reference reused its receipt. Its model input was controlled; real-agent use remains
pending a fresh supervisor. Builds, formatting, lint and strict checking passed.


The assembled production confined selection at `3c9e99e` passed 512 cases with zero
failures and 365 native-host skips (877 total). Evidence is retained at
`~/.local/share/arcnexus/state/test-runs/e2f69e18-15e8-4ac9-b536-7ad45b6d2f69`.
Formatting, lint, strict checking, builds and consolidated architecture/guidance
validation passed. Native focused results above remain separate; CI 41809960511
is still running its native-host qualification. CI 41805305089 passed at `0fcc316`,
before the settings and complete-proposal changes.

Efficiency observation: assembling the checkpoint, settings and proposal repairs
before one integrated run avoided three repeated long suites. Complete proposal
references also remove a demonstrated copying/truncation loop without relaxing edit
authority. The tenth simulation now has independently accepted report and publisher
research; neither is an engineering delivery. Its changelog verifier correctly
rejected a claim made before the CLI workflow was verified. Architecture maintenance
requested a further CLI evidence assignment through the ordinary inbox, which is
running. Observe whether that produces relevant evidence or duplicates unfinished
work before changing dependency policy; do not fabricate completion to release a
waiter. All these live observations retain the original `b2bc240` supervisor.

Issue #216 preserves execution progress before retiring legacy observation commands.
Expose the report library's captured-record progress projection through workspace
resource reads: observed commands, claimed checklist progress, verification evidence,
cancellation and historical limits. Do not expose whole model turns, bindings or raw
timeline payloads. Include timeline evidence in workspace revision tokens so event-only
progress changes invalidate stale resource reads. Missing historical progress remains
unavailable. Preparation/cleanup test migration and alias retirement remain subsequent
work; adding this projection alone does not complete that gate.


The #216 production resource selection passed nine cases with zero failures/skips
(11.892 seconds), including historical unknowns, private-field omission, claimed
versus verified progress, command completion and event-sensitive stable revisions.
Evidence is retained at
`~/.local/share/arcnexus/state/test-runs/f82a13b2-40ea-43b2-a69d-457e9a15f927`.
Scoped lint, strict checking, builds and consolidated validation passed at `e740a47`.
This is bootstrap work; legacy command retirement is still pending caller migration.

A timing sample from the tenth publisher assignment on 2026-11-04 records
48 completed host commands totaling 1,277.3 seconds. Five full-suite invocations and
five strict-check/lint cycles occurred while the assignment moved through correction;
its start was 07:50 UTC. Those command durations are not the whole elapsed time and
do not establish model-only latency because scheduling and other owners also consume
wall time. Recommendation: fix the observed proposal transport and pre-freeze quality
failures first, then measure a fresh run before changing required verification. Do
not skip checks on changed candidates or attribute all delay to test execution.

With workspace progress available, retire the top-level `status` and `follow`
spellings in the #148 CLI migration. Return an input error naming `workspace get`
and `workspace get --follow` before accessing state. Migrate built-program report
and planning scenarios to those resource views, preserving read-only historical
report functions at the library boundary. Keep package-aware observation cancellation
as detach-only. This does not retire `prepare` or `cleanup`; their composition and
failure-recovery callers still require migration.

Top-level observation migration passed ten built CLI resource cases with zero skips
and four focused native planning/report scenarios with zero skips (51.776 seconds).
The first resource attempt caught a stale production build: `build:tests` refreshed
test output but retained the old CLI. Rebuild production explicitly before claiming
built-program coverage; the rerun passed against the new command routing. Formatting,
lint and strict checks passed. This diagnostic cost one extra focused native run;
it did not justify weakening the test or interpreting an old program as current.

The tenth real simulation was stopped through `task stop` after both original report
and publisher engineering assignments reached the same frozen-formatting blocker.
The remaining CLI evidence operation was cancelled and its assignment interrupted;
partial edits and all reports remain retained. Two research assignments were accepted,
but no engineering delivery was verified. The control response and final projection
are hashed under `qualification-148-b2bc240/qualification-control/tenth-stop`.
A fresh simulation must capture the corrected supervisor, rather than waiving format
checks or rewriting frozen sources in the old run. Continue using the useful original
goal and real director selection from the project catalog, without prescribing a team.


At `7a7db01`, the assembled confined selection passed 516 cases with zero failures
and 365 native-host skips (881 total). Evidence:
`~/.local/share/arcnexus/state/test-runs/bb5fa869-303e-44c5-b139-2e0914d3d8ea`.
The eleventh real-agent simulation `c4e8b7df-967b-4c95-b932-a01ad0ad1251` captured
that committed supervisor and the unchanged useful goal in environment
`41d55ae4-741f-47a7-b12a-903d822a036a`. Its director selects from all 21 actual eligible
project stewards; the eligible catalog is not a prescribed participant list.

CI 41809960511 at `3c9e99e` failed one of 408 native cases; 407 passed with zero
skips. The oversized-proposal scenario reported missing expected response metadata
but discarded the operation response in its assertion. CI used Codex
`0.163.0-alpha.10.2`, versus local/container `0.166.0-alpha.6`. Installing the exact
CI runtime separately and rerunning that scenario locally passed one case with zero
skips in 22.230 seconds. This does not establish a version incompatibility or resolve
the CI failure. Preserve bounded response diagnostics in the controlled fixture for
the next CI observation rather than weakening its assertions or changing the runtime
pin speculatively. Fresh real simulation on the locally qualified runtime continues;
real upstream integration still requires green CI and all applicable review gates.

Finish preparation/cleanup retirement by moving native fixtures to registered,
isolated-volume `workspace prepare` and `workspace cleanup` calls. Their low-level
assertions may read retained reports, but preparation must use the production package
resolver, shared service and repository lease. Test captured older revisions through
the public preparation service, not a retired CLI option. Preserve cancellation,
parent-loss, ownership, conflict and cleanup-receipt coverage. Remove the old gateway's
separate worktree execution/finalization path only after migrating its callers.

The assembled workspace migration passed 47 of 50 native cases and all ten focused
CLI resource cases. The remaining three assertions used `reason` instead of the
shared cleanup result's existing `error` field; ownership and retention refusals
were observed. Correct those assertions and rerun their affected cases. Preserve
all lifecycle tests, including captured older revisions through the public service.

Issue #217 resolves the actual native-CI proposal failure. CI 41814615373 retained
valid complete JSON followed by an `UNDICI-EHPA` stderr warning in the combined log.
The warning is valid diagnostic evidence, not part of the structured stdout protocol.
Extend the supervised regular-file capture to retain separate stdout while keeping
combined diagnostics and the existing output bound. Pin edit proposals from their
invocation-bound stdout file, never by stripping warnings or accepting a JSON prefix.
Keep cancellation, descendant supervision and checked-edit authorization unchanged.
Native acceptance must deliberately emit a large proposal plus a stderr warning;
unit coverage must retain both streams and exercise cancellation/output bounds.
The two failed CI rounds cost roughly two native qualification cycles; a small
mixed-stream case would have caught this condition before those long runs.

The workspace retirement's three corrected cleanup assertions all passed against
the built package-aware CLI, alongside the native large-proposal mixed-stream
regression: four cases, zero failures/skips, 47.332 seconds. The shared executor's
process-scope, operation execution, file diagnostics and pending-operation cases
passed ten native cases with zero failures/skips in 18.045 seconds. Issue #217's
17 focused checks also passed, covering cancellation, the retained 64 MiB output
bound, immutable proposal references and stdout identity. This is local evidence;
the two earlier CI failures remain failures until a new head is qualified.

The eleventh real simulation provides observed evidence for the checkpoint and
proposal fixes under its unchanged `7a7db01` supervisor. The CLI steward corrected
a failed specification-format check, passed formatting/lint, and advanced to the
red-test stage with frozen regression evidence. At 11:04:34 UTC on 2026-11-04 it
applied proposal invocation `641e7d7e-5053-44a2-925f-7507a6098dbf` through the
assignment-bound checked edit tool. The response retained the committed transaction
and changed test hash. This demonstrates a real proposal-reference edit; it does
not establish an oversized real proposal or independently accepted delivery. The
report dependency is ready and the original publisher assignment is implementing.
The extra publisher assignment is not a newly discovered owner, since the real
director selected publisher initially. Keep that qualification distinction explicit.

At `2c66600`, the assembled production confined selection passed 520 cases with
zero failures and 365 native-host skips (885 total). Its 20 recorded commands
totaled 372.529 seconds; retained evidence is
`~/.local/share/arcnexus/state/test-runs/dfbc729c-967d-46c7-a000-cbe073b2e8ab`.
Consolidated validation passed for the preceding code-identical `059fd9e`; formatting
and full lint passed. This is distinct from CI 41820203579 and native-host evidence.

The remaining portfolio list filter adapter reuses the existing typed query service.
Two built-CLI scenarios passed with no skips in 25.374 seconds, covering namespace
selection, combined equality filters, pagination and invalid fields. Strict checking,
production/test builds and scoped lint passed. No scheduler or new query abstraction
was added. This small interface change followed the integrated executor batch; reuse
that executor evidence and refresh the affected CLI/static checks instead of another
full local native suite. Finish the remaining assembled edits before pushing again
to avoid repeatedly cancelling or duplicating long CI cycles.

Issue #218 follows an observed failure in the eleventh simulation: verifier
`4fa306a7-12ce-4d1b-85a4-644e82f383e8` requested an artifact ID quoted from another
capability's SDK observations. The ID was absent from its current manifest. The
unknown-artifact exception terminated verification, failed the research supplier
and blocked its report dependent; unrelated engineering continued. Make request
validation correctable through the existing evidence bridge without exposing
foreign artifacts, accepting paths or swallowing integrity failures. Prove recovery
through actual MCP calls after an invalid artifact request. The running supervisor
remains unchanged; its director may diagnose safe retained continuation normally.

The failed reviewer paged more than 26 million characters of execution evidence.
Keep complete evidence available, but investigate duplication and more selective
retrieval separately. Do not solve that cost by truncating required evidence,
changing acceptance criteria or adding an execution budget.

Issue #219 addresses the measured transport cost alongside #218. The failed review's
execution artifact contains 26,351,724 characters; host command output accounts for
roughly 22 million. Use the existing pinned evidence artifacts for individual command
logs. The execution index retains command identity, arguments, stage and exit status
with references advertised in the current verification manifest. Preserve every log
byte, explicitly unavailable output and the original report data. Verify exact
retrieval through MCP; record index-size reduction independently from unmeasured
model-time savings. No reading quota or acceptance relaxation is introduced.

The #218 repair passed seven focused evidence cases and its five native MCP cases.
The assembled #218/#219 transport then passed all six native verification cases
with zero skips in 28.546 seconds, including same-connection recovery from foreign
artifact IDs, exact complete/empty command outputs and unchanged source evidence.
The report selection passed 18 cases with zero failures and 14 native-host skips
(32 total); strict checking and builds passed.

Exercising the new production pinner against the retained real review input reduced
the execution index from 26,351,724 to 2,704,204 characters. All 125 command outputs
(21,856,105 characters) remained separately retrievable with matching content hashes;
the original host evidence object remained unchanged. This is an observed index-size
reduction, not a measured model-latency improvement or a newly accepted real delivery.
The active simulation still uses its original supervisor.

Issue #220 addresses the remaining evidence-access gap exposed by that same review.
Investigation observations reference exact pinned `assignment.evidence` artifacts,
which independent verification must be able to retrieve through its own manifest.
The report boundary will validate the originating record and run, private regular
file identity and content hash before repinning those bytes. Annotate only the
cloned transport observations with current artifact references. Missing bytes remain
explicit evidence gaps; foreign records, unsafe aliases and changed content fail
capture. Do not recursively expand historical verification snapshots or interpret
an invalid request response as a successful pinned page. Test provenance failures
and exact retrieval through the real verifier MCP connection. This is bootstrap
repair; the running real simulation retains its captured supervisor.

The retained failure revealed that independent review needs artifacts advertised by
the observed investigation manifest even when the worker never opened them. Include
those immediate entries with original IDs, hashes and current verification references;
do not recursively traverse historical state or verification snapshots. A production
MCP test must retrieve an advertised but previously unread receipt.

CI 41832306965 passed 408 native cases and failed one stale coordination assertion
that expected inline command logs after #219 moved them to artifacts. Update that
assertion to compare every retrieved command artifact with its original host log.
The missed consumer cost a 12m52s native job; the cheapest prevention is to include
existing evidence-consumer scenarios in focused checks when changing transport shape.

Issue #221 follows two equivalent real publisher review corrections. The current
regression bytes match their immutable frozen checkpoint but differ from the earlier
Git base, because specification changes precede freezing. Candidate review must
retain the complete diff and explicitly report current versus frozen hashes; a
pre-freeze diff is not itself evidence of a preservation violation. A matching hash
does not establish test quality or waive acceptance. Missing, changed and unsafe
files must remain distinguishable from preserved files.

The same diagnosis found that publisher's authored policy requires lint but omits
formatting, unlike several other stewards. Hoist both existing repository-required
quality verification usages once to the platform and remove duplicate leaf usages.
Qualify inheritance for the actual steward catalog and retain the existing generic
pre-freeze operation selection. This repairs captured policy for new runs without
hardcoding repository guidance in the product or modifying active authority.

The #221 catalog repair removes 37 repeated leaf operation usages and declares the
two shared quality requirements once at the platform; the two executable command
definitions are reused. Sixteen focused cases passed, including the actual committed
steward catalog and exact frozen-checkpoint comparisons. Native context qualification
initially passed nine of ten cases; the added assertion incorrectly looked for an
untracked regression in the tracked Git patch. Check `newFiles` for that regression
and retain the separate tracked-patch assertion before refreshing that case.

The eleventh real task was cancelled through its captured CLI after the diagnosed
policy/review defects required new authority. Its publisher had rejected an attempted
frozen-file edit before mutation; original report work remained blocked by the old
artifact lookup failure. Three dependency deliveries were independently accepted
(two research and one changelog), but no original engineering delivery or publication
is claimed. All retained edits/checkpoints remain. None of 380 retained managed
process scopes contained a running child after cancellation. Earlier in this run,
safe pause followed by paused-host SIGKILL and captured-runtime resume preserved
all eight assignment identities, inbox counts and dependencies, with seven immutable
checkpoint files verified against their hashes. The safe pause took 480.866 seconds
while the active turn completed. These are actual real-work recovery/cancellation
observations, distinct from active-operation recovery or container relocation.

The corrected native review case passed with zero skips in 33.511 seconds; the
other nine cases from its focused native set had already passed. Actual review
prompts retain tracked changes and new regression content with host-observed frozen
hash comparisons. Static checks and consolidated validation passed at `eea963f`;
final assembled revision evidence follows separately. A manual test/build overlap
briefly omitted six newly emitted cases from an earlier direct invocation; that
result was not accepted. Waiting for compilation and checking the expected count
produced all sixteen focused passes. Keep build completion a prerequisite for direct
native tests; the production test service already serializes these steps.

### Real container startup qualification (#222)

The packaged 449558f real workday registered the actual ArcNexus platform/package
from outside a checkout and completed setup, then failed before its director could
start: the generated `codex-linux-sandbox` alias under the denied private client home
could not execute. The runtime remained non-root with all capabilities zero and
no-new-privileges; no AppArmor denial appeared in the inspected failure interval.
The preceding controlled container tests did not cover this actual Codex thread-start
path. Preserve the failed workday and its supervisor, and qualify a new supervisor
before claiming real container execution.

Diagnose the precise helper visibility requirement with the installed runtime and a
controlled model transport. Any correction must expose only necessary runtime support,
retain private credential/client-state denials, and keep maintained source read-only.
Add actual-runtime startup coverage rather than substituting another scripted worker.
The official [permission contract](https://learn.chatgpt.com/docs/permissions) documents
narrow filesystem grants, but the installed version must demonstrate enforcement.
No privileged or broadly readable fallback is authorized.

Efficiency observation: real packaged startup found a missing boundary case after
sixteen controlled enforcement tests passed. A small actual-runtime thread-start
probe should catch this before another multi-minute project preparation. The native
real task remains on its unchanged supervisor; report/publisher/CLI were selected by
its director, and report has requested publisher work through the ordinary inbox.
The separate portfolio-creation goal is durably queued through the same task service.

The focused diagnosis isolated Bubblewrap capability rather than a required permission
expansion: Bookworm's 0.8.0 lacks `--argv0`; the native 0.11.1 supports it. The image
now builds checksum-pinned 0.11.1 against the runtime libc, with no change to source,
private-home, seccomp, AppArmor or capability policy. A 0.13.1 diagnostic build failed
on its additional `mount_setattr` requirement and was retained as unsuccessful.
The actual-runtime startup case passed natively and in the corrected image, then all
17 packaged enforcement/startup/host-loss/output cases passed with zero skips in
39.199 seconds. Static checking, test build, formatting and lint also passed.
A new real-agent workday remains required; controlled startup is not its substitute.

The startup probe avoided repeated full project preparations during diagnosis.
One probe initially waited for an unclosed test stdin, and one container command
used a nonexistent compiled test path; those orchestration errors are retained as
unsuccessful attempts. Resolve compiled paths before dispatch and await completion
before reusing a container name or log. Neither error justifies changing product
behavior or weakening acceptance.

### Confined executable identity and portable baseline (#223)

The corrected container completed its real director turn and selected change-inspection
for behavior-preserving regression coverage. Engineering then stopped at mandatory
baseline: 13 of 907 cases failed, with 525 passes and 369 explicitly native skips.
A production-adapter probe isolated a relative `process.execPath` when Node entered
confinement as `node`. This invalidated test-created executable bindings and host
checks; generated npm stubs received an unusable relative shebang. Two output tests
also incorrectly required stderr to exclude runtime-generated warnings.

Resolve operation/service executable names to absolute paths using the same host
execution PATH before sandbox dispatch. Preserve explicit bindings, working-directory
semantics, cancellation, evidence and confinement. Keep unknown or non-executable
tools as pre-dispatch errors; do not hardcode Node locations or add configuration.
Qualify the actual confined executable identity and PATH precedence in the supported
image. Output tests must still prove exact structured stdout and retained stderr,
including additional diagnostics. Refresh affected cases before the assembled full
container baseline. Retain the failed workday; its baseline cannot be rewritten by
candidate changes or a different supervisor.

The executable repair is committed at `a7fb6f8`. Native focused coverage passed
12 cases, service lifecycle coverage passed 19, and the built image passed the
same 12 executable/confinement/output cases with zero skips. The initial native
fixture invocation used a private Codex installation outside its allowed read
paths; selecting the installed system binary passed without broadening policy.
Full container test execution is being prepared through `workspace prepare` and
`test run`; focused results do not establish that full baseline yet.

The independent native simulation has now observed four real stewards: report,
publisher, CLI, and architecture-maintenance. CLI discovered the maintenance
assignment through its inbox dependency. This proves dynamic participation, not
completed multi-owner delivery. Its independent reviewer rejected a publisher
research conclusion that inferred an artifact-link blocker without tracing the
existing references. Retain that correction as real verification behavior.

Efficiency: four distinct assignments on the unchanged `449558f` baseline each
spent about 192–195 seconds in the same complete repository test command, before
engineering. Evidence reuse is worth evaluating only after matching captured
operation semantics, source, bindings, runtime and generated inputs; unchanged
source alone is insufficient. Do not change this active run's acceptance policy.
The focused container executable check takes less than a second, making it a
cheap prerequisite before another multi-minute real-agent preparation.

The first CI run of the executable repair failed before test dispatch: its
setup-node npm alias resolves outside the captured readable tool directory. The
old sandbox PATH lookup silently selected a different readable installation.
Make CI's intended npm installation explicit: install the existing npm 10.9.9
version under `/usr/local` and capture its executable binding beside Node and
Codex. Keep the host toolchain separate from source authority and preserve the
read boundary; do not add the entire hosted tool cache as a readable exception.
Retain failed run 41857431712 and requalify the actual runner configuration.

Efficiency correction (#224): the npm-binding workflow update omitted the existing
release-owned workflow acceptance test. CI 41858507266 then spent 12 minutes
54 seconds before reporting its stale two-tool assertion. YAML parsing and
formatting were insufficient. The corrected compiled suite checks the additional
pinned npm installation and binding: five cases passed with zero skips in
210 milliseconds. Run this affected suite before pushing workflow changes; no
full baseline or new process framework is necessary for that feedback. The initial
direct TypeScript test attempt was unsupported by this installed Node build; the
normal test build and compiled suite provided the evidence. Refreshed CI remains
a separate gate.

The 16:04 UTC native-run snapshot retained 132 completed engineering commands
(total recorded durations 3,938,902 ms, approximately 65.6 minutes). Eleven full
suite invocations account for 2,316,716 ms (38.6 minutes), and seven dependency
installations account for 837,609 ms (14.0 minutes). These are summed command
durations, not run elapsed time; director/reviewer activity and pending commands
are excluded. Detailed attribution is retained in
`qualification-148-449558f/qualification-control/command-cost-current.json`.
The strongest measured optimization candidates are validated baseline evidence
reuse and isolated dependency preparation reuse. Preserve current-candidate
verification, generated-input integrity and authority; do not infer reusable
evidence from unchanged source alone or modify these active captured runs.

### Captured suite metadata before checked writes (#225)

The native report assignment failed after adding a `regression` tag to a captured
native-host suite. The host correctly rejected altered selection metadata, but
only after the checked edit had changed the file. Reject these proposals at the
checked-edit boundary instead: compare complete proposed suite metadata with the
captured owner, level and tags before any batch mutation. Preserve the final host
guard and frozen regression checks. Return recoverable, actionable rejection so
the worker can correct its proposal without losing otherwise valid assignment
work. Test deletion, tag additions/removals, owner/level changes, atomic batches,
allowed body edits and new owned suites. The existing run retains its original
supervisor and failed evidence; unrelated assignments continue.

The refreshed CI passed the full confined selection but failed 45 of 413 native
cases. Two native fixture families omitted their Node binding, so named operations
selected an unreadable hosted-toolcache executable from PATH. Capture the actual
fixture process executable in those bindings, and add a shadow-PATH preparation
case. Do not broaden production read grants or depend on an implicit fallback to
another installed Node. Retain raw CI 41861791894 and qualify affected fixture
scenarios before refreshing the complete native lane. Earlier queued status
responses do not establish runner wait time; execution logs are authoritative.

The checked-edit bridge now validates proposed captured-suite metadata before
transaction persistence and returns recoverable rejection. The final host guard
remains in place. Twelve built bridge cases pass, including complete-batch
rejection, corrected retry, body edits and new owned suites. Native workspace
preparation passes all seven cases, including a shadow-PATH executable; no skips.
Build, strict type checks, formatting and lint pass for this bootstrap batch.
Current-revision ownership validation and refreshed CI remain separate evidence.

Efficiency observation: `build:tests` compiles test sources only. An initial
focused run exercised the preceding product build and failed the new acceptance;
a product rebuild then produced the expected twelve passes in under one second.
Use the product build before focused built-program checks when production source
changes, and avoid rebuilding it while native tests are reading that distribution.
This small feedback cycle is much cheaper than discovering fixture drift in the
full native CI lane. The active real runs keep their captured supervisors.

After rebuilding the final test sources, the combined checked-edit bridge and
workspace transaction suites pass all 16 cases (zero skips). A representative
native task scenario also completes its three-owner dependency chain and final
director assessment in 46.1 seconds, with zero skips. This is controlled acceptance
through production wiring, separate from the ongoing real-model task, which has
now activated execution-runtime as its fifth observed owner through a publisher
request. Its earlier report failure remains retained for director reconsideration.

### Validate proposed new suites before mutation (#226)

The same real task's CLI assignment created a new test with a two-argument,
nonliteral `registerSuite` call and an unsupported `owner` metadata field. Discovery
rejected it after the write, leaving implementation without a safe checkpoint.
Extend checked-edit validation to new discoverable suites: share the existing
literal metadata, owner and directory/level rules with normal discovery, reject
invalid batches before mutation, and return corrective feedback. Keep support
files outside suite discovery and retain valid new-suite creation, captured-suite
immutability, stage checks and frozen regressions. The old failed candidate and
captured supervisor remain untouched. Verify malformed registration, wrong owner,
directory mismatch, atomic batches and corrected retries through the built bridge.

CI 41871028425 passed the confined selection and 413 of 414 native cases, with
zero native skips. The remaining authority test assigned `process.execPath` as a
changed Node binding, which became a no-op after the fixture correctly captured
that same executable. Make the mutation explicit with a distinct executable alias
and assert the before/after binding differs. Preserve the rejection assertion and
all production authority checks. This fixture correction accompanies #226 rather
than repeating another long CI cycle on its own. The raw failed run is retained.

The assembled #226 bridge, transaction and discovery coverage passes 26 cases with
zero skips. The repaired native authority suite passes 13 cases with zero skips,
including the distinct executable binding and unchanged-authority controls. Build,
strict type checks, formatting and lint pass. CI for the preceding revision passed
the complete confined selection; its 413/414 native result is not a current-head
pass. The new-suite guard and fixture correction are assembled for one refresh.

Efficiency lesson: apply an existing validation rule at the earliest checked-write
boundary for both existing and proposed files. Restricting the first repair to
captured suites left malformed new registrations able to fail a later activation.
The follow-up shares discovery rules rather than introducing a second parser.
Focused assembled checks took about seven seconds; the prior CI job spanned
16:47:42–17:15:40 UTC. Preserve the latter as measured job duration, not queue time.

### Preserve publication attribution during candidate handoff (#227)

The completed container task returned its verified candidate to the workday after
automatic resumption. Checkpoint replacement and explicit resume succeeded, but
workday dispatch then tried to publish that inherited task-owned candidate as a
new workday delivery. Strict candidate identity checking rejected it and halted
otherwise ready work. Automatic capture must recognize inherited verified baselines
without relabeling their records or creating duplicate deliveries. Validate retained
handoff provenance, keep mismatches explicit, and publish later current-run verified
engineering through the unchanged independent-verification requirements. Exercise
this boundary with publication enabled; retain the failed live workday unchanged.

### Refresh observed simulated checks on explicit publication retry (#228)

The real simulated delivery's dependency installation failed with HTTP 403. Its
explicit publication retry reused the completed failed check receipt and therefore
could not make progress. Keep that receipt immutable and keep commit, push, PR,
merge and release identities unchanged. Persist a distinct host check-attempt
identity for an explicit retry, deduplicate a still-pending request, and reconcile
all uncertain prior check effects before executing a new observation. Recovery
must reuse its retained attempt; no caller-selected commands or target overrides
are introduced. Cover observed failure then success, duplicate requests and
uncertain checks through actual simulated provider transitions and the host service.

### Real container task and retained-work replacement

Real simulated task 8282e6eb-b9b5-407e-ba48-69ee65e69958 completed engineering and
goal assessment on immutable a7fb6f8. The release steward delivered container
recovery guidance and dynamically requested the maintenance-owned changelog.
Independent verification caught an incorrect report path; review also required
preserving an explicit state-directory override in the replacement recipe. The
steward corrected both through checked edits. A model-capacity failure in later
independent verification was recovered by the real director from the completed
engineering checkpoint, without manual changes or replay of uncertain operations.

The task safely interrupted workday dc7fc89b-0a41-4536-a26e-a952bc100746 and the
workday resumed automatically at 17:20:38 UTC. A subsequent explicit safe pause
captured four assignment records and two unfinished source files. Replacing the
container with the same image and retained volume preserved the exact checkpoint
fields and file hashes. The old container exited successfully with PID zero.
Explicit resume in the replacement continued the existing report inbox dependency.
Execution remains UID/GID 1000, all capabilities zero, no-new-privileges enabled.
This proves same-mount recovery, not unfinished-checkpoint relocation to a new path.

Simulated delivery fd1de7c3a7033c50f607f8e6c19eeb0f7cec9c79249621359ad6da9f9b50b31f
retains verified engineering, a commit, push and PR. Publication checks encountered
an npm registry HTTP 403 while fetching glob-parent 6.0.2; integration/release are
not yet established. The publication retry was accepted after replacement but reused the failed
check receipt without executing a fresh check; #228 addresses this defect. An earlier retry attempt timed out on read-only host discovery before
its publication request was sent. All failures remain recorded. Recovery evidence
is indexed by qualification-148-real-container-a7fb6f8/evidence/recovery-manifest.json.

Bootstrap e5a650a passes 26 focused edit/discovery cases and 13 native authority
cases, with zero skips; build, strict types, formatting, lint and committed unified
validation pass. CI 41877397062 is separate and pending. CI 41871028425 passed the
full confined selection and 413/414 native cases; the remaining fixture mutation
was corrected. CI 41876713346 was cancelled early after local committed validation
caught an import cycle, which e5a650a removes. Validate a committed candidate before
pushing, so architecture feedback does not consume a complete CI round.

After replacement, workday dispatch encountered the inherited-candidate publication
identity defect tracked in #227 and entered needs_attention. The recovery evidence
proves checkpoint preservation and resumed execution, not successful ongoing
workday completion. Neither frozen supervisor nor failed evidence was modified.

The #227/#228 bootstrap batch passes eleven built-program cases with no skips,
covering inherited provenance, pending-request identities, actual simulated
publication failure followed by fresh successful checks, unchanged mutation
receipts, and refusal to bypass uncertain checks. The focused run took 13.3 seconds.
This deterministic provider evidence does not replace a new real-agent release
qualification. The native real task has independently completed its runtime
dependency and resumed publisher verification; report and CLI failures remain.

Efficiency observation: workflow identity transitions and failed-check retries
need focused production-service tests before another expensive real run. A valid
checkpoint can survive container replacement while a later publication boundary
fails; test those claims separately rather than interpreting recovery as full
lifecycle completion. Mandatory full checks repeated after small documentation
corrections dominate cost; any future preparation reuse must prove unchanged
inputs and confinement instead of weakening verification.

### Reject disconnected behavioral regression scope before preparation (#229)

A real report dependency was narrowed to its source directory despite requiring
behavioral regression work. Enforce the captured Node test-profile source-root
requirement during assignment resolution, before workspace preparation or model
activation. Reuse the test path resolver's root definition. Return an actionable
scope error without widening the assignment. Preserve documentation, research,
review, refactor and custom-operation workflows; permit new suites beneath owned
test roots even when no suite exists yet. This necessary structural check does not
prove that the permitted tests can establish the requested acceptance criterion.
Further feasibility findings remain explicit rather than inferred from prose.

The #229 resolver checks pass twelve focused cases with no skips, including
package-root anchoring, new regression paths, a similarly named sibling rejection,
custom verification, nonbehavioral workflows and existing checked-edit registration
validation. The check reuses the testing owner's root resolver and runs before
workspace preparation. It diagnoses a necessary path constraint; it cannot prove
acceptance feasibility or automatically renegotiate a narrowed dependency.

A fresh real simulated container workday a7623609-a3d0-41d1-a1bd-2872b3c02094
started with frozen supervisor b9dd9ac and environment
bd3b471a-dc0f-449d-aeaa-75c3e3b6e3ea. The previous workday was explicitly stopped
with its unfinished changes retained; no old activation was replayed under new
authority. This run does not include the subsequent #229 bootstrap change.

### Page director evidence without reducing eligible owners (#230)

The native five-owner task retained six verified deliveries, then final blocked-task
direction exceeded the installed runtime's input limit (1,058,524 characters in
that invocation). Preserve the raw failure. Keep the original goal separate from
retained state, and pin the complete eligible catalog, assignment checkpoint facts
and feedback behind the existing report-owned EvidencePages MCP capability.
Supply a compact discovery index and per-owner/per-assignment artifacts so the
director can retrieve relevant facts without an initial history dump. Do not
truncate evidence, filter eligible owners by the lexical shortlist, or introduce
execution budgets. Exercise real MCP paging with more than one megabyte of retained
evidence and safe/unsafe continuation, then qualify a fresh supervising revision.

The #230 batch also pages workday owner history, task clarification/references and
goal-assessment input, preventing the same overflow through adjacent entry points.
Complete worker results remain labeled claims alongside observed checkpoint facts.
Twenty native direction/verification/recovery cases pass, including exact retrieval
of inputs larger than one megabyte. Seven further native cases pass after the final
workday/reference wiring changes; no native skips. These are controlled MCP
acceptance results, not a real-agent qualification of the new supervisor.

CI 41877397062 is green for e5a650a: the full confined selection passed and all
414 native cases passed with zero skips. Later bootstrap changes still need their
own assembled CI. The original real task now has six verified deliveries but
remains needs_attention after its oversized final-direction invocation; its queued
portfolio goal has started under the same frozen supervisor with four director-
selected owners. The new container workday remains on frozen b9dd9ac.

Efficiency observations: the native task retained 211 distinct host-command logs
with summed durations of 6,564,723 ms, including 31 Node test invocations totaling
3,942,522 ms. These are invocation costs, not wall-clock or model time; component
and whole-repository test runs are included. Preserve exact-input evidence reuse
as an optimization target, without changing active checks. The large-history
regressions use 32,768-character transport pages instead of the small-page stress
fixture default; all bytes and hashes are still checked. Do not repeat a proven
unfinished-file pause gate merely to delay the next useful publication task.

### Return invalid dependency scope to its requester (#229 continuation)

The early resolver check prevents expensive activation, but creating a recipient
with an invalid accepted scope would still strand the dependency. Validate a new
request batch before persisting recipient assignments. Return known-owner scope
errors to the requester's retained thread in a read-only coordination activation,
then yield normally to the scheduler. Preserve the original engineering stage,
plan, frozen regression and authority; never widen an accepted assignment or
partially route a fan-out batch. Existing deliberately linked assignments keep
their store-enforced matching rules. Unknown owners remain explicit blockers.
Use the existing equivalent-failure diagnosis, not a new retry quota, and qualify
corrected resubmission through production request routing.

The first requester-correction native acceptance passed: an invalid two-request
batch creates no recipient; corrected requests route once through a retained
read-only activation, and unrelated work remains runnable. Admission and recipient
capture now share one intent normalizer to prevent default drift.

CI 41886521596 failed in the confined inspection suite before native execution:
the historical skill-maintenance preview implicitly requested behavioral work
from an owner without regression-test authority. Its fixture now declares its
actual documentation workflow; the behavioral scope guard remains intact.
Efficiency observation: preserve workflow intent in acceptance fixtures rather
than treating every prompt as a feature change. The focused scenario catches this
without another full native cycle.

### Expose existing work before creating dependencies (#231)

The real portfolio task expanded four starting assignments into ten assignments.
Some are distinct contract and research contributions; the count alone does not
prove duplication. Engineering workers nevertheless lack the current-run identity
and intent index needed to deliberately link director-created starting work.

Expose immutable assignment metadata through the existing paged assignment.evidence
capability for engineering as well as investigations. Include not-started owners,
objectives, acceptance, declared workflow/scope and accepted-intent status. Keep
private checkpoint/source evidence on the existing read-only investigation path.
The report library owns this projection; execution-runtime binds it to the active
assignment, and assignment guidance distinguishes clarification from new work.
Preserve exact store matching, milestones and all authority checks. Do not infer
shared work from similar prose, force a team, or change active supervisors.

The #229 correction coverage now also starts from an actually accepted research
plan before rejecting a dependency batch. Both early-planning and accepted-plan
cases pass natively without skips; the latter explicitly requires a nonempty plan.
This strengthens the earlier optional-state comparison without changing production
behavior. The b9dd9ac container separately passes eight focused source/network
confinement cases without skips, under enforcing AppArmor and zero capabilities.

The #231 batch passes ten focused MCP, request and continuation cases with zero
skips, plus twelve store/milestone cases. Engineering reads exact supplier intent
and links the existing assignment through normal routing; foreign runs and private
checkpoint data are absent. Request admission now shares the store's workflow
inheritance resolver, preserving null-kind research/documentation requests instead
of incorrectly treating them as new behavioral work.

CI 41890063655 passed the full confined selection and 428 of 429 native cases with
zero skips. Its sole failure was a historical task-reference assertion expecting
inline context after #230 moved it behind evidence paging. The corrected test now
reads the exact retained question through MCP and passes in the focused batch.
No real-agent claim is made for these bootstrap changes; the two running real tasks
retain their original supervisors. The portfolio task's additional assignments
include distinct contract and research contributions, so their count alone is not
proof of duplicate implementation. Future runs can now inspect existing work before
choosing whether a new request is necessary.

### Project durable collaboration milestones (#233)

The actual b9dd9ac task has tracking and meaningful dependency/review transitions,
but its simulated provider still contains no comments. Merely exposing the worker
MCP tool does not guarantee the accepted issue-to-delivery history. Project durable
assignment waits and terminal outcomes through the existing captured comment grant
and upstream executor. Bind issue, owner and environment to host state; use stable
input-derived identities, reconcile uncertain effects, and retain complete receipts.
Do not comment on polling or model tokens. Verified delivery must remain distinct
from accepted intent, blocking and interruption. Empty stewardship and absent
comment grants create no new effects. Reconcile outstanding milestones before
further engineering or goal assessment so a host loss cannot skip a final comment.
Existing supervisors and provider evidence remain unchanged.

The #233 bootstrap passes five focused provider/receipt cases and five native
production-scheduler cases without skips. Coverage includes task/workday comments,
unchanged observations producing no new events, a crash after provider mutation but
before the host receipt, unknown provider progress preventing replay, absent grants,
and empty stewardship. The real nested three-owner fixture observes wait comments
and three verified-delivery comments through the production scheduler. These are
controlled acceptance results, not fresh real-agent qualification. Formatting, lint,
strict types and builds pass locally; committed validation and confined selection
follow the assembled commit.

CI 41898547101 passed at 3a3d2e4: the full confined selection and 433 native cases
with zero native skips. The native phase took 12.8 minutes and the entire job 22.5
minutes, faster than the earlier 35-minute job; no causal performance claim is made
without equivalent host/environment evidence. This CI does not cover the later
milestone-comment change. The real container publisher correction passed independent
review; its CLI and dynamically discovered maintenance assignments continue.

A subsecond disposable relocation probe at 3a3d2e4 retained identical committed
source but changed the execution-host key after moving the repository and state.
Issue #232 tracks this absolute-path identity gap separately from already-qualified
portfolio relocation and same-mount container recovery. Historical evidence and
active supervisors remain unchanged.

A further #233 provider-boundary case rejects a foreign-environment tracking issue
before any comment mutation. All six focused provider cases pass without skips;
the native scheduler evidence remains unchanged. The shared lifecycle-effects tag
keeps subsequent CLI selection focused on this changed behavior.

### Owner engineering checks and assembled delivery verification (#234)

New captured authority separates finite `delivery` operation usage from assignment
`verify` usage. Inherited delivery operations run on the assembled immutable head
alongside owner checks before publication; engineering does not repeatedly execute
those repository-wide checks. ArcNexus declares shared owner lint verification once; checked formatting
proposals remain available during engineering, with formatting enforced at delivery. The inherited test profile supplies its existing run operation
for owner-suite verification without another maintained suite list or leaf recipe.
An explicit verify declaration remains mandatory. An implicit profile check with no
owned suites records non-applicability; it never launches an empty Node test command.
Current suite discovery uses captured ownership/profile rules, including first new
suites, and preserves captured suite identities. Final repository checks and
independent verification remain mandatory. Existing runs retain their supervisors,
operation plans and acceptance sources unchanged.

Efficiency evidence: one real publisher research record used 23 commands totaling
610,494 ms, including two full-suite invocations totaling 393,875 ms and dependency
installation of 82,213 ms. These are summed command durations, not wall/model time.
Separate unavoidable preparation from repeated verification before optimizing
further. The b9dd9ac director's final assessment also exposed a test-only follow-up
misclassified as behavior change; a normal task answer requests a new characterization
assignment without mutating the blocked assignment or manufacturing regression red.
CI 41904603474 passed at adbddb8; fresh real-agent milestone comments remain unqualified.

The scoped-check batch keeps formatting's existing coverage instead of expanding
it to every owned Markdown/YAML file: that would introduce unrelated baseline
failures. Artifact packaging also moves to delivery. Focused checkpoint/catalog
coverage passed 15 cases without skips before the final evidence case was added.
Two fixture errors (a missing test-level directory and missing workspace state
roots) were caught by focused tests, not treated as runtime defects. Strict types
caught an unchecked unknown evidence value. Prefer production state initialization
and literal metadata conventions in new fixtures to avoid this rework.

The real-project policy suite repeatedly reconstructed an unchanged TypeScript
catalog. Reusing its immutable captured context within that suite removes repeated
analysis without dropping assertions; the built CLI validation remains a separate
production-path check. No timing benefit is claimed until measured. Active real
runs still perform their original full baselines, as explicitly required.

The assembled #234 policy passes 20 focused cases and one native delivery-check
case without skips; the native case observes the failing command's exit code and
publication checkpoint rather than faking a failed result. The first CLI-selected
run exposed overbroad test discovery: refreshing every catalog-backed operation
expanded two explicitly selected suites into all suites owned by those components
(19 tests, 10 passed, 9 native skips). Restrict mandatory refresh to actual assignment
and publication-check records; explicit test CLI filters remain authoritative.
Add a focused selection-preservation regression and repeat the production CLI path.
This is why actual command selection matters in addition to planner unit tests.

Issue #235 records the real follow-up's workflow/decomposition gap: a test-only
coverage correction was captured as behavioral work, and a new assignment alone
cannot settle its blocked predecessor. Preserve both records and require explicit,
verified replacement semantics; never fabricate predecessor completion. The active
b9dd9ac supervisor is unchanged. CI 41904603474 passed the prior collaboration batch,
including 433 native cases with zero native skips; #234 has separate pending CI.

### Reject infeasible specification scopes before engineering (#235)

Behavioral assignments already require actual documentation and regression changes
at the specification checkpoint. Admission must establish that the narrowed writable
scope can contain both kinds of evidence, using the same captured classifier and
package test-root rules as checked edits. A scope containing only an existing test
file cannot satisfy the documentation requirement. Return actionable scope/workflow
feedback before creating its assignment or preparing its baseline; do not silently
widen scope, rewrite an active workflow, or manufacture a failing characterization.
Documentation-only and refactor workflows keep their distinct requirements.

This structural check prevents the demonstrated invalid capture. It does not by
itself resolve already blocked assignments or implement the explicit replacement
protocol tracked by #235; those records retain their original evidence and status.

The b9dd9ac characterization follow-up then failed its observed `format:check` on
`tests/gateway/cli/acceptance/cli.test.ts`. Its log establishes an ordinary formatting
deficiency, not uncertain transport or unavailable confinement. The refactor branch
bypassed specification-quality correction and terminated before establishing a safe
checkpoint. Extend the existing observed-failure correction boundary to passing
characterization checks: keep criteria, scope and operation authority fixed, retain
the actual diagnostic, and return to specification correction. Cancellation,
uncertain completion and unsafe source state must still propagate without retry.
Do not replay or reclassify the retained b9dd9ac record. This is a fresh-runtime fix.

The workday continued after the task entered `needs_attention`, preserving failure
isolation, but its assignment steward also hit a terminal missing-documentation
postcondition. Scope-checked missing documentation/test evidence now uses the existing
specification-correction signal; cross-owner writes remain terminal rejections. The
retained run is not edited. Three native continuation/refactor cases passed without
skips before this additional postcondition coverage; refreshed focused evidence follows.

CI 41910757535 caught two foundation assertions that still required repository-wide
quality at each engineering checkpoint. Update those assertions to the architect's
newly accepted policy: exactly one inherited owner lint requirement for engineering,
exactly one inherited full lint/format requirement for delivery, and one authored
platform declaration. Preserve all assertions about mandatory checks and ownership.

Passing characterization now freezes current owned test sources using captured
classification, including a first new test file; it no longer relies on the captured
inventory containing that file already. Director instructions explicitly distinguish
changed behavior from characterization so test-only coverage is not needlessly
assigned the behavioral workflow. These changes remain bootstrap repairs pending
fresh real-supervisor qualification; the full replacement protocol is still tracked
separately in #235.

Owner formatting refinement (#234): deferring all formatting to delivery is too late
for already frozen regression/characterization sources. Supply a scoped read-only
format check using exactly the existing repository formatting coverage intersected
with captured owned paths. Centralize that existing coverage once in the shared
foundation formatter; full check/write commands and the owner check use it. Keep
optional checked formatting proposals available for other owned documents without
turning those documents into new baseline requirements. This replaces the earlier
interim delivery-only formatting choice and avoids repeated authored path lists.

CI 41915348793 passed formatting, lint and strict types, then found three testing
compatibility failures: implicit profile verification rejected historical inline
profiles while merely inspecting minimal catalogs. Keep historical test discovery
read-only and retain its existing migration diagnostic on `test run`. Require the
shared profile at assignment admission, before preparing or executing engineering;
inspection must not create an executable compatibility adapter. Add a focused
admission regression and reuse the existing built-CLI discovery cases. The cheapest
additional check is this four-case suite, not another early full repository cycle.

The discovery correction passes all 15 focused admission/discovery cases with no
skips, plus full formatting, lint and strict typing. It preserves inspection and
rejects legacy profiles at assignment admission; no inline runner was restored.
The scoped-check production CLI selection passed nine checks and skipped its one
native-only case, which has separate passing native evidence. Its operation report
is `493cb75f-29a8-4de6-b710-2842d7135c74`. A fixture that only assigned a profile name
needed the matching captured declaration after admission validation was strengthened;
this was caught in the focused suite before CI. Preserve the old supervisor runs.

Next self-development objective: ask a fresh real director to address explicit
verified replacement of failed task assignments (#235), including durable dependency
and evidence semantics. Use the actual eligible component catalog and ordinary
simulation lifecycle; do not select a team or manufacture predecessor completion.
This delegates useful remaining implementation to the system once the fresh runtime
has its assembled checks, rather than manually duplicating active portfolio work.

Fresh real-agent qualification now runs in an isolated managed volume under immutable
supervisor `76c1965d0fc684fb82f4c5ba42176beabde563b3`, container
`arcnexus-real-148-76c1965`, task `4cc89ae6-a69b-4da7-9534-0f099d86931c`.
Its real director is reading the actual eligible catalog; no team was forced.
The submitted objective is the remaining replacement-recovery work in #235.
The five preparation commands took 92,532 ms in aggregate, before engineering;
this is separate from model time and remains necessary preparation, not a removed
engineering verification loop. Source, prompt, container invocation and bootstrap
check hashes are retained under
`~/.local/state/arcnexus/qualification-148-real-container-76c1965/evidence`.
The earlier native portfolio task and b9dd9ac workday remain under their original
supervisors. A fresh task is not evidence of successful completion or publication.

Repository instructions and the foundation quality reference now explicitly separate
owner-scoped engineering from full assembled-delivery verification. These guidance
edits are bootstrap work and do not change any run already captured. The next long
integrated result is CI 41918415928 for 76c1965; do not restart that same full cycle
merely for this documentation alignment.

Real qualification exposed #236 before engineering: the execution-runtime baseline
passed 26 cases, failed six collaboration-progress cases, and explicitly skipped 119
native cases. All six failures came from `GeneralFixture` requiring a native machine
binding for tests that never launch a harness. The candidate correctly lacked the
host's Git-private bindings. Separate reusable catalog construction from native
harness setup, keep these provider/store checks portable, and exercise them through
the actual confined CLI. Do not add skips or fake native enforcement. Preserve task
`4cc89ae6-a69b-4da7-9534-0f099d86931c` and its supervisor; its director correctly
reported that the failed baseline has no safe continuation. A new corrected run is
required. This fixture defect cost preparation and director time despite prior native
passes; testing the portable selection without ambient bindings is the cheap guard.

The #236 correction is committed as `8f1c40c`: portable catalog construction is
separate from native harness setup. Six focused collaboration cases pass without
skips, and the native three-owner director scenario still passes (43.016 seconds).
The production confined CLI selection from a separate checkout with no local
machine binding passes six portable cases, skips seven other designated native
cases, and fails none. Full format/lint/types and consolidated validation pass.
The portable fixture now asserts empty machine-tool bindings and no model-call
file, so an ambient CI binding cannot conceal this dependency again.

A fresh task, `a6e7a19c-cca0-4080-a65e-c0905b85f6d6`, runs corrected source under
the same immutable 76c1965 supervisor. It passed the actual execution-runtime owner
baseline: 32 tests passed, 119 designated native cases skipped, zero failed. Owner
lint, scoped format, required build preparation and selected tests totaled 16,322 ms
of command time, excluding initial workspace setup and model time. This is an
observed workload, not a controlled benchmark against the earlier publisher run.
The real director selected the starting work; execution-runtime and task-intake
have entered the scheduling cycle. Goal completion and publication remain unproven.

The unfinished-volume relocation probe also confirms that Git worktree administration
contains absolute links: moving source and an unfinished candidate together retains
candidate bytes but makes Git resolution fail. #232 therefore needs validated,
journaled metadata repair as well as durable application identities; changing the
project-key hash alone would not complete recovery. No retained run was modified.

Preparation remains an observed cost after scoped checks: fresh assignment installs
spend about 85 seconds launching one npm process per applicable locked artifact.
#237 qualifies batching cache preparation into one npm invocation with an explicit
per-origin connection bound, followed by the existing offline integrity-checked
install. Installed container npm 10.9.9 accepts multiple specs but internally uses
Promise.all; batching without a connection setting would change transport behavior.
Preserve validation before dispatch, platform filtering, failure evidence and source/
network confinement. Test through the declared executor before adopting the speedup;
never change a running assignment's captured script or execution policy.

The #237 preparation experiment passed through `platform create`, `package create`
and `workspace prepare` on a separate source clone in the qualified container,
using the existing shared operation executor and unchanged 76c1965 runtime.
Record `b99151ca-9ec5-4e19-9782-11d647a44fe2` captured the new install script at
source `f580f8d`: installation took 29,802 ms, every command exited zero, and the
production build passed. Source and prepared workspace both remained clean.
Earlier fresh assignment installs were approximately 85 seconds; report this as an
observed improvement under the same container runtime, not a controlled benchmark.
The four subprocess-boundary cases cover multiple deduplicated URLs, platform
filtering, empty selection, invalid sources and failure without retry. Evidence is
retained in `qualification-148-real-container-76c1965/evidence/setup-237`.
Active tasks continue using their original installer and captured source.

CI 41918415928 completed the full confined suite, then passed 432 of 433 native
cases with zero native skips. The only failure was another old policy assertion:
assignment inspection still expected the full repository test command inside owner
verification. Change that assertion to require focused owner tests in `verification`
and full tests in the captured delivery plan. Align the corresponding operations
reference; retain historical acceptance narrative with an explicit current-policy
note. This test failure cost a 21-minute native sweep, so search expectations by both
operation identity and command argv when moving a policy boundary. Do not repeat the
entire sweep to diagnose a single already identified assertion.

The corrected inspection assertion passed with all seven original prior-evidence
cases (49.467 seconds, no skips). The inspection-only case is now a separate
portable `scoped-checks` suite rather than borrowing the native harness wrapper;
its confined production-CLI qualification follows. Native selection will contain
one fewer case and portable coverage one more: this moves coverage, not removes it.
The live operations reference also no longer presents the historical research-turn
quota as current behavior; the historical acceptance record is explicitly labeled.

### Remaining repository migration (#238)

Bootstrap work now completes remote migration independently of the real stewards'
creation/replacement assignments. Reuse the existing clone journal and portfolio
transaction rather than adding a second Git execution path. Preserve attached
checkouts, require compatible committed destination authority, and reject active
execution or uncertain transitions. This work must not alter any active supervisor.
The 40f5da3 assembled batch has been pushed once; CI 41925434578 is running.

### Correctable owned-path narrowing (#239)

The fresh real replacement task discovered coordination-store, report and maintenance
through real inbox requests. Coordination-store then attempted its owned documentation
path outside the accepted assignment's narrowed source/test paths. The host prevented
the edit, but a generic exception ended the assignment and blocked its dependent.
Unrelated report/maintenance work continues. Preserve this failure and active run.

A future supervisor should return a structured, non-mutating rejection for a path
owned by the steward but excluded by assignment narrowing, including its captured
allowed paths. The steward may correct the request; it gains no authority. Cross-owner
requests, wrong-stage writes, frozen tests, unsafe files and uncertain recovery remain
hard barriers. Test the entire batch remains unchanged before accepting a subsequent
in-scope edit. This avoids spending a new setup and model session on a correctable
owned-path mistake while preserving every source-write permission.

The architect additionally requested actionable cross-owner edit feedback: identify
the actual accountable steward and instruct the requester to send it the intended
change and acceptance criteria through the existing inbox protocol. New captures
will derive owner/path routing from the same immutable catalog, not candidate edits
or a second authored registry. A known cross-owner path will return a non-mutating
rejection with delegation guidance; it will not terminate an otherwise safe turn.
Unknown/ambiguous ownership remains an architectural blocker. Unsafe paths, workflow
stage violations, frozen regressions and uncertain transactions still fail closed.
This supersedes the earlier proposed hard termination for known cross-owner requests.

### Steward-owned file decisions (#239)

Component ownership alone determines who may edit a maintained file. Directors,
workday proposals and inbox requesters describe objectives, technical constraints,
acceptance criteria and required deliveries. They do not select files or supply a
second write boundary. The accountable steward discovers which owned files to
change. Write-capable tools remain host-checked; read-only activities, sandbox
integrity and verification of the frozen acceptance baseline remain in force.
A known foreign owner is a delegation destination, never a write grant. Reject
retired assignment file lists rather than silently executing old restricted work
with broader permissions. Active hosts retain their captured supervisor.


The ownership-only contract removes the file-list field from director, initializer,
assignment and inbox inputs, including resolved assignment records. Captured
component ownership supplies checked edits, sandbox evidence and diff checks.
Known cross-owner requests get inbox guidance; there is no new approval step.
The real coordination-store failure remains evidence of the old supervisor. On
the new contract, 47 focused cases passed, and three native scheduler scenarios
passed without skips (42 seconds for supplier discovery and corrected dependency
batches). Production CLI selection of edit routing passed both cases. This is
deterministic evidence, not a new real-agent delivery. The cheapest early check
was rejecting all three old list forms (empty, owned-only and foreign) at the
built CLI boundary; it exercises the rule without paying for a model session.

### Ownership-only production submission and setup reliability (#237, #239)

Fresh simulated task 6c6c7afc-ef1c-4537-8eb3-532efd94c9c7 captured revision
8c78dc3 and 21 eligible stewards for the volume relocation objective. Dependency
setup failed with HTTP 403 fetching yocto-queue before the director ran. The
30-second container installation had established speed for one successful batch.
Restore one cache request per locked artifact before offline installation. The
extra setup time costs less than losing a production submission to concurrent
requests. Retain the failed run and use new captured authority for qualification.

### Atomic director admission (#235)

Commit a director's admitted proposals, their captured technical criteria,
continuations and initialization checkpoint in one SQLite transaction. Previously
an interruption between queue insertion and recording the proposal could leave a
ready assignment without its workflow or cause recovery to submit a second team.
Keep provider tracking outside the database transaction. Prove rollback with an
invalid later owner and inspect retained state after reopening the store.

The next fresh native simulation, 75e1aadd-e654-4121-9677-289b0adc83a0,
completed sequential dependency setup in 247 seconds under concurrent host load.
Its real director selected portfolio, workspace and execution-runtime from 21
eligible stewards for volume relocation. These are starting selections. Dynamic
discovery, verified engineering and publication require separate observed events.
Container workday cc67f01a-0f01-430a-bef6-0042818d37e3 started on its own
volume at 0dba58c. The runtime had UID 1000, zero effective and bounding
capabilities, no-new-privileges and the enforced ArcNexus AppArmor profile.
Both runs use their own captured supervisors.

CI on 8c78dc3 exposed two historical-authority diagnostic regressions. Reading
the failed job's individual test stacks and replaying those cases took seconds.
Building the test sources alone reused stale product output. Rebuilding the
product first reproduced the corrected diagnostics. The two historical cases and
four installer cases then passed locally.

### Validate the complete standards library once per catalog (#148)

A package validation could pass an unused standard with an undeclared check,
although listing standards rejected the same revision. Resolve every standard
while building the committed catalog, then use that captured result for inherited
component context and resource queries. This also avoids resolving the same
inherited standard and its documents once per steward during host startup.

### Keep invalid stewardship decisions local to their owner (#240)

The assignment steward on simulated workday cc67f01a-0f01-430a-bef6-0042818d37e3
returned a no-work decision about the workday component. The failed activation
retained the exact response, but the host stopped the whole rotation. Supply
owner-first instructions for a scheduled stewardship turn. Record an invalid
decision against that owner and input fingerprint, preserve the activation
identity and continue unrelated ready work. Candidate integrity, cancellation
and transport failures retain their own handling.

### Remove duplicate ownership from prompt projections (#239)

CI at ca40a3d reported that the combined component views crossed the existing
700,000-character regression threshold. The real catalog measured 700,429
characters, including 9,068 for the historical ownership wrapper, in addition
to resolved writable roots and public API declarations. Emit the effective
owner scope and public boundary once in steward context. Preserve the underlying
captured catalog, complete relationships, historical component views and the
existing size check.

The real formerly rejected workday response replayed through the managed
host boundary in 17 seconds using controlled model input. All four native
idle, refusal and inbox-control scenarios passed in 70 seconds. A separate
real container workday, c65331c7-77a5-4c1e-aa48-3ec9901fcca1, started with
the fix. In the task trial, the three starting stewards exchanged four
persisted inbox requests before any verified delivery. Repeated assignments
to a starting steward count as requests rather than newly discovered owners.
The native simulation confinement suite also rejected descendant HTTP, TLS
and direct-network bypass attempts against listening mutation endpoints.
