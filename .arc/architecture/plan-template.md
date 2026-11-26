# Plan template

The director authors one plan per goal. The host validates it against captured
authority. Coordination stores accepted content. The host renders the reviewable
plan under Direction’s `.arc/plans/`.

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

An actor can ask for research to support any Step or task-level decision. The
request uses the actor's component inbox and does not add a Step. Resolve each
activity's role, profile, instructions,
operations and standards from the captured component's explicit mapping.
The director's planning activity and verifier's independent assessment are task
activities selected by the project. They do not add milestone Steps. Review and Integration reference
the single task-level gates. They do not allocate extra owner executions.
A Step may be inapplicable with a reason visible in the plan. A checklist item names
its stable ID, activity, acceptance IDs, expected result, evidence and status.
Activity order governs execution. Checklist completion alone establishes coverage.

Each acceptance criterion describes engineering work or evidence that the
independent Reviewer can evaluate before delivery. An applicable steward Step
must cover each criterion. The Review Step can reference the later independent
verdict. The Release Step references host observations after that verdict,
including configured GitHub checks, required PR review and the staging merge.
Reference existing engineering IDs in the Release checklist to retain
attribution. Keep those delivery observations out of the criteria themselves.

## Changes and evidence

A steward repairs ordinary operation, check and self-review findings within its
accepted milestone. Identify the earliest applicable activity that needs change:
documentation for intent, testing for assertions, or implementation for code.
The host persists that rewind and reruns affected downstream work; completed
receipts and unaffected evidence remain available. No correction milestone or
Director call is needed for same-owner repair.

The director controls initial sequencing and changes after explicit escalation or
final independent rejection. Link accepted supplier work or place distinct
supplier work before its dependent. Revisions preserve completed outcomes and
original acceptance. Human approvals concern objectives and architecture.
Unresolved external prerequisites retain named holds without granting authority.
Record position, check outcomes and evidence through the host. Keep a
brief simplification ledger naming removals, reuse and any added responsibility
with its demonstrated need. Retain failed observations and measure each milestone.
