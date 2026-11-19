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
| Review | Steward self-review routes local repair within its milestone. [Verification](../verification/contract.md) obtains the final independent verdict from [Reviewer](../reviewer/contract.md); a valid rejection returns to Direction. |
| Release and Updates | [Delivery](../delivery/contract.md) performs the host-owned staging integration and returns its observation. Workflow records the outcome through Coordination. |
| Logs and Report | Coordination retains task position, observations and evidence references. Commands forwards progress and results to the caller. |
| Agent Registry, Standards and Contracts | [Team](../team/contract.md) resolves eligible stewards. [Architecture](../architecture/contract.md) resolves captured standards and contracts. |

`run(input, observer, signal)` drives the canonical admitted task lifecycle.
It invokes the Director initially, executes applicable steward activities and
obtains the independent final verdict before host integration. Execution enforces
confinement, checkpoints and cancellation; Coordination retains state.

Operation refusals and failures return exact diagnostics and retained successful
receipts to the caller. A same-owner check or self-review finding rewinds within
the accepted milestone to the earliest applicable activity that must change:
documentation for intent, testing for the assertion, or implementation for code.
Persist the rewind before activation, retain unaffected evidence, and rerun the
affected downstream activities and checks. The host validates the target against
the milestone's applicable Steps and the captured activity map. A local repair
cannot change ownership, acceptance or operations, add a milestone, or invoke
Direction. An explicit escalation for different responsibility or scope and a
valid final independent rejection invoke Direction.

Compare a repeated diagnostic with its relevant inputs and checked progress.
Distinct failures or changed inputs can continue correction. An unchanged failure
without progress retains an actionable hold or explicit escalation before another
identical automatic attempt. Research is an optional inbox contribution when
knowledge is missing; it is never a mandatory repair step. Complete answers and
edit receipts survive rewinds and restart.

Human approvals concern objectives, goals and architecture. Unavailable external
prerequisites retain observable holds. Ordinary technical correction, sequencing
and authorized staging delivery introduce no human approval gate.

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

`architecture update` assesses through the explicitly selected Architecture Agent.
A no-change assessment completes at its captured revision. For a change, retain
one exact proposal and await human approval. Use the normal task workflow inside
Architect for prerequisite implementation and approved host application. Verify
and deliver the combined candidate before the following Run phase. Candidate
edits never change active authority; capture the accepted architecture afresh.

`refine(directory, rounds, observer, signal)` drives Plan, Architect and Run in
order for each requested round. The default count is one. Run captures the
approved priority-ordered inventory after the first two phases and invokes the
Director for every goal regardless of existing passing measures. Every new round
reassesses guides and consumes prior results; no-change assessments remain valid.
Use the existing Coordination store and one project writer across sequential
phase and task sessions. A pending approval preserves the exact phase and proposal.
Restart resumes the same invocation and first unfinished position without duplicate
issues, edits or PRs. Runtime updates may be adopted only at a recorded validated
safe boundary, with uncertain effects reconciled before continuing.

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
| WFL-5 | A correction that resolves a compiler error and exposes a different assertion failure returns the exact new finding to the accountable activity. Local rewinds remain within its milestone and preserve original ownership and acceptance without another Director call. |
| WFL-6 | A repeated unchanged diagnostic with unchanged relevant inputs holds or explicitly escalates before another identical correction. Human approvals concern objectives, goals and architecture; unavailable external prerequisites retain named holds. |
| WFL-7 | Self-review rewinds to the earliest affected applicable Step; after repair only affected downstream activities and checks replay, with prior receipts and complete answers retained. |
| WFL-8 | Architect delivers required implementation and approved architecture through the canonical task lifecycle before Run captures it. A candidate cannot approve or activate its own authority. |
| WFL-9 | Each refinement round assesses Plan and Architect and invokes Direction for every priority-ordered approved goal. A restarted phase or approval pause resumes the same invocation without repeating completed outcomes. |
| WFL-10 | Three consecutive live rounds assess every captured goal and show approved guide improvement, a useful staged implementation and later consumption of prior findings. Justified no change is valid. Operator state repair, bypassed checks or uncontrolled aborts break the streak; execution-path changes restart qualification. |
