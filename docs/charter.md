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
2. **Accountable coordination:** any number of existing package stewards execute
   sequentially through durable assignments, inboxes and dynamic dependencies.
   Support self-directed workdays and director-led tasks, with one accountable owner
   per assignment. The [general execution contract](library/execution-runtime/execution.md)
   and its qualification gates remain foundational. The accepted
   [managed lifecycle and CLI contract](plans/managed-lifecycle.md) extends phase
   two with a managed portfolio, composed authority, publication and real-agent
   simulation; its gates must pass before phase three.
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

Keep the model small: platform, profiles, packages, foundations, dependencies,
gateways, releases/environments, and libraries. Documentation and tests attach to
relevant responsibilities. Architecture need not mirror directories or individual
functions. Add concepts only when a real behavior cannot be represented clearly.

Each component needs a stable identity, purpose, location/scope, lasting objectives,
constraints, open questions, and applicable reusable standards. Include contracts
and relationships when needed. A steward's role and execution configuration can
be inherited rather than copied into bespoke prompts.

Component definition, persistent stewardship identity, temporary execution,
assignment, and assignment plan have distinct lifetimes. Every execution receives
its own definition and the full applicable parent architectural definitions, plus
relevant contracts and work history. Unrelated implementation and old conversations
are not automatic context.

## Constraints

- Deliver coherent batches of accepted capabilities with tests written alongside
  implementation. Use focused feedback during development and qualify the assembled
  result before integration; follow the development cadence in [AGENTS.md](../AGENTS.md).
- Preserve human architectural authority. A steward proposes changes beyond its
  boundary; it cannot rewrite the approved architecture to excuse a deviation.
- Use one shared deterministic execution path behind eventual CLI, API, UI, and MCP
  gateways. AI performs engineering; ordinary code schedules and records work.
- Execute sequentially within each repository, with one execution owner. Tasks
  safely coordinate with workdays while preserving explicit pause/stop intent and
  live/simulation isolation. Stewards are dormant definitions between activations.
- Keep one accountable owner per assignment and one authoritative owner per contract.
  Delegating a dependency does not complete the original assignment.
- Separate contract acceptance, implementation readiness, and release availability.
  Resume dependent work at the milestone it actually requires.
- Govern execution by observed progress and cancellation, without work budgets;
  record failed, interrupted, and blocked outcomes. A workday must end with an honest report, including partial results.
- Verify actual changed paths and executed tests. Prompts and agent claims alone
  cannot enforce scope or prove success. Development success does not authorize production.
- Use concise functions with coherent responsibilities, simple modules, and existing
  tools. Introduce abstractions and dependencies in response to demonstrated needs.
- No placeholder implementations or simulated outcomes presented as working features.
  Deterministic test doubles are useful for tests but cannot prove real harness integration.
- Keep the architectural specification smaller and more stable than the implementation.

## Initial technical direction

The initial bootstrap used TypeScript, an existing Codex execution harness and
one repository. Durable coordination uses SQLite. Executable architectural source
uses the current supported schema family; historical readers preserve earlier
configuration and evidence without making them executable adapters.

The accepted managed lifecycle extends that foundation to a project volume and
composed platform/package repositories before phase three. Shared application
services own behavior; CLI and future OpenAPI, MCP and React gateways adapt those
services. Hono and React/Vite remain the initial web implementation direction. Keep
credentials and machine bindings outside architectural source, and keep the
supervising runtime stable during self-development.

Build infrastructure when the current accepted batch needs it. Do not introduce
an alternative scheduler, general agent framework or duplicate contract inventory.
Later governance expands the working foundation rather than postponing ownership,
standards or source confinement until after the UI.

## Reusable standards

- **Director-led task:** give objective → director selects eligible stewards → execute
  → inspect evidence.
- **Batched delivery:** specify accepted behavior → implement with meaningful tests
  → verify the assembled artifact → review → integrate. Preserve existing contracts
  during refactors and avoid repeated long test cycles for individual edits.
- **Shared execution:** gateways call the same application functions.
- **Structured handoff:** return a validated result/request; runtime persists state,
  routes work, and resumes assignments. Informational logs do not activate agents.
- **Inherited context:** combine shared role, parent definitions, component, assignment,
  and execution rules; retrieve other information only as needed.
- **Evidence-backed completion:** independently inspect changes and verification,
  retaining unresolved dependencies and limits in the report.
- **Self-development loop:** use a verified working ArcNexus revision to improve
  the next; a tested local/staging revision qualifies without a published release.
  Retain the stable supervising runner and a recovery path when the candidate fails.
  Candidate changes to instructions or tests cannot retroactively redefine the
  active assignment's authority or accepted behavior.

Standards start as short guidance. Extract reusable templates from successful use;
do not build a standards framework in advance.

## Questions to resolve at the relevant phase

These are open decisions, not hidden prerequisites for a complete platform design.

Phase-one target, harness, result-contract and stable-supervisor questions are
resolved in the [retrospective](phase-one-retrospective.md), with linked acceptance
evidence. Luna-sized models are the intended steward baseline; use `gpt-6-luna`
for worker live tests and assess their results separately from earlier Astra runs.
The architect specifies **an Astra supervisor directing Luna stewards**: reserve
Astra for high-level decomposition, architectural reasoning and review; use Luna
for bounded component engineering. Human architectural authority remains final.
Deterministic runtime code schedules, enforces authority and records execution.
The phase-two execution system supports arbitrary eligible steward counts; the
qualification baseline includes three- and five-owner scheduling and a real
goal with at least three observed stewards and an owner discovered during execution.
The real director selects from actual project components; callers do not prescribe
the team or replace direction with a scripted result.

- Phase two uses a verified change in the shared candidate as its delivery milestone.
  Durable checkpoints support explicit pause/resume and validated recovery.
  Uncertain operations are never replayed automatically. Historical two-owner
  workdays remain inspectable but cannot resume under the new scheduler.
- Later: which architectural decisions may stewards accept themselves, and which
  require the human or an explicitly authorized parent steward?

## Sequence, not a large implementation plan

1. Single steward and real CLI engineering result.
2. General execution, minimal configuration, managed portfolio and composed
   authority, the unified CLI, and the coordinator/director/agent/verifier/publisher
   lifecycle. Qualify real-agent tasks and workdays in isolated simulation, promotion
   into real staging, and the supported container runtime.
3. OpenAPI and MCP web-service gateways and the React application, using the same
   application services independently of the current directory and terminal.
4. Expand architectural governance and conformance beyond the initial contracts.
5. Extend portfolio and release capabilities beyond the accepted phase-two scope;
   real main merges, tags and package publication remain human-controlled.

Begin self-development as early as the working runtime permits; the first three
phases should establish the practical loop. Each phase can contain smaller working
releases. Full platform completeness is never a prerequisite for using ArcNexus.

## Source and status

Derived from the founding conversation in `context/start.md` and the architect's
explicit direction that ArcNexus should ultimately develop itself. The context
folder is local and ignored by Git; this tracked charter must stand on its own.
The conversation remains historical rationale. Later explicit architectural
decisions should update this charter rather than require readers to reconstruct chat.

## Phase-two completion gate

Phase three remains blocked until the accepted
[managed lifecycle and CLI plan](plans/managed-lifecycle.md) is implemented and
qualified. Its scope includes managed volume identities, composed platform/package
architecture, architectural CRUD, the complete CLI contract, isolated simulation,
authorized GitHub/staging delivery and explicit promotion. Earlier foundation
increments do not establish completion of these capabilities.

Tasks and workdays share one production lifecycle:
**Coordinator → Director → Agents → Independent Verifier → Publisher**.
Simulation changes the captured external environment, not the scheduler or engineering
workflow. It uses real agents, actual edits, tests, local Git delivery and retained
artifacts while preventing real upstream mutations throughout the run. Deterministic
and recorded scenarios belong in acceptance tests. Real main merges, tags and package
publication remain outside this increment and under human control.

All six real demonstrations in the managed lifecycle plan are prerequisites.
Retain actual diffs, operation evidence, independent reviews and artifacts, including
a useful ArcNexus improvement delivered through the complete simulated lifecycle
and then explicitly promoted, freshly verified and integrated into real staging.

Report deterministic tests, native enforcement, CI, real-agent simulation and real
upstream integration separately. Scripted success cannot substitute for a real-agent
case; simulated publication cannot establish real-provider integration. A normal
real-agent change integrated manually is useful progress, but does not establish the
complete simulated delivery and promotion gate.

The [general execution ledger](plans/general-agent-execution-qualification.md) and
[minimal configuration contract](plans/minimal-component-configuration.md) retain
their foundational requirements: arbitrary eligible stewards, durable sequential
execution, fair workdays, cancellation/recovery, one authored source per architectural
fact, derived catalogs, supervised operations, checked source edits and frozen authority.
No execution budgets or legacy executable adapters are reintroduced. Historical
reports and qualification records remain inspectable without rewriting their meaning.

The container gate includes a persistent project volume, supported native confinement
and delegated cgroups, stable supervisors, interruption recovery and relocated mounts.
HTTP routing, web authentication and React implementation begin in phase three only
after these application services and lifecycle gates are established.
