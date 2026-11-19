# Project knowledge

[Project authority](architecture/project.yaml) and its catalogs are architect-authored
and captured at admission. The capture pins the approved ownership, policies,
checks and trusted plugin composition. [Contract locks](../docs/interface/registry.yaml)
record accepted interface bytes.

[Planner](../packages/planner/contract.md) owns [standing goals](goals/) and
`objectives/`. Goal files declare a priority, durable requirements and observable
measures. Bare `arcnexus task run` evaluates a round in priority order. The
Director chooses stewards from the current catalog when work is needed.

Bare `arcnexus task plan` compares goals against project sources and evidence.
Pass an objective to preserve its verbatim submission and any clarification
answers under a stable ID. Objective files link to existing or proposed goals.
Their filenames and frontmatter form the objective index.

[Direction](../packages/direction/contract.md) owns `.arc/plans/` and creates
plan content using the [template](architecture/plan-template.md).
[Coordination](../packages/coordination/contract.md) persists task position. The host
renders the reviewable file from recorded state.
[Reviewer](../packages/reviewer/contract.md) owns `.arc/learning/` and derives
lessons from recorded task evidence. The host retains learning in task evidence
through Coordination. Tracked notes go through checked changes. The architect can
promote a lesson into a shared standard for future runs. The automated Architect
phase proposes that promotion for exact human approval and delivers required
implementation before the following Run captures it. Plans and learning grant
no authority. `arcnexus refine --rounds N` sequences Plan, Architect and Run with
durable approval and goal cursors in the existing Coordination store.

## Research reports

The Director, Reviewer and component stewards can request their own component's
research activity when a question affects their current decision. The host
records the request and report as task evidence and resumes the requesting
activity. A task can complete without making a research request.

Owners can archive reusable reports through checked edits under
`.arc/research/<component>/`. The report's frontmatter supplies its question,
summary and consultation date. The request builder derives a component index
from those reports. Research supplies evidence and grants no authority.

Run databases, transcripts, logs and bulk artifacts live in external application
storage. Reference them by stable evidence identity.
