# Direction plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Turn a goal and captured catalog into an ordered plan with the Focus and five Steps
from the [plan template](../../.arc/architecture/plan-template.md). Use [Team](../team/contract.md)
to query eligible stewards and resolve supplier ownership from the captured
project and task position. Direction remains responsible for plan order, reuse of
accepted work and escalation. After plan acceptance, Direction uses Collaboration
to find or create the hosted issue for the task identity, then passes the issue to
Execution for workspace preparation. The Director model remains read-only. Choose one
accountable owner per milestone. A request links existing accepted work or causes
the director to place a supplier milestone before dependent work. A request for an
answer links the complete recorded supplier reply to the original requesting
milestone before it resumes. Execute the
sequence in one lane. Stewards can propose corrections and escalations. The
director decides sequencing and preserves the original acceptance and authority.

A missing component or a conflict with a locked clause becomes a proposal and a
named architectural gate. Clarifications requiring external authority become
foreground human questions. Corrections use the same milestone sequence.
The director cannot edit source, grant authority, accept its own plan or integrate
a candidate. An engineering task closes after verified staging integration. A standing goal
can be evaluated again in a later round. The workday and
production directives are deferred. One independent verdict covers the assembled goal.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| DI-1 | A goal produces a plan with a Focus block, at least one milestone, one owner each, and all five Steps per milestone with checklist items referencing acceptance by stable id. |
| DI-2 | Planning writes no source change and starts no issue branch or task worktree. An explicit Director inbox request can run read-only research using its mapped component and resume planning with the report. A plan without a request runs no research activation. |
| DI-3 | A goal naming work for an owner that does not exist emits a `component` proposal milestone and a gate awaiting the architect, not a milestone assigned to a guessed owner. |
| DI-4 | A milestone whose work spans two owners is refused at validation with both owners named. |
| DI-5 | A request linking to existing accepted work reuses that milestone's owner and acceptance; a second implementation of the same contract is never planned. |
| DI-6 | A request from an owner whose supplier milestone is later in the order resequences the supplier ahead of it; no dependency graph, admission check or cycle detection is consulted. |
| DI-7 | A failed step produces a correction milestone for the same owner with a stated diagnosis; no new state, retry counter or recovery path appears. |
| DI-8 | A goal that conflicts with a locked contract yields a change-request gate naming the contract id and clause, and no milestone touching that path is admitted. |
| DI-9 | Direction cannot write the registry or any locked contract file; the checked-edit refusal is observed, not merely asserted in the prompt. |
| DI-11 | Director input uses the bounded context from Architecture Model and names what was withheld. |
| DI-12 | Removing a prohibition paragraph that the host enforces leaves every scenario passing; removing an enforced check fails one. |
| DI-13 | A human clarification records its requesting actor and position. The original activity receives the complete recorded answer on continuation, including after restart without a duplicate prompt. |
| DI-14 | The plan render after `revise` differs from the previous render only in the fields the observation changed, so plan evolution is reviewable as a diff. |
| DI-15 | The same planner handles the initial sequence and a supplier request without a separate admission or retirement process. |
| DI-16 | Two goals in the same project cannot both be planned: the lane is busy, and the second is refused rather than queued. |
| DI-17 | A verified staging goal closes after the configured checks and review are observed and the provider reports its merge identity. The host can integrate once gates are satisfied. |
| DI-19 | The first build refuses a component-scoped workday directive with a stated reason. |
| DI-20 | The director selects a supplier from a Team view. An unowned resource or ownership collision is reported with affected resources and owners instead of guessing a recipient. A supplier request grants no write authority. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

DI-10, DI-18
