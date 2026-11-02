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

## Ordered slices and gates

1. Consolidated validation, standards migration and command/service contracts.
2. Managed portfolio, composed authority and transactional architectural CRUD.
3. Unified command queries, task control/answers and workspace management.
4. Collaboration operations and persistent real-agent simulation.
5. Verified publisher, GitHub/staging policy and explicit promotion.
6. Acceptance migration, container qualification and real self-development.

For each slice: documented intent, failing built-program acceptance, implementation,
verification/review and staging PR. Record direct bootstrap work until the stable
runtime can perform bounded changes. Shared services and a qualified headless container
are included; HTTP, web authentication and React follow in phase three.

Qualification must cover three/five-owner scheduling, mode isolation, task lifecycle,
CRUD conflicts/recovery, migration idempotence, optional/malformed guidance, external
effect deduplication, denied bypasses, publisher gates, promotion conflicts and container
restart/volume relocation. Preserve historical readers and checked source confinement.

Retain six real demonstrations: dynamic three-owner simulated task; useful simulated
workday/inbox; full issue/comment/commit/push/PR/check/merge/artifact lifecycle; unfinished
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
