# Agent plugin contract

Stage: **proposed**. The [registry](../../docs/interface/registry.yaml) records its status.

## Agent

Agent is the central runtime interface for one actor in an ArcNexus task. The
director, every component steward and the independent reviewer use the same Agent
interface. Each receives its own identity and resolved scope. Their differences
come from the goal, role, activity, evidence access and allowed operations.

The Agent view gives consumers the actor's purpose, goal and acceptance references,
questions, constraints, instructions and applicable standards. It identifies what
the actor can observe and do. Observations come through scoped capabilities such as
reading project sources, reading captured evidence, or receiving a recorded answer.
Operations name the host actions available to this actor and activity, including
checked edits where authorized. An observation or operation result carries evidence
identity where applicable. Resolve this view from the captured project and plugin
definitions and the current task position. Apply project-wide and component or activity standards from the captured catalog.
Keep each rule at its authored source.

## Public interface

| Operation | Contract |
| --- | --- |
| `inspect(input)` | Describe the resolved Agent and render the request it would pass to Codex. Name unavailable runtime inputs as placeholders. Inspection reads without model calls, writes, worktrees or upstream effects. |
| `activate(input, signal)` | Run one scoped activation using the same resolved Agent and request builder. Surface progress and observations. Return a typed result or an explicit supplier request, escalation, unavailable, failed or cancelled outcome, with evidence references. Observe cancellation through Execution. |

Input identifies the captured project, actor role, owner where applicable, activity
and available task position. Activation requires an admitted task and resolved
inputs. Inspection can run before task admission. An activation carries the actor’s identity,
its captured authority and its goal throughout the call. Both use the single request
builder owned by [Architecture Model](../architecture-model/contract.md).

The [CLI plugin](../cli/contract.md) uses Agent inspection for `inspect`. During
`task run`, [Direction](../direction/contract.md) uses a director Agent to produce or
revise the plan. The task lane invokes steward Agents in milestone order.
[Verification](../verification/contract.md) uses a separate read-only Agent for the
independent verdict. A steward's request returns to Direction for sequencing.

Agent delegates harness execution and enforcement to [Execution](../execution/contract.md).
It resolves a scope from the authority captured for that actor and activity. A tool
argument, a role description or another agent's request cannot widen that scope.
The director and reviewer have read-only access to their captured inputs and cannot
edit source. The steward's operations follow the current owner and activity. The
reviewer receives the complete authorized evidence by reference.

[Coordination](../coordination/contract.md) persists state and evidence. Direction
owns sequence, Verification owns acceptance, and [Delivery](../delivery/contract.md)
owns staging integration. An Agent is scoped to an actor and task. It carries no
separate durable memory, peer scheduler or publication capability.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| AGT-1 | Inspecting the director, a steward and the reviewer uses one public Agent interface and shows each actor's goal, role, instructions, applicable standards, observations and allowed operations. |
| AGT-2 | For the same capture, actor and activity, the inspected context matches the request received by the Codex adapter, apart from named runtime-only placeholders. Inspection calls no model and creates no state. |
| AGT-3 | A director or reviewer write, another owner's edit, and an operation outside the current activity are refused by the host even when requested through Agent. |
| AGT-4 | In a two-owner task, the first Agent returns a supplier request. Direction sequences the supplier and both run through the same Agent interface, one activation at a time. |
| AGT-5 | The independent reviewer receives the captured acceptance and complete authorized evidence by reference. The result cites criteria and evidence and gives the reviewer no authoring or delivery authority. |
| AGT-6 | Cancelling an activation stops managed work through Execution and retains the outcome and observations under the task's evidence identity. |
