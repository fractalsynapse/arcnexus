# ArcNexus charter

ArcNexus is the Architecture Studio described in the founding conversation.
This charter records the direction confirmed by the human architect. It defines
intent, not a claim that the capabilities below already exist.

## Purpose

Help a human architect direct software development through a small, understandable
architectural model. Components define responsibilities; stewards maintain them;
contracts coordinate work; tests and observed results establish what was achieved.

ArcNexus is itself a target platform. Its first major success is implementing a
small improvement to its own code through its own steward runtime, under human
architectural direction. Use that loop to develop subsequent capabilities as soon
as it is reliable. Direct bootstrap development supplies only what that loop needs.

## Objectives and evidence

1. **Useful immediately:** the first phase accepts an objective for one component,
   executes real engineering work, runs verification, and exposes the actual diff
   and report through a CLI.
2. **Accountable coordination:** a director turns a goal into a strictly sequential plan
   of milestones, each with exactly one accountable owner drawn from the real component
   catalog. Work that needs another owner becomes the preceding milestone, not a parallel
   dependency. Self-directed workdays are the same loop with a different goal source and
   termination policy, and are deferred until tasks are reliable. The accepted
   [self-development MVP](plans/self-development-mvp.md) defines the current phase-two
   scope, architecture and gates. Earlier lifecycle and managed-lifecycle plans are
   historical scope, not additional prerequisites.
3. **Architect-directed operation:** shared application services support OpenAPI
   and MCP gateways and a React UI for architectural direction, task/workday
   control, portfolio management and evidence inspection.
4. **Self-development:** use ArcNexus to make a real improvement to ArcNexus; retain
   the objective, architectural context, execution record, diff, and test results.
   A manually edited change or scripted agent result does not satisfy this objective.
   Real-agent simulation uses actual checked edits, tests, independent verification
   and artifacts against isolated repositories and simulated upstream services.
5. **Controlled evolution:** incrementally enforce architectural boundaries and
   expand to multiple packages and repositories without replacing the execution loop.

Measure completed objectives, verified changes, failures, blocked work, executions,
coordination exchanges, time, and available usage data. Record unavailable measures
as unavailable. Message volume and generated code volume are not progress metrics.

## Architectural vocabulary

Keep the model small: project, profiles, foundations, dependencies, gateways,
releases/environments, and libraries. A **project** replaces the earlier platform and package
pair: one repository, one knowledge root, one component catalog, one check catalog and one
execution lane. Documentation and tests attach to
relevant responsibilities. Architecture need not mirror directories or individual
functions. Add concepts only when a real behavior cannot be represented clearly.

Each component needs a stable identity, purpose, location/scope, lasting objectives,
constraints, open questions, and applicable reusable standards. Include contracts
and relationships when needed. A steward's role and execution configuration can
be inherited rather than copied into bespoke prompts.

Component definition, persistent stewardship identity, temporary execution,
milestone, and milestone plan have distinct lifetimes. Every execution receives
its own definition and the full applicable parent architectural definitions, plus
relevant contracts and work history. Unrelated implementation and old conversations
are not automatic context.

## Knowledge structure

Project knowledge lives in three spaces with different authors, defined in
[`.arc/README.md`](../.arc/README.md):

- `.arc/architecture/` — the human-guided model: components, roles, execution profiles,
  standards, operations, delivery policy and the plan template. Captured per run and
  immutable for that run.
- `.arc/plans/` — the director's and stewards' working record: one plan per goal holding
  the Focus block, the milestone sequence, the five Steps and their checklists. Generated,
  never hand-authored; a human editing a plan is a bypass, not a direction.
- `.arc/learning/` — what actually happened: observed failures, cost, time, defect
  patterns and proposed standards. Append-only and never authority for an active run.

Architecture is the only place rules become durable. A lesson becomes a standard only when
the architect promotes it from `.arc/learning/` into `.arc/architecture/standards/`, where
it attaches to an activity and reaches every steward performing that activity.

Plans and milestones are workflow, not architecture, and never belong in the architectural
model. The unit of work is the **milestone**; the unit of a milestone is one of the five
**Steps** — documentation, design and contract tests, implementation, review, integration —
and each Step runs as the activity that selects its execution profile. One vocabulary serves
both: the six activities the role definitions declare — `research`, `documentation`,
`testing`, `implementation`, `review`, `release`, in that order — where the design and
contract-test Step is **testing**, the integration Step is **release**, and `research` is
available to every Step. There is no separate stage vocabulary.

## Contracts and locks

Component interfaces are finalized before implementation cleanup, in
[`docs/interface/`](../docs/interface/README.md), and walked from the outside in: project,
foundation, gateway, libraries, release. Each contract states what a component owes its
dependents and never how it is built. A contract at stage `locked` changes only on recorded
human authority; agents propose changes as `component` milestones. Locked acceptance scenarios
become the tests that drive the cleanup, so behaviour is anchored while internals are rewritten.

## Constraints

- Deliver coherent batches of accepted capabilities with tests written alongside
  implementation. Use focused feedback during development and qualify the assembled
  result before integration; follow the development cadence in [AGENTS.md](../AGENTS.md).
- Preserve human architectural authority. A steward proposes changes beyond its
  boundary; it cannot rewrite the approved architecture to excuse a deviation.
- Use one shared deterministic execution path behind eventual CLI, API, UI, and MCP
  gateways. AI performs engineering; ordinary code schedules and records work.
- Execute through one sequential lane per project, one durable store, one verification
  gate and one publication route. Tasks safely coordinate with workdays while preserving
  explicit stop intent and live/simulation isolation. Stewards are dormant definitions
  between activations. Several efforts at once means several projects, not a scheduler.
- Keep one accountable owner per milestone and one authoritative owner per contract.
  Work that needs a different owner becomes the preceding milestone. A request that asks
  for already accepted work links to it; it does not create a duplicate implementation.
- Separate contract acceptance, implementation readiness, and release availability.
  Resume dependent work at the milestone it actually requires.
- A Step that only a human can complete is a named checklist item that ends the run at
  `blocked: awaiting <gate>` with evidence retained. Agents never approve their own
  review, merge to main, publish tags or deploy.
- Record the acceptance as a failing test against the public contract before implementing
  a behaviour change, and keep the observed red as evidence. Do not manufacture a failing
  test or a documentation change for coverage alone; a plan may declare a Step
  not-applicable with a stated reason.
- Govern execution by observed progress and cancellation, without work budgets;
  record failed, interrupted, and blocked outcomes. A workday must end with an honest report, including partial results.
- Verify actual changed paths and executed tests. Prompts and agent claims alone
  cannot enforce scope or prove success. Development success does not authorize production.
- Use concise functions with coherent responsibilities, simple modules, and existing
  tools. Introduce abstractions and dependencies in response to demonstrated needs.
- No placeholder implementations or simulated outcomes presented as working features.
  Deterministic test doubles are useful for tests but cannot prove real harness integration.
- Keep the architectural specification smaller and more stable than the implementation.
- Every milestone carries a simplification ledger naming what was removed, what was
  unified and the demonstrated requirement for anything retained. A positive net change in
  stores, states, owners or subsystems without a cited requirement is a failed measure, not
  a completed objective.
- Learning records and generated plans describe work; they never grant authority, widen
  scope or redefine acceptance for a run in progress.

## Initial technical direction

The initial bootstrap used TypeScript, an existing Codex execution harness and
one repository. Durable coordination uses SQLite. Executable architectural source has
**one configuration version**: there are no version readers, migration engines, generated
migration identities or compatibility adapters. Historical configuration and evidence stay
readable as data in application storage; nothing in the product exists to reinterpret them.

The MVP runs one project in one process: the command line is the host, one sequential lane
holds the plan, and one store persists it. Sandboxed execution uses one confinement
mechanism; a container, a dedicated cgroup subtree or a hardened profile is a deployment
option for shared or untrusted machines, never a prerequisite for completing a cycle.
Credentials and machine bindings stay outside architectural source. Shared application
services own behavior; CLI and future OpenAPI, MCP and React gateways adapt those
services. Hono and React/Vite remain the initial web implementation direction. A run that
dies leaves its branch, workspace and evidence; resuming means a new execution reading the
recorded position, not a pause subsystem, retained supervisor or recovery path.

Build infrastructure when the current accepted batch needs it. Do not introduce
an alternative scheduler, general agent framework or duplicate contract inventory.
Later governance expands the working foundation rather than postponing ownership,
standards or source confinement until after the UI.

## Reusable standards

- **Director-led task:** give a goal → the director generates a plan from the
  [plan template](../.arc/architecture/plan-template.md) → sequential single-owner
  milestones → each milestone runs the five Steps → inspect evidence and measures.
- **Five Steps:** documentation → design and contract tests → implementation → review →
  integration. Every milestone carries all five; the plan may mark one not-applicable with
  a reason. Preserve existing contracts during refactors and avoid repeated long test
  cycles for individual edits.
- **Shared execution:** gateways call the same application functions.
- **Structured handoff:** return a validated result or request; the runtime persists the
  position, updates the plan and continues the sequence. Informational logs do not
  activate agents.
- **Inherited context:** combine shared role, parent definitions, component, milestone,
  activity standards and execution rules; retrieve other information only as needed, and
  keep model-facing context bounded by construction rather than by paging subsystems.
- **Activity profiles:** the Step selects the activity, the activity selects the execution
  profile. Documentation, design and review may use a different model than implementation
  without any scheduling machinery.
- **Evidence-backed completion:** independently inspect changes and verification,
  retaining unresolved work and limits in the report.
- **Verified self-repair:** the director diagnoses a failure and routes a bounded repair to
  the responsible owner as the next milestone, reusing retained work through the same
  verified Steps. Preserve failure evidence, original human acceptance and authority;
  escalate when repair requires a new architectural decision or unavailable external action.
  A proposed repair is not proof of recovery: demonstrate the repaired behavior before
  claiming success.
- **Learning to standard:** a recurring lesson is written to `.arc/learning/` as a proposed
  standard with its cost and the cheapest check that would have caught it. Only the
  architect promotes it into `.arc/architecture/standards/`, attached to the activities it
  governs.
- **Task and workday are one loop:** a directive differs only in goal source
  (human goal versus component purpose, objectives and inbox), termination policy (goal met
  and released, or stopped, versus a bounded session) and position (a workday adds an owner
  rotation cursor). Nothing else in the lifecycle changes.
- **Self-development loop:** use a verified working ArcNexus revision to improve
  the next; a tested local/staging revision qualifies without a published release.
  Keep recovery ordinary and retain evidence when a candidate fails; frozen runtime
  copies are not a prerequisite for continuation.
  Candidate changes to instructions or tests cannot retroactively redefine the
  active milestone's authority or accepted behavior.

Standards start as short guidance. Extract reusable templates from successful use;
do not build a standards framework in advance.

## Questions to resolve at the relevant phase

These are open decisions, not hidden prerequisites for a complete platform design.

Phase-one target, harness, result-contract and stable-supervisor questions are
resolved in the [retrospective](phase-one-retrospective.md), with linked acceptance
evidence. Luna-sized models are the intended steward baseline; use `gpt-6-luna`
for worker live tests and assess their results separately from earlier Astra runs.
The architect specifies **an Astra supervisor directing Luna stewards**: reserve
Astra for high-level decomposition, research and independent verification; use Luna
by default for bounded component engineering, with Sol overrides for documentation,
design/specification and steward review. Activity profiles are inherited references
to shared execution profiles; the publisher remains deterministic. Human architectural authority remains final.
Deterministic runtime code schedules, enforces authority and records execution.
The execution system supports eligible component stewards in one sequential lane.
The current MVP qualification is defined below; steward counts follow actual work.
The real director selects from actual project components; callers do not prescribe
the team or replace direction with a scripted result.

- Phase two delivers one fresh goal as a sequential single-owner milestone plan, assembles
  related prepared contributions, runs one independent verification of the assembled
  candidate, and publishes one delivery through the canonical staging route. `verify-release`
  reads the release identity, runs the delivery policy's live checks against what is actually
  deployed, and writes the learning record. Uncertain operations are never replayed
  automatically. Historical runs remain inspectable as data and cannot resume.
- Later: which architectural decisions may stewards accept themselves, and which
  require the human or an explicitly authorized parent steward?

## Sequence, not a large implementation plan

1. Single steward and real CLI engineering result.
2. Reduce the lifecycle to the accepted MVP architecture: one store, one lane, one gate,
   one publication route, one activity vocabulary declared by the role definitions, and plans generated from
   the plan template. Deliver one fresh goal through staging, then repeat it cleanly before
   expanding interface or portfolio breadth.
3. Self-directed workdays on the same loop, using the directive seam: stewardship goal
   source, bounded session, idle termination and an owner rotation cursor.
4. OpenAPI and MCP web-service gateways and the React application, using the same
   application services independently of the current directory and terminal.
5. Expand architectural governance, conformance, portfolio and release capabilities beyond
   the accepted phase-two scope; real main merges, tags and package publication remain
   human-controlled.

Begin self-development as early as the working runtime permits; the first three
phases should establish the practical loop. Each phase can contain smaller working
releases. Full platform completeness is never a prerequisite for using ArcNexus.

## Source and status

Derived from the founding conversation in `context/start.md` and the architect's
explicit direction that ArcNexus should ultimately develop itself. The context
folder is local and ignored by Git; this tracked charter must stand on its own.
The conversation remains historical rationale. Later explicit architectural
decisions should update this charter rather than require readers to reconstruct chat.

On November 7, 2026, after reviewing why no self-development cycle had completed, the
architect confirmed the reduced direction recorded here: the `.arc` knowledge structure,
plans generated from a single template, milestones as the unit of work with one owner each,
one activity vocabulary — the six activities a role declares — one store, one lane, one verification gate, one
publication route, one configuration version, and the task/workday seam. That decision is
current policy; the implementation it describes is not yet delivered.

## Phase-two completion gate

The [self-development MVP](plans/self-development-mvp.md) is the single current
scope and acceptance contract for phase two. It replaces the broader completion gates
in historical plans; deferred scope is not claimed complete. The governing
simplification and repeated-reliability rule lives in [AGENTS.md](../AGENTS.md#simplification-and-reliability).

Phase three begins when that supported lifecycle meets its real qualification and
its application services can support the OpenAPI, MCP and React gateways. Keep
local checks, native enforcement, CI, real-agent simulation and real upstream
integration distinct in reports. Recorded or scripted tests cannot establish real
self-development. Human authority over main, tags and production releases remains.
