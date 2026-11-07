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
   retains foundational coordination and trust requirements; current qualification
   is defined by the MVP below. The accepted
   [self-development MVP](plans/self-development-mvp.md) defines the current phase-two
   scope and gates. The broader managed lifecycle plan is historical scope, not an
   additional prerequisite.
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
- Execute through one platform-wide sequential lane for the MVP. Tasks
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

The current MVP uses one platform, one sequential execution lane, a fixed project
volume mount and straightforward platform/package composition. Shared application
services own behavior; CLI and future OpenAPI, MCP and React gateways adapt those
services. Hono and React/Vite remain the initial web implementation direction. Keep
credentials and machine bindings outside architectural source. Ordinary recovery
may adopt the installed runtime after validating the checkpoint and its authority.

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
- **Verified self-repair:** when possible, the director diagnoses execution failures
  and routes bounded repairs to the responsible component stewards. Reuse retained
  work and resume through the same verified lifecycle. Preserve failure evidence,
  original human acceptance and authority; escalate when repair requires a new
  architectural decision or unavailable external action. A proposed repair is not
  proof of recovery: demonstrate the repaired behavior before claiming success.
- **Self-development loop:** use a verified working ArcNexus revision to improve
  the next; a tested local/staging revision qualifies without a published release.
  Keep recovery ordinary and retain evidence when a candidate fails; frozen runtime
  copies are not a prerequisite for continuation.
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
Astra for high-level decomposition, research and independent verification; use Luna
by default for bounded component engineering, with Sol overrides for documentation,
design/specification and steward review. Activity profiles are inherited references
to shared execution profiles; the publisher remains deterministic. Human architectural authority remains final.
Deterministic runtime code schedules, enforces authority and records execution.
The execution system supports eligible component stewards in one sequential lane.
The current MVP qualification is defined below; steward counts follow actual work.
The real director selects from actual project components; callers do not prescribe
the team or replace direction with a scripted result.

- Phase two assembles related prepared owner contributions before independent
  verification and publishes one task delivery through the canonical staging route.
  Durable checkpoints support explicit pause/resume and validated recovery.
  Uncertain operations are never replayed automatically. Historical two-owner
  workdays remain inspectable but cannot resume under the new scheduler.
- Later: which architectural decisions may stewards accept themselves, and which
  require the human or an explicitly authorized parent steward?

## Sequence, not a large implementation plan

1. Single steward and real CLI engineering result.
2. Simplify and unify the self-development lifecycle within the current MVP envelope.
   Establish repeatable real engineering, verification, recovery and staging delivery
   before expanding interface or portfolio breadth.
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

The [self-development MVP](plans/self-development-mvp.md) is the single current
scope and acceptance contract for phase two. It replaces the broader completion gates
in historical plans; deferred scope is not claimed complete. The governing
simplification and repeated-reliability rule lives in [AGENTS.md](../AGENTS.md#simplification-and-reliability).

Phase three begins when that supported lifecycle meets its real qualification and
its application services can support the OpenAPI, MCP and React gateways. Keep
local checks, native enforcement, CI, real-agent simulation and real upstream
integration distinct in reports. Recorded or scripted tests cannot establish real
self-development. Human authority over main, tags and production releases remains.
