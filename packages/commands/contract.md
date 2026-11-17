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
| `runRound(directory, observer, signal)` | Evaluate the captured standing goals sequentially through the same task path and return per-goal evidence and the round result. |

The application adapter supplies inputs, renders outputs, collects answers and
maps outcomes to its transport. Terminal arguments and exit codes belong to
the CLI app. MCP and OpenAPI adapters can use the same structured interface
when those apps are in scope.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| CMD-1 | A caller without a terminal can inspect and run a task using structured inputs and results. |
| CMD-2 | CLI inspection and task execution delegate to those same operations and preserve the CLI contract. |
| CMD-3 | A human gate, unavailable result or cancellation has the same task meaning regardless of adapter. |
