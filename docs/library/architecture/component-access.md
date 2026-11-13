# Component ownership and execution access

This guide describes the current schema-v6 model for component declarations and
the runtime boundaries built from them. Historical directory-based permission
probes are retained at the end as version-specific evidence; they are not the
current authored access model.

## Authored ownership and derived edit scope

A component declares the paths it owns with `owns`. Paths are relative to the
component's nearest package root. The catalog resolves these declarations at the
captured Git revision. For a component in the primary repository, its definition
file under `architecture/components/` is also owned implicitly. A package or
platform is a container and does not receive the paths of its children.

For example, the architecture component in
[`architecture/components/architecture.yaml`](../../../architecture/components/architecture.yaml)
declares `src/library/architecture`, `tests/library/architecture`, and
`docs/library/architecture`. The runtime derives exact allowed edit paths from
those declarations and the component definition. The captured inventory classifies
files under that scope; file classification does not grant additional ownership.
See the [component schema](../../../src/library/architecture/schemas/component.json),
[ownership resolver](../../../src/library/architecture/component-materialization.ts), and
[ownership validation](../../../src/library/architecture/ownership.ts).

Component ownership is the sole source of maintained-file write authority.
Assignments contain objectives, technical requirements and acceptance criteria.
Only the accountable steward discovers and chooses the files it needs to edit.
A foreign file requires an inbox request to its owner. Read-only activities,
safe edit transactions and independent verification still apply.

## Reads and inherited policy

Schema-v6 components express read intent with `reads`. The nearest declaration
along a component's ancestry supplies the read boundary. A child can narrow that
boundary, but an explicit child declaration that adds paths outside its ancestor's
boundary is rejected. Required paths derived from the component's own ownership
are added to its effective readable paths. Policy resolution records which
declaration supplied reads; operation declarations and constraints accumulate
along ancestry. See the v6 [policy resolver](../../../src/library/architecture/component-materialization-policy.ts)
and the current [platform declaration](../../../architecture/components/arcnexus.yaml).

A read boundary describes what the architecture authorizes. The effective runtime
policy still applies process confinement and private runtime paths. Reads do not
grant source writes.

## Worker edits and supervised operations

Steward model commands receive read-only maintained source. The steward constructs
the model permission policy with no writable source outputs; only private temporary
storage is writable. The model changes maintained files through the active
assignment-bound `source.edit` tool. Edit paths are workspace-relative; updates
and deletes include the current SHA-256 hash, while creates use a null hash
precondition. The host checks component ownership, whether this turn can edit, and transaction
integrity before applying a batch. Workflow checkpoints and independent review
assess the resulting diff against the captured requirements. Planning, research, review and
handoff turns cannot edit. A denied native write is not evidence that checked edits
are unavailable.

See the [steward permission configuration](../../../src/library/steward/codex-configuration.ts),
[checked-edit guide](../assignment/checked-engineering-qualification.md),
[edit authorization](../../../src/library/assignment/checked-edit-bridge.ts), and
[steward workflow](../assignment/steward-workflow.md).

Declared host operations can write only their captured disposable generated-output
directories and private temporary storage. The operation supervisor resolves the
operation from captured assignment authority, checks its declaration against
maintained source paths, and qualifies source denial before running it. Unsupported
confinement fails closed. These operations are supervised host commands, not
arbitrary worker write access; their output permissions do not authorize maintained
source changes. Host verification is limited to captured operations and checks,
with results reported separately from model claims.

See [operation confinement](../../../src/library/operations/operation-confinement.ts),
[the source confinement policy](../../../src/library/operations/confinement.ts), and
the [captured operation declarations](../../../architecture/operations).

## Historical permission and run evidence

The following observations document earlier directory-based permission behavior.
They describe particular versions, commands and runs and do not establish the
current schema-v6 or checked-edit enforcement path.

- A Linux probe using Codex `0.163.0-alpha.10.2` ran
  `codex sandbox --permission-profile <name> --cd <fixture> -- python3 <probe>`.
  It observed writes in an implementation directory, reads but no writes in a
  related directory, and denial for undeclared paths. No inference was used.
- An exact-file write rule failed before command execution in that installed
  version/configuration: `bwrap` attempted metadata paths below a regular file
  and exited with `ENOTDIR`. This was a version-specific result, not a general
  limitation. The original note linked [upstream issue #52985](https://github.com/openai/codex/issues/52985).
- The earlier directory-policy implementation reported 57 deterministic runtime
  tests. Its `node scripts/check-permissions.mjs` check used the then-current
  production profile builder and installed CLI, without inference. These counts
  and probes are historical acceptance evidence, not current enforcement checks.
- Historical Luna run
  `4fcde85a-01db-46f1-b6eb-17536fbe6f9f` completed a documentation assignment
  using related reads and documentation writes; independent inspection reported
  only `docs/README.md` changed. The earlier report, profile, probe log, prompt
  and events were recorded under the normal runtime state root. This run predates
  the current checked-edit and operation-confinement description.
- Historical implementation run
  `56a64782-fc67-40f5-b4a2-91709a30b110` originated the directory-policy work.
  Host verification found a test executable that edited files during preflight.
  Later review corrected the fixture, used the managed command runner for startup
  cancellation, and connected the acceptance script to the production profile
  builder. The failed original record was retained.
- The old guide cited the
  [official permission profiles](https://learn.chatgpt.com/docs/permissions) and
  [Codex SDK raw config override documentation](https://github.com/openai/codex/blob/main/sdk/typescript/README.md)
  for that historical implementation. Neither citation changes the current
  captured architecture or assignment authority.

## Component resource reads

The public inspection module exports `ComponentResources`, constructed without
arguments. Its `list(target, query?)` and `get(target, componentId)` methods
accept the existing portfolio target `{ source, base, packageId }`; `base` is a
committed Git revision. The selected package and its descendants are in scope,
including the package itself. A component in another package subtree is rejected.
These reads load committed catalog intent and do not create execution storage or
start an execution host.

Each result exposes identity, purpose, objectives, constraints, questions,
standards, `owns`, API declarations, root and repository. It omits machine
bindings, execution records, permissions and command recipes. Each projected
component has a revision derived from its captured base and projected values.
A list page also has a query revision and a continuation cursor bound to that
revision and query. Retained targets keep their captured source revision; a newly
resolved target can observe newly committed intent. Architecture changes do not
update retained runs.

`list` uses the shared `ResourceQuery`: `id`, `type` and `parentId` filters
use equality and combine with AND; search is case-insensitive and checks only
`id` and `purpose`. The default limit is 50 and the maximum is 100. Results
are ordered by ID. Unknown fields, invalid types, malformed filters and
invalid or stale cursors fail. See
[`ComponentResources`](../../../src/library/architecture/component-resources.ts)
and [`ResourceQuery`](../../../src/library/report/resource-query.ts).
