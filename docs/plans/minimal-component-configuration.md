# Minimal component configuration — issue 109

Status: implementation and qualification in progress; phase 3 remains blocked.

## Contract

Declare architectural intent and authority once. Derive effective policy, ownership,
file classification, public API facts and execution plans from captured source.
Keep schemaVersion and stable component IDs. Version-five definitions distinguish
containers from executable owners. Required common fields are schemaVersion, id,
type and purpose; packages add parentId and leaves add parentId and owns. Optional
objectives, constraints, questions and patterns contain meaningful intent only.

Packages have one repository-relative root (default `.`) and inherit the primary
repository identity. Leaves resolve owns, reads and api relative to their nearest
package. Leaf definition files are automatically owned; containers have no write
authority. Every maintained tracked file has exactly one owner. No coverage exclusions.

Role/executionProfile/testProfile resolve from the nearest explicit ancestor.
Reads may narrow inherited access; owned paths are always readable. Constraints,
patterns and required operations accumulate without duplication; objectives/questions
remain attached to their declarations. Mandatory ancestor verification cannot be removed.
Platform director/reviewer/default-package/verification-input policy replaces the
split initialization and execution.yaml settings.

Remove authored path, repositoryRoot, access.writeDirectories, ownership wrappers,
directoryExceptions, interfaces, relatedIds, provides, consumes, discovery,
coverageExclusions, inline verification and operationIds. Reject retired/unknown fields.
Historical evidence readers remain; old configuration is not a second execution path.

## Derived catalog

Capture ownership, hashes, policy provenance, classification, public exports/signatures,
re-exports, imports, schema references, consumers and unresolved relationships.
Use TypeScript and existing suite metadata. Markdown/MDX/RST are documentation;
test profiles identify tests, including proposed new paths. Package-only classification
exceptions cannot conflict. Unknown files stay owned but cannot satisfy spec/test gates.
Cache by source/configuration digests and analyzer version without replacing run authority.

API entries are module; module+export; schema; or module+export+schema. Every artifact
belongs to its declaring owner. Validate symbols and schema references. Preserve
compatibility promises in constraints/docs. Enforce actual public symbols across
owner imports; derive consumers instead of authoring another relationship list.

## Shared execution and write safety

Operations maps IDs to preflight/setup/refresh/verify/agent usages. One definition
supplies each command/service/HTTP action. Replace embedded setup, prerequisites,
probes and test preparation commands with references. Shared typed argv context:
owner ID, owned paths, package root, selected test files, test output root. No shell
interpolation. Resolve prerequisites deterministically and reject cycles. Deduplicate
within a checkpoint and rerun after relevant candidate changes. Record captured
operation identity, context, purpose, output, artifacts and interruption. Regression
references use operation identities, while historical indices remain readable.

Agents and managed subprocesses see maintained source read-only. A host edit tool,
bound to the active assignment, validates complete create/update/delete requests
before writing. Require expected content hashes and durable idempotent edit IDs.
Reject traversal, symlinks, unsafe hard links, private runtime paths, stale contents,
wrong-stage and cross-owner edits. Recover incomplete transactions before dispatch.
Candidate authority/test changes never redefine active permissions or acceptance.

Operations may write only declared untracked generated roots and private temporary
storage. Reject overlap with maintained source or private execution state. Format/lint
fixes return checked edits. One confinement adapter must prove installed-runtime
support; failure refuses execution rather than granting broad write access.

## Migration and delivery

`arcnexus config migrate` previews a validated diff and diagnostics; `--write` applies
it to a clean checkout without commits/publication. Preserve IDs and authority, hoist
identical defaults, consolidate semantically equivalent commands, retain exceptional
classification and contract associations, and assign old excluded files an owner.
Ambiguity requires an explicit decision; a second successful invocation changes nothing.
Active ArcNexus definitions, fixtures and campaigns migrate. Historical records remain
unchanged. Existing captured hosts keep their supervisor; old unfinished runs cannot
silently adopt v5 permissions or the edit protocol.

Sequential slices: characterization/contracts; minimal catalog; shared operations;
checked edits/confinement; API catalog/migration; integrated qualification. Architecture
owns catalog/schema/API derivation, operations owns execution/confinement, workspace
owns edit materialization, assignment owns workflow restrictions, testing owns shared
selection, execution-runtime owns durable lifecycle, report owns projections, CLI owns
migration entry points, architecture-maintenance owns project definitions and this plan.
Use declared public boundaries. Bootstrap directly only until stable self-development
can perform a bounded slice.

## Acceptance

Deterministic built-program cases cover minimal definitions, inheritance, anchored
paths, ownership, new-file classification, shared argv resolution, required checks,
public symbols/re-exports/schema links, migration/idempotence and historical reading.
Write-prevention cases exercise shell commands, hooks, tests, services and descendants;
checked edits cover aliases, stale content, stages, retries and crash recovery. Retain
three/five-owner scheduling, dependencies, task/workday coordination and interruption.

Live gates: actual checked-edit feature; dynamically discovered multi-owner task;
inherited/shared-operation workday; unfinished edits across pause/resume/host loss;
unauthorized writes denied before mutation; actual ArcNexus self-development delivery.
Retain real diffs, independent reviews and evidence; controlled fixtures are not live runs.

Run affected inspect/run suites, then the full suite, format:check, lint, check, build,
built validate and guidance validate. Observe 500/30 physical-line limits and documented
classes/methods. Report local, CI and live evidence separately. Record before/after
field and distinct-command counts. Complete through issue-linked staging review/CI;
never weaken frozen acceptance or publish automatically.

## Current delivery status (2026-11-02)

Minimal catalog loading, shared finite/service/HTTP operations, checked edits,
confinement, derived API relationships/cache and captured director identity are
implemented in the working branch. Version-five change assignments now use the
checked engineering path. The [first real checked-engineering task](../library/assignment/checked-engineering-qualification.md)
completed with an actual diff, expected-red and passing host checks, independent
verification and final director assessment. A [real workday](../library/workday/checked-workday-qualification.md)
also completed a self-directed improvement, preserved its unfinished checkpoint across
pause/host loss/resume, and automatically yielded to and resumed after a task. Minimal
live gates 1, 2, 3, 4 and 5 have evidence, with host loss qualified at a safe checkpoint
and native owned/cross-owner write attempts denied before mutation.

The maintenance CLI now previews and applies a fully validated migration through
checked transactions; an immediate second invocation makes no changes. ArcNexus's
21 definitions have migrated to v5, its environment and operations to version 4,
and its test profile to version 2. The duplicate execution configuration is removed.
Four historical qualification records now have explicit maintenance ownership and
unchanged bytes. Migration still rejects mixed families and dependency-local inline
recipes requiring unresolved conversion; it does not silently guess their authority.

The first real migration reduced component top-level fields from 456 to 228 and
recursive object keys from 1,100 to 415. All 96 inline component commands disappeared.
Across architecture configuration, authored command objects fell from 159 to 57;
distinct command/argv pairs changed from 53 to 54 because the previously hardcoded
Node runner became explicit. A subsequent checked catalog comparison consolidated 17 owner-specific test
commands, then shared direct Node execution replaced recursive test CLI wrappers
in both agent and host checks. Build and test compilation remain prerequisites.
The current configuration has 211 component top-level fields, 367 recursive keys,
one inherited test profile, 21 operation definitions and 18 distinct command/argv
pairs. Shared lint and checked formatting are delivered; migration and removal of
legacy executable paths remain necessary before final no-duplication claims. Empty agent test selections remain pending until invocation; mandatory
verification still rejects empty context before any prerequisite executes.

Real-project preparation now passes confined prerequisites, dependency installation
and build. Bootstrap repairs preserve diagnostic shims, disposable output roots,
short private operation paths, snapshot permissions and read-only resolver access.
Issues #123–#127 retain the observed failures and focused acceptance. Issues #128–#130
address live correlation, pagination, duplicated model context and control-response
waiting failures. Full snapshots remain authoritative; model context is a compact
projection with grouped import observations rather than repeated execution plans.

At `72b7748`, the focused control/host-loss cases pass 3/3; evidence pagination passes
5/5; inbox and coordination cases pass 13/13; first-suite operation cases pass 13/13,
including installed-runtime execution. The committed shared test runner completed
40 operations cases with 14 native tests skipped inside confinement; separate native
probes are reported independently. The preceding full pass stopped on an obsolete
`npm test` assertion (94 assignment passes, one failure, one skip). Its replacement
now verifies direct full and focused checks. A fresh integrated pass is in progress;
no final integrated or current-head CI success is claimed here.

The [live multi-owner attempts](../library/task-intake/multi-owner-qualification.md)
retain unsuccessful outcomes and the discovered tool-guidance defects. A subsequent
three-owner documentation task completed with independent reviews and director
acceptance. Complete fixture/campaign migration, removal of legacy execution branches
and live gate 6 remain unfinished; formatter transformations were delivered in the subsequent
checkpoint below. Broader phase-3 inbox and
active-operation crash gates still require live evidence. Phase 3 remains blocked.
Direct implementation work remains bootstrap work; the successful qualification
changed a fixture package, not ArcNexus itself.

### Subsequent integrated checkpoint

ArcNexus now has 21 v5 components with 211 top-level fields and 367 recursive keys,
compared with the original 457/1,104 baseline. Its 21 shared operation definitions
contain 18 distinct command/argument pairs. These include newly explicit execution
and formatting behavior, so distinct-command counts are not an equivalence claim.
One inherited lint definition replaces 17 owner-specific definitions. The checked
formatter returns hashed edits through the existing source-edit protocol; two
assembled command cases and a real confined operation invocation passed.

The shipped general fixture now uses five minimal container/owner definitions
(three executable owners), 43 top-level fields, 50 recursive keys and two shared
operations. Its assembled catalog/campaign/test acceptance passed. Other historical
fixtures and remaining legacy executable library branches still require migration
or retirement; their presence is not counted as completion of the plan.

Current focused evidence includes 17 inbox/action cases, 16 delivery-context and
continuation cases, six local-binding/workflow cases and five binding/executor
cases including native confinement. All four host-lifecycle cases passed through
the production test executor in run `388ec80e-bd32-4da2-85e7-835830743b94`.
The preceding rerun passed three and failed recovery with temporary-filesystem inode
exhaustion; the successful rerun used private temporary storage on the main disk.

The integrated run `a08a10be-f03f-4ad1-99da-570713f21b1b` passed architecture
139/143 (four skipped), assignment 95/96 (one skipped), CLI 7/7 and coordination
1/1, then stopped in runtime with four failures. The stale delivery-wait assertion
and runner-mode failures were subsequently repaired and checked in focused suites.
A full passing integrated run is still required. Formatting, lint, types, build,
ownership and guidance passed at `ab8f509`; later changes need final verification.

Hosted CI initially lacked delegated process ownership and then the distribution
namespace profile. The subsequent diagnostic exposed npm PATH selecting an
undeclared local runtime. Shared binding discovery and tool-aware preflight now
address that discrepancy; hosted qualification remains separate from local probes.
The three-owner documentation task subsequently completed; earlier failed attempts
remain retained. ArcNexus self-development has not yet delivered verified changes. The latest self-development
baseline reached 570 tests: 536 passed, eight failed and 26 skipped, with inode
exhaustion recorded in several failures. A fresh run uses private disk-backed
storage and a stable supervisor. No live gate is claimed from that pending run.

## Current execution boundary and qualification (2026-11-02)

New task/workday hosts now reject pre-v5 components before dispatch. Migration
captures old declarations through a separate read-only input reader; preview,
validated application and idempotence remain available. The inline test runner is
removed: `test run` requires shared operations, while historical profile inspection
remains available. Production assignment/workspace legacy branches and the remaining
historical harness fixtures still need retirement or migration.

At `d47c4a6`, the architecture selection passed 141 of 145 tests, with four native
cases explicitly skipped, in retained run `1ceb60c4-7845-4c2e-9caf-91eabba322a4`.
The startup/migration scenarios passed 8/8 separately. At `5c97c15`, the testing
selection passed 24 of 35 tests, with eleven native cases skipped, in run
`80907332-a5a1-49a5-b7d5-3f3d97ef7d6a`. Its migrated preparation, compiler-error,
cancellation and rejection scenarios passed 16/16 with native enforcement and no
skips in `/tmp/arcnexus-109-inline-green.log`. These are distinct evidence classes.

The native-host selection at `da95467` passed 91/91 with no skips in
`/tmp/arcnexus-140-native-selected.log`. Its confined full suite stopped after
449 cases (351 passed, one failed, 97 skipped), run
`3c49fe16-5611-4f27-853b-0ca0fefb807b`. CI run `41423162844` failed on the same
obsolete bridge assertion: denied operation selection is now recoverable. The
replacement checks zero executed operations and structured rejection, and passes
through the real bridge. The complete affected operations selection passed 41 of 57 cases (16 native skips),
run `3bd3a63a-c15b-4aba-9c49-2efe709f7318`. The frozen `5c97c15` integrated run
`d5871042-8bdf-42cf-80ea-03fcd1180556` passed 462 of 582 cases, with 120 explicit
skips and no failures. A separate native-host selection passed 103/103 without skips
(`/tmp/arcnexus-109-native-5c97c15.log`); this is not a claim that every skipped case
was covered. [CI at that revision](https://github.com/treeseed-ai/arcnexus/actions/runs/41426260359/job/125213487007)
passed, including its 103 native cases. Later fixture and migration changes still
require their integrated verification.
Formatting, lint, types, build, ownership and guidance passed for this slice.

The canonical-host fix (#137) prevents different temporary/evidence roots from
creating competing hosts for one repository. A subsequent self-development task
`fdc2f5b7-8928-4b1e-a3c1-1e928ed99c0b` is retained against `da95467`; it cannot
change that baseline to the later assertion repair. It has no verified delivery.
A separate live workday `cdbad9b8-4421-461e-9d0d-8c337adfa830` completed a real
CLI-to-service inbox delivery and requester resumption, with both independent reviews
and caller diff/example checks retained in the [workday ledger](../library/workday/checked-workday-qualification.md).
The self-development run ended `needs_input` after the obsolete assertion failed its
captured baseline (466 passed, one failed, 113 skipped). No edits or independent
delivery qualify from that run. Phase three remains blocked.

## Earlier implementation checkpoints

The following paragraphs record evidence at their respective checkpoints; they are
not statements that later-delivered library slices remain absent.

Issue: [#109](https://github.com/treeseed-ai/arcnexus/issues/109).
The initial catalog implementation accepts minimal v5 definitions, derives package
membership and implicit definition ownership, resolves inherited policies, rejects
retired fields, and classifies existing/proposed files with the same rules.
It is a bootstrap change developed directly; it does not enable v5 engineering execution.

The pre-change architecture suite passed 51/51 cases. After the initial catalog
change, the assembled architecture suite passed 70/70; proposed-file classification
then added two cases, with all 21 focused v5 cases passing. Formatting, lint, type
checking, build, catalog validation and guidance validation passed for the initial
catalog checkpoint. These results are local evidence, not CI or live qualification.

Remaining work includes complete effective-policy provenance and catalog caching,
public symbol/schema/consumer analysis, shared operations and execution wiring,
checked editing and confinement, migration of production configuration and fixtures,
retirement of executable legacy paths, and integrated/live qualification. None of
the six live gates is satisfied by these deterministic catalog tests.

Baseline configuration counts: 21 definitions, 457 top-level fields, 1,104 recursive
object keys, 96 inline command declarations and 11 distinct command/argument pairs.
No before/after reduction is claimed until the real project configuration is migrated.
The installed sandbox probe allowed declared generated output and rejected a source
write with EROFS; this is feasibility evidence, not the required enforcement matrix.

The next bootstrap checkpoint adds shared operation definitions with fixed host argv
inputs and deterministic prerequisite ordering. Checked edit transactions validate the
whole batch, retain before/after images, and recover after actual child-process exits
at journal publication and partial source replacement. The assignment bridge binds
these edits to the active owner, stage and frozen regression evidence. New execution
remains explicitly disabled until all lifecycle paths use the checked runtime.

Twelve focused assembled-program cases pass, including two installed-runtime cases:
source and configuration-home writes are denied, and generated output is allowed;
separate agent and later failing verification invocations retain different artifacts.
The installed runtime is `codex-cli 0.163.0-alpha.10.2`. Its configuration home needs
an explicit read-only grant: merely placing it outside declared writable paths did
not prevent modification. This finding is specific to the tested permissions profile.
The maintained live probe requires `ARCNEXUS_TEST_CODEX`; skipping it is not a pass.
These are enforcement probes, not the six real task/workday acceptance gates.

Shared refresh, stable regression operation identities, HTTP verification checkpoints,
and continuation reconciliation still need integration. Mandatory HTTP verification
currently fails explicitly rather than disappearing from the captured check plan.
Migration and removal of old executable configuration have not been delivered.


The shared-operation checkpoint passed the affected operations (33), workspace (41),
assignment (88), and architecture (75) suites through the test inspect/run interface:
237 cases, with no failures or skips in those local runs. The platform now supplies
new director/reviewer defaults without a duplicate execution file. Environment schema
4 captures composition alone; preparation and cleanup derive outputs from shared
operations. Installed-runtime preparation tests cover generated delivery, deduplication
across owners, setup-script write denial and cleanup. These tests use controlled
fixtures and do not satisfy real task/workday qualification.

Host restart now reconciles journaled checked edits before considering pending assignment
outcomes. Interrupted operations remain uncertain and cannot be replayed automatically;
an incompatible completion outcome is retained without publishing delivery. Conflicting
filesystem bytes remain intact and require attention. Eight focused cases cover this
integration, transaction crashes and assignment edit authority. This is direct bootstrap
work with deterministic host-restart evidence, not live model qualification.

Minimal ownership now drives test discovery for existing and new suites, including
nested package roots and classification exceptions. Test profile version 2 references
shared preparation and runner operations; the built test CLI uses the confined executor,
deduplicates equivalent multi-owner preparation and retains separate invocation evidence.
Minimal components cannot execute legacy inline test recipes. Sixteen focused cases
pass locally, including actual installed-runtime source denial from test code, failure
diagnostics, transport output limits and cancellation. The earlier discovery checkpoint
passed all 21 testing cases; the recovery checkpoint passed all 79 runtime cases.

Issue [#111](https://github.com/treeseed-ai/arcnexus/issues/111) records diagnostic transport
that earlier enforcement probes did not verify. The tested network restriction hides
Node socket-backed stdio types. A host-owned read-only preload repairs subprocess
streams; host-opened regular descriptors preserve the test coordinator's output. The
runtime qualifier now requires stdout/stderr sentinels as well as filesystem denial.
These were controlled fixture checks, not live task/workday qualification. Later
checkpoints delivered dynamic test-context refresh, shared operation lifecycle and
the derived API catalog. Current outstanding work is listed above.

The planning fixture now exercises minimal authority and checked source edits:
14/14 planning cases and two engineering/research characterizations passed with native
confinement and no skips. These use scripted responses and are deterministic evidence.
Issue #141 restored migration's obsolete-profile validation; its four migration cases
pass, including rejection before source mutation. A new live self-development task
`d62115a1-2969-42d8-9351-8da587f564f0` uses the frozen verified `5c97c15` supervisor;
its result remains pending and does not yet satisfy the self-development gate.

The standalone workspace suite now uses minimal authority and shared operations.
Its 18 cases passed with native confinement and no skips, including setup source-write
prevention and parent-loss kernel-scope cleanup. The former command-array assertions
now inspect retained operation invocations. Formatting, lint, types, build, ownership
and guidance passed. The first affected CLI run correctly refused the uncommitted
suite-metadata change (`Candidate changed mandatory test selection`); qualification
must capture the new native-host tag in a committed revision before rerunning.


The committed workspace selection passed 23 of 41 cases with 18 native skips,
run `a1d2bd83-11b5-4de5-960f-bf1aaa67a66f`; the separate native workspace run
passed those 18 cases without skips. Issue #142 closes another mixed-family startup
path: minimal components cannot pair with legacy environment recipes. Forty focused
architecture/migration cases passed, and the final six startup cases passed after
test-helper cleanup. The broader architecture selection is being refreshed.

The real self-development task above completed with CLI exit 0, independent
assignment verification and director goal assessment. Its exact 26-line documentation
diff was caller-integrated as `b216058`; full evidence and limitations are recorded
in the [self-development ledger](../library/assignment/checked-engineering-qualification.md).
All six minimal-plan live gates now have retained demonstrations at their recorded
revisions. This does not remove the remaining legacy execution branches or qualify
later implementation changes; completion and phase three remain blocked on those
requirements and final integrated verification/review/CI.

Issue #143 corrects cross-repository definition accountability without adding authored
fields: dependency components retain their primary-catalog definition identity, and
write scopes remain local to the implementation repository. Bound repositories now
receive exact maintained-file ownership validation. Four focused cases and 28 current/
historical ownership cases passed; the built architecture selection passed 147 of
151 cases, four explicitly skipped, in `ded56393-f786-41a0-8538-b2aef5d2c9ef`.

Composed preparation has moved to the same shared-operation fixture. Seventeen native
cases passed initially; the inherited-read-policy assertion was updated and its native
rerun passed. Active dependency cancellation retains child invocation evidence. Nine
minimal quota/progress cases also pass with no skips. The main assignment workflow
fixture is still undergoing migration and qualification. CI at `7cef823` is pending;
these focused local results are not final integrated completion evidence.

The assignment workflow, cancellation and continuation fixtures now use minimal
captured authority, shared operations and native confinement. Eleven continuation/
checklist recovery cases passed without skips. The workflow run passed 23 of 24 cases;
the remaining frozen-regression assertion was strengthened and passed separately.
Issue #144 records why a generic command-failure assertion was insufficient: the
updated case proves ordinary verification accepts a weakened candidate test while
the captured original regression still rejects the implementation. Twelve of thirteen
steward cases passed initially, and the corrected preflight fault-injection case passed
separately. Obsolete deadline/attempt-allowance cases were removed deliberately;
cancellation, unbounded correction and progress diagnosis remain covered. Types and
scoped lint passed. CI at `7cef823` is green; these later fixture changes still require
integrated verification at their own revision.

Seven prior-evidence cases now pass under minimal authority and native confinement.
The setup-race case uses a generated-output gate: the caller changes its historical
file while confined setup waits, and the session still receives the original captured
bytes. Setup no longer writes outside its workspace to manufacture that race.

The operation bridge, pending/queued work, managed services and progress-report
fixtures now use minimal authority. Twenty-nine cases passed across the final focused
runs with no skips: thirteen command/queue/pending cases, thirteen service cases and
three progress projections. Service probes are shared finite operations; services
explicitly declare their network requirement. Source-output overlap is rejected at
operation preflight, and a denied research write leaves maintained bytes unchanged.
The obsolete private-harness operation-budget case and its unused legacy fixture
were retired. Historical inspection remains separately covered. Foundation lint-tool
and remaining context/initializer/report fixture qualification is still in progress.

Twenty-four context, initializer, report, lint, parent-loss and checkpoint cases
passed with native confinement and no skips. Direction now comes from the platform
profile in these fixtures; the historical model-override behavior is no longer used
for execution. Lint qualification copies only its installed dependency closure into
an explicitly bound read-only tool directory, rather than granting access to an
uncaptured host installation. Historical proposal, manifest and report readers keep
their separate inspection fixtures.
