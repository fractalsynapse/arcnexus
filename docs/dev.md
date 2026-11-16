# Development direction

Start with the [charter](charter.md), the [first delivery and qualification](plans/self-development-mvp.md),
and the [interface registry](interface/registry.yaml). The runtime is being rebuilt.
The contracts state the target behavior and the tests that establish it.

The catalog distinguishes project, app and plugin ownership. The CLI app owns
its composition and terminal adapter in [apps/cli](../apps/cli/README.md).
The [Commands SDK](../packages/commands/contract.md) provides shared structured
inspect and task operations for the CLI and future MCP and OpenAPI adapters.
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
eligibility and resource ownership views used by Direction.

The local Cordis and DeepSeek Harness examples informed the layout. ArcNexus uses
a single trusted CLI composition for the first build. That composition is captured
for each task. Production hot reload, external plugin installation, alternate
launch modes and clustered hosting are deferred.

## Previous attempts

The first design accumulated concurrency, hierarchy and workday behavior before
the operator could verify a routine delivery. The second narrowed the target but
carried forward that implementation and its tests. The restart writes checks
against the agreed interfaces and exercises the same CLI the architect will use.

- [Founding development journey](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/dev.md)
- [Phase-one evidence and retrospective](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/phase-one-retrospective.md)
- [Managed lifecycle ledger](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/plans/managed-lifecycle.md)
- [Prior architecture audit](https://github.com/fractalsynapse/arcnexus/blob/d15188e84ff9d12dbe262d4395d0ca4bf2b94ae9/docs/plans/strategy-map.md)
