# Library contract — Direction

Type contract: `library`. Stage: **proposed**. Owner: `direction` (absorbs `task-intake`, the
planning half of `assignment`, `workday`, and the dispatch/admission parts of
`execution-runtime` and `coordination-store`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-architecture-model.md`](arcnexus-architecture-model.md), [`arcnexus-coordination.md`](arcnexus-coordination.md).
Depended on by: `execution` (consumes ordering), `verification`, the gateway, and the workday
extension.

Direction turns a goal into an ordered sequence of single-owner milestones and keeps that
sequence honest as reality arrives. It decides *what comes next and for whom*. It never performs
work, never judges its own plan, and never stores anything.

## Identity

| Field | Value |
| --- | --- |
| component | `direction` |
| paths | `src/library/direction`, `tests/library/direction`, `docs/library/direction` |
| current surface | ~2,456 lines across five components: `task-intake` (9 files), `assignment/plan.ts`, `workday` (3 files), four `execution-runtime` dispatch and admission modules, four `coordination-store` request and dependency modules |
| target size | ~700–900 lines |
| model | the `direction` activity profile resolved by the project contract; planning runs read-only |

## Provides

| Service | Obligation |
| --- | --- |
| `plan(goal, capture)` | a Plan: the Focus instance derived from the goal plus the component's architecture, and an ordered list of milestones. Generated from the plan template; never hand-authored; returned to the runtime, which persists it. |
| `owners(index, goal)` | the starting owner for each milestone, chosen from the bounded catalog index, requesting a full definition only when the index is insufficient. No prescribed team size; no team invented from prose. |
| `sequence(milestones)` | deterministic ordering. A `Request` for another owner's contribution becomes the preceding milestone, never a parallel dependency, an agreement step, or a duplicate implementation. |
| `revise(plan, observation)` | the Update-plan step: milestone and step status, a correction as the next milestone for the accountable owner, a retired request by linking it, and the reason. Same machinery as planning — there is no separate repair path. |
| `directive(source, termination)` | the task/workday seam: `goal` source with `met-released-verified` or `stopped` termination, or `stewardship` source with `session-bound` or `idle-pass` termination and an owner cursor. One planner; the directive is the only difference. |
| `clarifications(plan)` | gate records for questions that need a human, answered through `task answer`. A question is a record, never a run status. |
| `contractCheck(goal, plan, locks)` | validation against the locked contracts before any milestone is admitted. On conflict it emits a **change-request gate** naming the contract and clause; it never plans a milestone that crosses a locked interface. |

The plan, milestone, step, checklist and request shapes are the ones already fixed by the
coordination and project contracts. Direction authors their content; it does not define a second
vocabulary for them.

## Must never do

Edit source, run checks, start workspaces, call the harness, judge its own plan, publish, decide
authority, persist state, or schedule concurrency. Ordering is data the execution lane consumes;
the lane itself belongs to `execution`.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | Plans are generated. A human editing a plan file is a bypass, not direction; the render reproduces it from store state. |
| I2 | One accountable owner per milestone. A milestone needing two owners is two milestones. |
| I3 | Milestones are strictly sequential. Cycles are unrepresentable, so there is no cycle detection to maintain. |
| I4 | Ordering is data, not a scheduler: no priority, no fairness, no queue machinery. |
| I5 | Planning is read-only. The director proposes; only the runtime applies. |
| I6 | One planner for task and workday. A second planning engine is a defect, however it is named. |
| I7 | A goal that conflicts with a locked contract becomes a change-request gate. Direction never plans past a locked clause and never edits the registry. |
| I8 | Termination is a directive property, not a status enum: `blocked: awaiting <gate>` is a gate record plus an outcome, not a state family. |
| I9 | Corrections are ordinary next milestones with a stated diagnosis. There is no recovery, retry, admission or retirement subsystem to route them through. |
| I10 | Acceptance criteria are authored once per milestone. A request links to them; it never copies or expands them. |
| I11 | The director's input is bounded: catalog index plus the requested definitions, within the project contract's context budget. |
| I12 | Prohibitions the host already enforces are removed from prompts. Rules live in checks, not in paragraphs telling the model what not to do. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| DI-1 | A goal produces a plan with a Focus block, at least one milestone, one owner each, and all five Steps per milestone with checklist items referencing acceptance by stable id. |
| DI-2 | Planning writes no source change, starts no workspace, and calls no model beyond its own activation. |
| DI-3 | A goal naming work for an owner that does not exist emits a `component` proposal milestone and a gate awaiting the architect, not a milestone assigned to a guessed owner. |
| DI-4 | A milestone whose work spans two owners is refused at validation with both owners named. |
| DI-5 | A request linking to existing accepted work reuses that milestone's owner and acceptance; a second implementation of the same contract is never planned. |
| DI-6 | A request from an owner whose supplier milestone is later in the order resequences the supplier ahead of it; no dependency graph, admission check or cycle detection is consulted. |
| DI-7 | A failed step produces a correction milestone for the same owner with a stated diagnosis; no new state, retry counter or recovery path appears. |
| DI-8 | A goal that conflicts with a locked contract yields a change-request gate naming the contract id and clause, and no milestone touching that path is admitted. |
| DI-9 | Direction cannot write the registry or any locked contract file; the checked-edit refusal is observed, not merely asserted in the prompt. |
| DI-10 | A `stewardship` directive produces the same plan machinery with an owner cursor and session termination; no second planner module is invoked. |
| DI-11 | Director input for the full catalog stays within the project contract's bound, and the plan names what it withheld rather than truncating silently. |
| DI-12 | Removing a prohibition paragraph that the host enforces leaves every scenario passing; removing an enforced check fails one. |
| DI-13 | A clarification asked mid-milestone becomes a gate record; the run reports `blocked: awaiting <gate>` and resumes from position after `task answer`. |
| DI-14 | The plan render after `revise` differs from the previous render only in the fields the observation changed, so plan evolution is reviewable as a diff. |
| DI-15 | Deleting the admission, retirement and required-work modules leaves no caller in the planning or execution path. |
| DI-16 | Two goals in the same project cannot both be planned: the lane is busy, and the second is refused rather than queued. |

## Migration

| Current | Target | Effect |
| --- | --- | --- |
| `task-intake/direction.ts` with a ~2,500-character prohibition paragraph, plus `direction-context`, `direction-evidence`, `direction-record`, `proposal-store` | `plan`, `owners`, `contractCheck` over the locked template | prohibitions the host now enforces are deleted, not reworded |
| `task-intake/initializer.ts` (291) and `initializer-checks` | folded into plan generation | no separate initialization vocabulary |
| `assignment/plan.ts` (205) plus the `plan` and `plan-updates` schemas | checklist content as plan data authored by direction | removes worker-authored checklists with their own dependency validation |
| `coordination-store/inbox-decisions` (195), `request-proposal`, `required-work`, `assignment-admission` | `sequence` plus the `Request` entity | admission, duplicate-delivery protection and cycle detection become unreachable by design |
| `execution-runtime/run-selection`, `workday-selection`, `collaborative-dispatch`, `request-admission`, `direction-admission` (≈590 lines) | consumed by `execution.lane` reading plan order | deletes the alternate orchestration paths |
| `workday/workday-config` (220), `workday-view`, `general-policy` | reserved `stewardship` directive source | workday returns as a directive, not a second engine |
| `task-intake/verification-assessment`, `verification-evidence` | move to `verification` | direction stops judging its own plan |

Migration lands in cleanup batches 3 and 5, and is verified by DI-15 together with EX-17 and
CO-16: no caller left for the machinery being removed.

## Non-goals

Multi-goal prioritisation, cross-project planning, agent-to-agent negotiation, peer-agreement
gates, conversational acknowledgements as progress, budgets, and any capability that exists to
resume an abandoned run.

## Open questions for the architect

1. **Termination depth.** I propose a task continues through `release` and `verify-release`
   milestones and simply ends `blocked: awaiting <human gate>` where only you can act. The
   alternative is stopping the directive at staging integration and requiring a new goal for
   release. Which do you want?
2. **Locked-contract conflicts.** I propose direction inserts a change-request gate into the
   sequence so the plan shows the blocked decision. The alternative is refusing to plan at all
   until the conflict is resolved outside the plan.
3. **Workday reservation.** Reserve the `stewardship` directive shape now (fields present,
   refused with a clear error until workday is built), or add it when workday starts? I propose
   reserving it, because it is the seam you asked to keep.

## Lock record

```yaml
id: arcnexus/direction
stage: proposed
revision: 1
acceptedBy: null
acceptedAt: null
changes: null
```
