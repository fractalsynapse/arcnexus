# Library contract — Direction

Type contract: `library`. Stage: **locked** (revision 4). Owner: `direction` (absorbs `task-intake`,
the planning half of `assignment`, `workday`, and the dispatch/admission parts of
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
| model | the director's execution profile resolved by the project contract — not an activity name; planning runs read-only |

## Provides

| Service | Obligation |
| --- | --- |
| `plan(goal, capture)` | a Plan: the Focus instance derived from the goal plus the component's architecture, and an ordered list of milestones. Generated from the plan template; never hand-authored; returned to the runtime, which persists it. |
| `owners(index, goal)` | the starting owner for each milestone, chosen from the bounded catalog index, requesting a full definition only when the index is insufficient. No prescribed team size; no team invented from prose. |
| `sequence(milestones)` | deterministic ordering. A `Request` for another owner's contribution becomes the preceding milestone, never a parallel dependency, an agreement step, or a duplicate implementation. |
| `revise(plan, observation)` | the Update-plan step: milestone and step status, a correction as the next milestone for the accountable owner, a retired request by linking it, and the reason. Same machinery as planning — there is no separate repair path. |
| `directive(scope, termination)` | the planning seam: **one role, `director`**, differing only in scope and termination — a goal-scoped directive terminates met-released-verified or stopped, a component-scoped directive terminates session-bound or idle-pass and carries an owner cursor. Self-directed component planning is not a fourth agent role, and a component-scoped directive is refused with a clear error until the seam that schedules it exists, so the shape is real without a second engine. |
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
| I13 | **Staging integration is automatic.** A plan sequences staging merge as an ordinary milestone, completed when applicable checks, CI and any configured review requirement are satisfied. Only production release — protected-branch merge, tag, publication, deploy — awaits a human gate. The release path is automated right up to that boundary. |
| I14 | Component-scoped planning is one `director` activation with a narrower scope, not a separate role: the scope and termination are the only difference, and using it before the scheduling seam exists refuses with a stated reason rather than inventing a planner or a fourth role name. |

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
| DI-10 | A component-scoped directive produces the same plan machinery, the same activity-bucketed checklist, and the same validation with an owner cursor and session termination; no second planner module is invoked. |
| DI-11 | Director input for the full catalog stays within the project contract's bound, and the plan names what it withheld rather than truncating silently. |
| DI-12 | Removing a prohibition paragraph that the host enforces leaves every scenario passing; removing an enforced check fails one. |
| DI-13 | A clarification asked mid-milestone becomes a gate record; the run reports `blocked: awaiting <gate>` and resumes from position after `task answer`. |
| DI-14 | The plan render after `revise` differs from the previous render only in the fields the observation changed, so plan evolution is reviewable as a diff. |
| DI-15 | Deleting the admission, retirement and required-work modules leaves no caller in the planning or execution path. |
| DI-16 | Two goals in the same project cannot both be planned: the lane is busy, and the second is refused rather than queued. |
| DI-17 | A goal whose plan ends in staging integration completes without any human turn: the staging merge milestone is planned, executed and recorded as an ordinary milestone, and the run closes. |
| DI-18 | A plan reaching production release automates candidate scope, changelog, version and the protected-branch pull request, then ends `blocked: awaiting <release gate>` naming what the human must do. No agent merges to the protected branch, tags or deploys. |
| DI-19 | A component-scoped directive is refused with a stated reason and the reserved shape visible in the error; no second planner module and no separate role name is created to serve it. |

## Migration

| Current | Target | Effect |
| --- | --- | --- |
| `task-intake/direction.ts` with a ~2,500-character prohibition paragraph, plus `direction-context`, `direction-evidence`, `direction-record`, `proposal-store` | `plan`, `owners`, `contractCheck` over the locked template | prohibitions the host now enforces are deleted, not reworded |
| `task-intake/initializer.ts` (291) and `initializer-checks` | folded into plan generation | no separate initialization vocabulary |
| `assignment/plan.ts` (205) plus the `plan` and `plan-updates` schemas | one plan structure carrying steps bucketed by activity, authored by the agent that owns the work and persisted by the lane | keeps a single authoring path and one validation rule, and removes worker plan formats the runtime must translate. Direction keeps goals, sequence, owners and acceptance criteria; it does not author another agent's steps |
| `coordination-store/inbox-decisions` (195), `request-proposal`, `required-work`, `assignment-admission` | `sequence` plus the `Request` entity | admission, duplicate-delivery protection and cycle detection become unreachable by design |
| `execution-runtime/run-selection`, `workday-selection`, `collaborative-dispatch`, `request-admission`, `direction-admission` (≈590 lines) | consumed by `execution.lane` reading plan order | deletes the alternate orchestration paths |
| `workday/workday-config` (220), `workday-view`, `general-policy` | reserved component-scoped `director` directive | workday returns as a directive of the one planner, not a second engine and not a fourth role |
| `task-intake/verification-assessment`, `verification-evidence` | move to `verification` | direction stops judging its own plan |

Migration lands in cleanup batches 3 and 5, and is verified by DI-15 together with EX-17 and
CO-16: no caller left for the machinery being removed.

## Non-goals

Multi-goal prioritisation, cross-project planning, agent-to-agent negotiation, peer-agreement
gates, conversational acknowledgements as progress, budgets, and any capability that exists to
resume an abandoned run.

## Accepted decisions

1. **Termination depth:** a task continues past staging. Staging integration is an ordinary
   milestone the agent completes when checks, CI and any configured review requirement pass; the
   release path is automated right up to production, where merge, tag, publication and deploy are
   the human gate (I13, DI-17, DI-18). This matches the locked project contract, which reserves
   only protected-branch merge, tagging, publication and contract locks to humans, and the locked
   gateway contract, where a gate is any step only a human can complete.
2. **Locked-contract conflicts:** direction inserts a **change-request gate** into the sequence so
   the plan itself shows the blocked decision, and admits no milestone that crosses the clause
   (I7, DI-8, DI-9).
3. **Workday:** the component-scoped `director` directive shape is reserved now and refused with a
   stated reason until workdays are built, keeping the seam without a second planner or a separate
   role name (I14, DI-19).

## Lock record

```yaml
id: arcnexus/direction
stage: locked
revision: 3
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 2: locked with the architect's answers. Staging integration is automatic and only
    production release awaits a human gate (new I13, DI-17, DI-18); a locked-contract conflict
    inserts a change-request gate into the sequence; the stewardship directive is reserved rather
    than deferred silently (new I14, DI-19)
  - revision 3: self-directed component planning is one `director` role with a narrower scope, so
    the role set stays director, steward and verifier rather than adding a fourth name that reads like
    a duplicate of steward; the plan-authorship split is corrected so direction keeps goals, sequence,
    owners and acceptance criteria while the owning agent authors its own bucketed plan; `activate`
    and planning both state the activity spine and its canonical ordering, and an escalation is
    returned, captured and replayable rather than treated as failure
  - revision 4: the director's model selection is stated as an execution profile, not an
    `direction` activity, because the six activities a role declares are the only activity
    vocabulary and `direction` is a component, not an activity
  - revision 1: proposed in #356 with three open questions, all since answered
```
