# Verification plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Run one acceptance checklist on the assembled task candidate and obtain one
independent read-only verdict for the engineering criteria and the original goal.
Applicable component feedback checks run before progression when needed; a test
suite is one operation category rather than the definition of verification.
Required missing or skipped evidence blocks acceptance. Ordinary check failures
return to the accountable activity through Workflow. A valid final independent
rejection sends its failed criteria and evidence through Direction. Resolve expected-red and deliberate negative tests as
observed verification rather than failed cycles.

Bind the verdict to the candidate, captured acceptance, checks and environment.
Reuse evidence only when those inputs match. The reviewer receives the complete
evidence by reference with complete file reads. Measure evidence size and report harness
refusals without suppressing or sampling evidence. A verdict records reviewer
identity, profile, criteria, evidence and input digest. The reviewer never writes
candidate files or uses the delivery capability.

Bind each check or observation to its actual relevant inputs and environment;
bind the independent verdict to the full candidate. A scoped observation may be
reused after unrelated edits only when its declared inputs and environment match.
A changed candidate always requires an applicable independent verdict. Return
malformed or invalid review citations to the Reviewer for repair with the exact
finding while retaining the candidate and unchanged check evidence.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| VI-1 | One candidate produces exactly one checklist run and one reviewer verdict; no owner-scoped re-verification pass executes in between. |
| VI-2 | A verdict that cites no acceptance id, or cites one the plan does not contain, is rejected as invalid. |
| VI-3 | A required check reported `skipped` or `unavailable` leaves the candidate unaccepted and the run blocked with the reason. |
| VI-4 | A bundle is assembled in full at any size, with artefacts carried by reference and read on demand; the recorded measures name its bytes, item count and largest contributors, and no paging loop is entered. |
| VI-4b | When an external harness cannot accept an input, the check is recorded `unavailable` with the measured byte count and cause; the content is never trimmed to make it fit and the candidate is not accepted. |
| VI-5 | A changed candidate digest makes the previous verdict inapplicable. Identical inputs and environment recover the same recorded verdict. |
| VI-6 | Unchanged inputs reuse recorded evidence; a changed input digest forces a re-run. |
| VI-7 | Verification cannot edit the candidate: an attempted write is refused by the checked-edit path, and no verification stage grants itself write authority. |
| VI-8 | The reviewer runs under the reviewer profile with read-only scope, and is never the steward who authored the change. |
| VI-9 | An expected-red regression and a deliberate negative test are recorded as verification that passed, and do not end a clean-cycle sequence. |
| VI-10 | A valid rejected verdict names each failing acceptance id and its accountable owner. Direction revises pending corrective work while preserving original acceptance. A malformed verdict returns to the same Reviewer for repair before any plan revision. |
| VI-12 | A verification regression consumes the actual assembled record shape and fails when that shape is wrong, even if an alternate fixture would have passed. |
| VI-13 | The reviewer reads within its captured read scope. Widening that scope is an authority decision for the architect, never a size decision taken by verification. |
| VI-14 | Delivery consumes the accepted verdict and does not run a separate engineering verification pass. |
| VI-15 | A verdict is recorded as evidence with its reviewer identity, profile and input digest, so a later run can show what was actually seen. |
| VI-16 | Verification never merges, publishes or answers a human gate on anyone's behalf. |
| VI-17 | An ordinary failed component check returns to its accountable activity without Direction. Final independent rejection invokes Direction. Reviewer response repair retains the exact candidate and applicable check evidence. |
| VI-18 | Reuse depends on a check's declared relevant inputs and environment. An unrelated edit does not alone invalidate a scoped observation; a changed relevant input reruns it, and a changed candidate invalidates its prior verdict. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

VI-11
