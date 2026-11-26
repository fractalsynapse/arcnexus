# Development direction

The current [efficiency foundation checklist](plans/efficiency-foundation.md)
tracks the proposed architecture reload, activity prompt/operation rewrite and
complete live timeline, including continuous time, token and profile-cost analysis.
Its exact contract amendment is approved and applied; implementation and live
acceptance of the complete batch remain outstanding.

Start with the [charter](charter.md), the [first delivery and qualification](plans/self-development-mvp.md),
and the [interface registry](interface/registry.yaml). The contracts distinguish accepted target behavior from implementation and
record the tests that establish it.

The catalog distinguishes project, app and plugin ownership. The CLI app owns
its composition and terminal adapter in [apps/cli](../apps/cli/README.md).
The [Commands SDK](../packages/commands/contract.md) provides shared structured
inspection, execution and goal-planning operations for the CLI and future MCP and OpenAPI adapters.
Reusable Cordis plugins belong in `packages/<plugin>/`. A plugin owns its public
entry and contract beside its source and tests. Keep plugin documentation and
scripts there when the plugin alone uses them. Keep root `docs/` and `scripts/`
for material shared across components. Add directories and scripts when they carry
real content, and keep one shared build and test entry. Resolve stewardship against
the [project catalog](../.arc/architecture/project.yaml). A package contract's
location comes from the [registry](interface/registry.yaml).

The [Agent contract proposal](../packages/agent/contract.md) is the first stop for
understanding how the plugins work together. It gives `inspect` one view of an
actor and gives `task run` one activation interface for every actor.
The [Team proposal](../packages/team/contract.md) defines the steward roster,
eligibility and resource ownership views used by Direction. The Director starts
the task and the final Reviewer can send rejected work back to Direction through
the [Agent loop](../packages/agent/contract.md). [Reviewer](../packages/reviewer/contract.md)
derives lessons from that loop and owns `.arc/learning/`. The
[Workflow proposal](../packages/workflow/contract.md) maps the agent activity
diagram to the existing task, verification and delivery boundaries.

[Planner](../packages/planner/contract.md) maintains standing goals and human
objective records. Explore the current mapping with `arcnexus task plan` or
submit a human objective to guide it. Approve objective changes through Plan.
Goal changes go through independent review before delivery.
Bare `arcnexus task run` evaluates the reviewed inventory in priority order.
`arcnexus architecture update [<feedback>]` assesses architecture and proposes
exact changes for approval. Required implementation is delivered within Architect
through the ordinary task lifecycle before Run captures the accepted model.
`arcnexus refine [--rounds <N>]` runs Plan, Architect and every approved goal,
defaulting to one round. The existing journal retains approval pauses and phase
positions; each new round incorporates prior results. These commands are target
capabilities until their contract scenarios and live qualification are verified.

[Manager](../packages/manager/contract.md) maintains agent directives.
[Release](../packages/release/contract.md) maintains repository workflows, ignores
and the changelog. [Architecture](../packages/architecture/contract.md) stewards the
architecture catalog, root README and contract records. Direction owns the generated plans in
`.arc/plans/`. Use the [catalog](../.arc/architecture/project.yaml) to resolve
the accountable owner.

The local Cordis and DeepSeek Harness examples informed the layout. ArcNexus uses
a single trusted CLI composition for the first build. That composition is captured
for each task. Production hot reload, external plugin installation, alternate
launch modes and clustered hosting are deferred.

Maintainers can audit an activity's mapped local MCP project operations with `inspect`,
which exposes the selected activity's captured operation IDs and tool descriptions.
Under [Architecture's operation-authority obligations](../packages/architecture/contract.md#obligations),
inspection and activation use the same captured bindings; an explicitly empty
operations list exposes no project tools. This captured project tool list grants
no additional authority and is separate from built-in web access, which the
execution provider independently controls.

## Previous attempts

The first design accumulated concurrency, hierarchy and workday behavior before
the operator could verify a routine delivery. The second narrowed the target but
carried forward that implementation and its tests. The restart writes checks
against the agreed interfaces and exercises the same CLI the architect will use.

- [Founding development journey](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/dev.md)
- [Phase-one evidence and retrospective](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/phase-one-retrospective.md)
- [Managed lifecycle ledger](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/plans/managed-lifecycle.md)
- [Prior architecture audit](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/plans/strategy-map.md)
