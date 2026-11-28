# Commands plugin contract

Stage: **proposed**. The [registry](../../docs/interface/registry.yaml) records its status.

Commands exposes the shared application SDK for the operations used by the
[CLI app](../../apps/cli/contract.md). The SDK accepts structured input and uses
[Agent](../agent/contract.md) and [Team](../team/contract.md) through the existing
task services. [Workflow](../workflow/contract.md) executes the task loop.
[Architecture](../architecture/contract.md) owns the working-tree ownership audit.

| Operation | Contract |
| --- | --- |
| `inspect(input)` | Resolve the supplied project context, component and activity. Return the scoped Agent view, exact model request and named placeholders. It has the same read-only behavior as Agent inspection. |
| `checkOwnership(directory)` | Accept a project working directory and return Architecture's complete structured working-tree ownership audit, including inventory, findings and source identity. Resolve nested directories through Architecture without task admission or provider activation. |
| `runTask(input, observer, signal)` | Submit a goal to Workflow. Report structured progress, evidence references and human questions through the observer. Return the task outcome and honor cancellation. A supplied human answer is recorded through the task services. |
| `planTask(directory, input, observer, signal)` | Dispatch standing inventory assessment, explicit human objective, objective recommendation, or an exact guide draft through the shared Plan lifecycle. Return structured progress, durable objective review and the assessment or verified delivery outcome. |
| `runRound(directory, observer, signal)` | Evaluate the captured standing goals sequentially through the same task path and return per-goal evidence and the round result. |
| `updateArchitecture(directory, feedback, observer, signal)` | Assess alignment, retain an exact architecture proposal for approval, and deliver approved changes and prerequisites inside Architect through the normal task lifecycle. |
| `refine(directory, rounds, observer, signal)` | Run or resume Plan, Architect and the priority-ordered goals for the requested positive round count. Return structured phase, approval, repair, per-goal and completion observations with cancellation support. |

The shared `task_plan` request uses mode `recommend-objectives` with optional
`focus`. Recommendation mode is exclusive of explicit objective text and guide
drafts. An unqualified request assesses standing inventory. Shared review
responses identify the exact open gate and carry the architect's selected drafts
or revision feedback. Web, CLI, REST and MCP translate their inputs to this
contract and use the same retained receipts.

The application adapter supplies inputs, renders outputs, collects answers and
maps outcomes to its transport. The shared observer streams ordered persisted
host/provider events, complete message/tool observations, evidence references and
available time/token/profile-cost measurements while work runs. Nonterminal
callers can follow that same stream without a terminal policy or a second task
lifecycle. Terminal arguments and exit codes belong to
the CLI app. MCP and OpenAPI adapters can use the same structured interface
when those apps are in scope.

## Working-tree ownership audit

The proposed public SDK signature is
`checkOwnership(directory: string): OwnershipAudit`. `OwnershipAudit` and its
`OwnershipFinding` entries use the types exported by Architecture's
[public entry](../architecture/src/index.ts); Commands does not maintain a
second result schema. The Commands method delegates to
`context.architecture.checkOwnership(directory)` through the required Architecture
service in the trusted Cordis composition. This declaration requires a real SDK
handler and composition before callers can rely on delivered support.

The directory may be the Git project root or a nested working directory.
Architecture resolves the repository, verifies its project identity and audits
working-tree ownership declarations against the Git inventory of tracked paths
and nonignored untracked paths. Commands preserves that service's validation and
errors. An invalid directory, unreadable project or invalid declaration is not
converted into an empty successful audit.

The result preserves `source`, `paths` and `findings` without filtering,
truncation, summarization or gateway-specific conversion. `source` identifies
`kind: 'working-tree'`, the resolved repository `root`, `remote` and HEAD
`revision`. That revision identifies the repository's HEAD; it does not claim
that mutable declarations or untracked files are committed there. `paths` retains
the complete audited inventory in Architecture's order. Each `unowned` finding
retains its path. Each `collision` finding retains its path and every owner
identity in `owners`, preserving Architecture's order. Ownership findings are
returned as data, including when multiple uncovered paths and collisions coexist;
an empty findings array represents an audit with no ownership findings.

The audit reads candidate working-tree state without capturing or adopting it as
approved authority. It does not require a clean tree, admit a task, create a
worktree, write source or durable task state, ask a human question, invoke a
provider or contact an upstream service. It uses no task observer or task
cancellation lifecycle. Commands adds no terminal output, argument parsing,
rendering or exit-code policy. Application callers inspect the same complete
result and decide how their transport presents it.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| CMD-1 | A caller without a terminal can inspect and run a task using structured inputs and results. |
| CMD-2 | CLI inspection and task execution delegate to those same operations and preserve the CLI contract. |
| CMD-3 | A human gate, unavailable result or cancellation has the same task meaning regardless of adapter. |
| CMD-4 | A nonterminal caller updates architecture or refines through the same application lifecycle as the CLI, including pending approval, phase recovery and per-goal results. No terminal argument or exit-code policy enters the SDK. |
| CMD-5 | Terminal and nonterminal callers observe the same live event ordering, evidence identities, available usage and terminal outcome. CLI JSONL rendering does not change the application lifecycle or require a second event store. |
| CMD-6 | The same Plan mode, input and objective decision have identical meaning across Web, CLI, REST and MCP. Mixed recommendation and explicit-objective or draft input is rejected before admission. |
| CMD-7 | A nonterminal consumer invokes `checkOwnership` through Commands composed with the real public Architecture service. A working tree containing multiple uncovered paths and ownership collisions returns the complete inventory and every finding, including all colliding owner identities, with the same order and source identity as Architecture's audit. No terminal handles or exit-code policy are required. |
| CMD-8 | Calling `checkOwnership` from a nested project directory resolves the same repository root, remote and HEAD revision as calling from its root. Candidate ownership declarations and nonignored untracked paths are audited without changing source, the Git index or active captured authority, and without task admission, durable task writes, worktree creation, provider activation or upstream effects. Invalid project input preserves Architecture's error instead of returning a fabricated clean result. |
