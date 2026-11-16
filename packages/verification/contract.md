# Verification plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Run one acceptance checklist on the assembled task candidate and obtain one
independent read-only verdict for the engineering criteria and the original goal.
Owner feedback checks can run before assembly. Required missing or skipped evidence
blocks acceptance. Route a rejected criterion and its evidence to the accountable
owner through direction. Resolve expected-red and deliberate negative tests as
observed verification rather than failed cycles.

Bind the verdict to the candidate, captured acceptance, checks and environment.
Reuse evidence only when those inputs match. The reviewer receives the complete
evidence by reference with bounded reads. Measure evidence size and report harness
refusals without suppressing or sampling evidence. A verdict records reviewer
identity, profile, criteria, evidence and input digest. The reviewer never writes
candidate files or uses the delivery capability.

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
| VI-10 | A rejected verdict names each failing acceptance id and its accountable owner, and direction turns it into a correction milestone rather than a new state. |
| VI-12 | A verification regression consumes the actual assembled record shape and fails when that shape is wrong, even if an alternate fixture would have passed. |
| VI-13 | The reviewer reads within its captured read scope. Widening that scope is an authority decision for the architect, never a size decision taken by verification. |
| VI-14 | Delivery consumes the accepted verdict and does not run a separate engineering verification pass. |
| VI-15 | A verdict is recorded as evidence with its reviewer identity, profile and input digest, so a later run can show what was actually seen. |
| VI-16 | Verification never merges, publishes or answers a human gate on anyone's behalf. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

VI-11
