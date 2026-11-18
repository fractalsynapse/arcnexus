# Workflow plugin contract

Stage: **proposed**. The [registry](../../docs/interface/registry.yaml) records its status.

Workflow owns the ordered execution of one goal through the task lane. The
[Commands SDK](../commands/contract.md) submits structured input and receives
progress and outcomes. [Direction](../direction/contract.md) authors and revises
the plan. Workflow executes the selected activity for the current milestone and
passes outcomes back to their owning services.

| Diagram step | ArcNexus boundary |
| --- | --- |
| Assignment, Plan and Checklist | The Director Agent establishes a plan through Direction and the [plan template](../../.arc/architecture/plan-template.md). Coordination persists accepted checklist and position. |
| Research, Document, Design and Implement | Workflow advances through the applicable component mappings. Design uses `testing`. Research supports the activity that needs it. [Agent](../agent/contract.md) uses Execution to run the selected activity in its captured scope. |
| Review | A steward can self-review. [Verification](../verification/contract.md) obtains one independent verdict for the assembled candidate from [Reviewer](../reviewer/contract.md). Direction decides correction work from the evidence. |
| Release and Updates | [Delivery](../delivery/contract.md) performs the host-owned staging integration and returns its observation. Workflow records the outcome through Coordination. |
| Logs and Report | Coordination retains task position, observations and evidence references. Commands forwards progress and results to the caller. |
| Agent Registry, Standards and Contracts | [Team](../team/contract.md) resolves eligible stewards. [Architecture](../architecture/contract.md) resolves captured standards and contracts. |

`run(input, observer, signal)` drives one admitted task. The lane invokes the
Director, the applicable steward activities, and the final Reviewer through the
same Agent interface. Workflow delegates lane/worktree enforcement and cancellation
to Execution, and durable state to Coordination. A supplier request, escalation
or review rejection returns to Direction for validation and sequencing. Feedback
may cause earlier activity work through an explicit revised plan. Workflow
follows the accepted sequence and does not create a second scheduler or store.
An unresolved repairable check or review hold returns its latest diagnostic,
check exit and log, prior correction and checked-edit evidence to Direction.
Direction can sequence distinct corrective contributions under the original
criterion while the observations show progress. A repeated unchanged diagnostic
without progress retains the hold and current position. Human decisions and
external prerequisites remain explicit gates. Preserve the original owner,
acceptance, issue and secured checkpoint throughout correction.

`inspect` uses the Agent and Architecture request builder without admitting a
workflow. An accepted staging result closes the task. Cancellation and blocking
gates preserve the observed position and evidence.

`task plan` uses the same admission, cancellation, clarification and delivery
boundaries. [Planner](../planner/contract.md) evaluates project sources or the
human objective. A read-only mapping completes at the captured revision.
When the run has records to persist, Workflow sends the exact journaled changes
through Execution and independent review. A rejected Planner candidate returns its findings to Planner for a correction and
approval of new goal bytes. A standing goal can use an independently reviewed
check-only candidate when the staging tree remains byte-identical.

## Project and task loops

Idea refinement, scaffolding, project instructions and specialized skills shape
the authority for future tasks. The outer MVP plan names purpose, objectives and
success measures, and constraints and failure measures. A task uses those captured
inputs to produce its Focus, ordered milestones and checklists with acceptance
references through the [plan template](../../.arc/architecture/plan-template.md).

Each milestone updates the recorded plan and evidence. Review findings can send
work back to Direction within the same task. Verified staging integration closes
the task. The architect can use the observations to refine the next goal and
guidance. Production release and verification of a published MVP belong to the
separate [release boundary](../release/contract.md).

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| WFL-1 | Commands submits a task, and Workflow invokes the Director, selected activities in plan order, the final Reviewer, and authorized host integration through their existing boundaries. |
| WFL-2 | A supplier request or rejected verdict goes to Direction. The recorded revised plan controls what Workflow executes next. |
| WFL-3 | A second goal cannot enter the same project lane. Cancellation retains progress and evidence through the existing Execution and Coordination services. |
| WFL-4 | Inspecting an actor and activity creates no admitted task, workflow state or activation. |

| WFL-5 | A correction that resolves a compiler error and exposes a different assertion failure in the same check returns the fresh diagnostic to Direction. Distinct corrective work runs before the paused step resumes, under the original acceptance and ownership. |
| WFL-6 | A repeated unchanged check or review diagnostic without progress holds the task before another automatic correction. Actual human decisions and external prerequisites remain explicit gates. |
