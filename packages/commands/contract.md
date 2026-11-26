# Commands plugin contract

Stage: **proposed**. The [registry](../../docs/interface/registry.yaml) records its status.

Commands exposes the shared application SDK for the operations used by the
[CLI app](../../apps/cli/contract.md). The SDK accepts structured input and uses
[Agent](../agent/contract.md) and [Team](../team/contract.md) through the existing
task services. [Workflow](../workflow/contract.md) executes the task loop.

| Operation | Contract |
| --- | --- |
| `inspect(input)` | Resolve the supplied project context, component and activity. Return the scoped Agent view, exact model request and named placeholders. It has the same read-only behavior as Agent inspection. |
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

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| CMD-1 | A caller without a terminal can inspect and run a task using structured inputs and results. |
| CMD-2 | CLI inspection and task execution delegate to those same operations and preserve the CLI contract. |
| CMD-3 | A human gate, unavailable result or cancellation has the same task meaning regardless of adapter. |
| CMD-4 | A nonterminal caller updates architecture or refines through the same application lifecycle as the CLI, including pending approval, phase recovery and per-goal results. No terminal argument or exit-code policy enters the SDK. |
| CMD-5 | Terminal and nonterminal callers observe the same live event ordering, evidence identities, available usage and terminal outcome. CLI JSONL rendering does not change the application lifecycle or require a second event store. |
| CMD-6 | The same Plan mode, input and objective decision have identical meaning across Web, CLI, REST and MCP. Mixed recommendation and explicit-objective or draft input is rejected before admission. |
