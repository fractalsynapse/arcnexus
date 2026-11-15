# Plan template

The director authors one plan per goal. The host validates it against captured
authority. The store persists accepted content and renders the reviewable plan
under `.arc/plans/`.

## Focus

- Purpose names the observable outcome.
- Objectives name success measures and the evidence that proves them.
- Constraints reference the captured owner and contract clauses and their failure
  measures. Exclusions name the boundary.
- Milestones form one ordered sequence. Each has a kind, one accountable owner,
  stable acceptance IDs and the five Steps below. A proposed component names the
  missing responsibility and waits at an architectural gate.

## Steps

| Step | Activity | Required evidence when applicable |
| --- | --- | --- |
| Documentation | `documentation` | Changed intent recorded before behavior changes |
| Design and contract tests | `testing` | Public regression observed failing before the fix, or characterization for a behavior-preserving change |
| Implementation | `implementation` | Smallest authorized change, owner checks, diff and attribution |
| Review | `review` | Engineering self-review and a reference to the independent verdict for the assembled task |
| Integration | `release` | A reference to the host's observed staging merge and applicable gates |

Research can support any Step. Resolve roles, profiles and available operations
from the captured component and project defaults. Review and Integration reference
the single task-level gates. They do not allocate extra owner executions.
A Step may be inapplicable with a reason visible in the plan. A checklist item names
its stable ID, activity, acceptance IDs, expected result, evidence and status.
Activity order governs execution. Checklist completion alone establishes coverage.

## Changes and evidence

A steward proposes dependencies or a revised approach. The director controls
sequence and scope. Link accepted supplier work or place a supplier milestone
before the dependent work. A genuine human gate names the question or external
action. Record position, check outcomes and evidence through the host. Keep a
brief simplification ledger naming removals, reuse and any added responsibility
with its demonstrated need. Retain failed observations and measure each milestone.
