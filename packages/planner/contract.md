# Planner plugin contract

Stage: **proposed**. See the [registry](../../docs/interface/registry.yaml).

Planner owns standing goals and human objective records. Objectives express
human-owned direction and constraints. Goals express durable outcomes and
observable measures. The Director resolves engineering ownership when it
evaluates a goal. Retain execution results in reports and observations.

## Sources and modes

Plan assesses the standing inventory, takes an explicit human objective, or
recommends objectives from documentation. Preserve verbatim human submissions
and clarifications. An objective may remain unresolved. The refinement form
`Refines <full objective record ID>` links a submission to a prior record and
preserves its logical objective identity. Automated refinement uses the
standing-inventory mode.

Use one repository source reader for discovery and explicit file or directory
references from the instruction. Read at the authorized Git revision. Discover
relevant documentation from the repository contents without assuming a
directory, filename or knowledge root exists. Project documents provide
evidence. The trusted binding determines access and authority. Cite the exact
source path, revision and supporting excerpt. Recommendations include proposed
wording, a category and the uncovered need.

Default discovery searches the captured project documentation directories when
provided. Each configured path must identify a directory inside the captured
tree. Report invalid paths by name. An explicit file or directory supplied for
this run can focus discovery elsewhere in the same authorized tree. Every
recommendation uses the normal project workspace and delivery policy.

## Guide records

Store objectives and goals as named Markdown files in category directories
below their collection roots under the configured knowledge root. Paths supply
categories and topics support cross-category filtering. Stable record IDs in
metadata survive path moves. Migration preserves existing IDs, objective
refinement links, goal priorities and captured historical reads. Planner, the
Data resources, file editing and the Run inventory share recursive identity
lookup and path validation. Duplicate IDs, invalid paths and stale saves are
refused before edits.

## Objective decisions and goal alignment

Retain objective review in the existing durable question and answer path.
Present the exact objective diff, its baseline and source evidence. The
architect can approve selected drafts, edit drafts, request revisions or decline.
Edits and revised proposals require review of the resulting exact diff. Decline
ends the recommendation session. An absent answer preserves the pending
decision. An unrecognized or stale reply grants no approval.

When a recommendation is approved, pass the selected objective bytes to the
existing goal-alignment activity in the same admitted Plan session. If
discovery supports no new objective, explain the assessment and continue
standing-inventory alignment in that same Plan. An approved selection always
reaches goal alignment before ordinary delivery, including on a newly set up project.

An explicit save of the architect's exact objective draft is human
authorization at its captured revision. Model-authored objective changes,
including revisions during independent repair, require a decision covering
their exact bytes and baseline. Objective approvals do not authorize goal bytes.

Goal changes from alignment or direct edits enter checked editing, independent
review and verified staging delivery. Return independent findings to Planner for
repair. Goal-only repair requires no human decision. The outcome shows source
alignment, objective links, goal diffs and applicable recorded evidence. When
alignment needs no goal edits, deliver the authorized objectives on their own.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| PLN-1 | Exploration rates every current goal against cited source and captured evidence, compares overlaps and gaps, and reports a proposed change or an explicit no-change result. |
| PLN-2 | Objective mode preserves verbatim submission and human answers with stable links to existing or proposed goals. The objective inventory is derived from records. |
| PLN-3 | A model-authored objective change reaches delivery only with authority over its exact selected bytes and baseline. A direct objective save records the architect's exact draft. |
| PLN-4 | An interrupted round retains its captured goal inventory. The next fresh round uses the newly reviewed inventory. |
| PLN-5 | Every refinement Plan phase evaluates the standing guides using prior observations. It produces a checked goal diff or justified no change while preserving objective authorization and keeping owners and results out of goal records. |
| PLN-6 | Recommendations cite captured sources in an unconventional layout. Configured directories set default discovery, explicit source paths can focus one run, and an empty list permits discovery across the repository. Invalid configured paths produce actionable diagnostics. |
| PLN-7 | After draft revision and restart, the same objective review resumes. Goal alignment receives only the selected approved bytes and goal changes enter independent review with no human approval prompt. |
| PLN-8 | A categorized guide retains its identity, links and historical revisions after a move. Duplicate IDs, invalid paths and stale saves are refused. |

See the [CLI gateway](../../apps/cli/contract.md) and [development direction](../../docs/dev.md).
