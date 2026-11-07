# The `.arc` knowledge structure

`arc` is the continuous development a thing goes through from beginning to end. This
directory holds that record for a project: what it is for, what is being done about it,
and what the work taught. ArcNexus reads and writes these three spaces and nothing else
needs to know which project it is driving.

Three spaces, three authors, three lifetimes:

| Path | Contents | Written by | Read as |
| --- | --- | --- | --- |
| `.arc/architecture/` | Platform, package, component, role, execution-profile, standard, operation and delivery-policy definitions, plus the plan template | The human architect | Authority, captured per run |
| `.arc/plans/` | One file per goal: focus instance, milestone sequence, steps, checklists, status, evidence references | The director, extended by stewards | Intent and position, never permission |
| `.arc/learning/` | Per-cycle records: observed failures, cost, time, defect patterns, the cheapest check that would have caught them, proposed standards | Stewards and the director | History and proposals, never authority |

## Why the split is the design

The architect owns purpose, boundaries and approved architecture. Agents own planning and
execution detail. Keeping those in different directories makes the boundary physical
instead of a paragraph: a candidate can propose, but it cannot rewrite the direction that
governs it.

- **Architecture is stable, plans move.** A run captures its architectural authority at
  admission. Later edits to `.arc/architecture/` apply to future runs, never the active one.
- **Plans are generated, never authored by hand.** The director produces the plan from the
  goal plus the component's architecture. A human editing `.arc/plans/` is a bypass, not a
  fix. Humans act on plans by giving goals, accepting architecture changes and clearing gates.
- **Learning is the improvement channel.** Stewards record what actually happened. When a
  lesson generalises, it becomes a *proposed standard* in `.arc/learning/`; the architect
  promotes accepted proposals into `.arc/architecture/standards/`, where they attach to an
  activity and reach every steward performing that activity. Nothing else propagates rules
  between agents.

## Focus and Steps come from one template

`.arc/architecture/plan-template.md` is the single definition of what a plan must contain:
the Focus categories (purpose, objectives with measures of success, constraints with
measures of failure) and the five Steps (documentation, design and contract tests,
implementation, review, integration) with the checklists that gate them. The director is
given that template as its generation contract; stewards are given the same categories as
their working contract; the reviewer checks the plan against it. Plans that omit a category
are incomplete, not creative.

## Rules that keep the three spaces from rotting

- One authored source per fact. A value that lives in architecture is referenced, never
  copied into a plan; a measurement that lives in learning is cited by id, not restated.
- Evidence honesty outranks a green result. A failed observation stays failed; a
  `blocked` outcome with retained evidence is a correct record, not a defect.
- Human gates are named checklist items in a plan, never worked around by an agent.
- Bulk evidence, transcripts, run databases and logs stay in application storage outside
  the repository. `.arc/plans/` and `.arc/learning/` hold the small, reviewable record and
  reference the rest by id.
- Concurrency is a deployment concern. One project, one sequential lane, one plan file with
  one writer. Several efforts at once means several projects, not a scheduler.

## Current status

This structure is accepted direction. The executable architecture source still lives in the
repository-root `architecture/` directory, and the runtime still maintains the older
multi-store lifecycle; moving the source here and reducing the runtime to this model are
tracked as ordered milestones in
[the MVP plan](../docs/plans/self-development-mvp.md). Nothing in this directory claims
delivered behaviour.
