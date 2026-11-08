# Library contract — Verification

Type contract: `library`. Stage: **proposed**. Owner: `verification` (absorbs the checking half of
`publisher`, the verification modules of `assignment` and `task-intake`, and the evidence readers of
`report`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-architecture-model.md`](arcnexus-architecture-model.md), [`arcnexus-coordination.md`](arcnexus-coordination.md), [`arcnexus-execution.md`](arcnexus-execution.md), [`arcnexus-direction.md`](arcnexus-direction.md).
Depended on by: `delivery`, `direction` (corrections), the gateway, and every acceptance claim.

Verification decides what the word **passed** is allowed to mean. It is the only component that can
turn a candidate into an accepted candidate, and the only one whose failure mode historically cost
the most: in the last real end-to-end attempt, 40 of 49 failed runs stopped at
`Independent verification needs attention`, one director made 56,273 identical evidence calls at
the same offset, a reviewer consumed 1.7 million input tokens without citing the observation it was
handed, and a review artifact of 2,048,073 characters was rejected at the harness input limit of
2,115,566. Those are not model-quality problems. They are an unbounded interface.

## Identity

| Field | Value |
| --- | --- |
| component | `verification` |
| paths | `src/library/verification`, `tests/library/verification`, `docs/library/verification` |
| current surface | ~2,156 lines across four components: `publisher/delivery-checks` (236), `delivery-verification` (147), `assembly-acceptance`, `promotion-review` (131), `assignment/captured-verification` (103), `session-verification` (148), `task-intake/verification-assessment` and `verification-evidence`, and six `report` evidence readers (1,209) |
| target size | ~600–800 lines |
| model | the reviewer profile from the project contract — never the authoring steward's |

## Provides

| Service | Obligation |
| --- | --- |
| `checklist(candidate, plan)` | run the milestone's checklist **once** against the assembled candidate. Each item yields `passed`, `failed`, `skipped`, `unavailable` or `not-applicable` with the evidence id that supports it. |
| `review(candidate, acceptance, measures)` | one independent, read-only assessment covering both the engineering criteria and, for a task, the original goal. One call, one verdict, one reviewer. |
| `verdict(...)` | `accepted`, `rejected` with each deficiency tied to an acceptance id and the accountable owner, or `unavailable` when a required check could not run. `unavailable` is never folded into `accepted`. |
| `evidenceSet(candidate, acceptance)` | the bounded bundle the reviewer may see: candidate digest, changed-path inventory, per-path diffs by reference, check results with exit status and log ids, and the acceptance text. Assembled to a stated cap; the producer, not the reviewer, is at fault when it exceeds. |
| `reuse(inputs)` | evidence reuse keyed to input digest plus environment identity. Unchanged inputs are not re-run; changed inputs always are. |
| `integrity(candidate, verdict)` | the verdict belongs to exactly this candidate digest. Any change to the candidate voids it. |
| `classification(observation)` | distinguishes an expected failing regression assertion and a deliberate negative test — both normal verification — from a failed cycle. |

## Must never do

Edit source, order or re-plan work, publish or merge anything, weaken an acceptance criterion or a
captured check to obtain a pass, run a second reviewer to double-check the first, or accept on the
strength of an agent's own claim.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | One verification gate per assembled candidate. No per-owner re-verification, no separate delivery-time re-check, no second goal assessment. |
| I2 | A verdict cites acceptance ids and evidence ids. A prose summary without criterion mapping is not a verdict. |
| I3 | Only `passed` supports an acceptance claim. `skipped`, `unavailable` and `not-applicable` are distinct outcomes and leave the candidate unaccepted when required. |
| I4 | Reviewer input is bounded by construction. Exceeding the cap is a finding against the evidence producer and a reason to fix what it emits, never a licence to truncate silently or page through megabytes. |
| I5 | The reviewer is independent: different profile, read-only, never the authoring steward, and never duplicated into a second review pass. |
| I6 | Verification cannot repair what it reviews. Deficiencies return to `direction` as a correction milestone for the accountable owner. |
| I7 | Verdicts are content-addressed to the candidate digest; a changed candidate invalidates the prior verdict rather than inheriting it. |
| I8 | Evidence reuse is by input digest and environment identity, never by elapsed time or file name. |
| I9 | Expected-red regressions and deliberate negative tests are passing verification. They do not break a clean-cycle sequence. |
| I10 | Verification reports what it could not run, and the run is then blocked, not accepted. |
| I11 | Live and simulated verification share one implementation and one meaning; only the namespace and upstream differ. |
| I12 | Verification reads the assembled record, not an assignment-shaped approximation of it. A test that cannot reproduce the real record shape does not prove the behaviour. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| VI-1 | One candidate produces exactly one checklist run and one reviewer verdict; no owner-scoped re-verification pass executes in between. |
| VI-2 | A verdict that cites no acceptance id, or cites one the plan does not contain, is rejected as invalid. |
| VI-3 | A required check reported `skipped` or `unavailable` leaves the candidate unaccepted and the run blocked with the reason. |
| VI-4 | An evidence set over the stated cap is refused with a finding naming the producer and the offending artefact; nothing is silently truncated and no paging loop is entered. |
| VI-5 | Changing any byte of the candidate voids the previous verdict; the same candidate reproduces it. |
| VI-6 | Unchanged inputs reuse recorded evidence; a changed input digest forces a re-run. |
| VI-7 | Verification cannot edit the candidate: an attempted write is refused by the checked-edit path, and no verification stage grants itself write authority. |
| VI-8 | The reviewer runs under the reviewer profile with read-only scope, and is never the steward who authored the change. |
| VI-9 | An expected-red regression and a deliberate negative test are recorded as verification that passed, and do not end a clean-cycle sequence. |
| VI-10 | A rejected verdict names each failing acceptance id and its accountable owner, and direction turns it into a correction milestone rather than a new state. |
| VI-11 | Live and simulated verification produce the same verdict shape with the same meaning, from the same code path. |
| VI-12 | A regression whose input is built from an assignment-shaped fixture, while the production record differs, fails VI-12 rather than passing green. |
| VI-13 | Verification cannot widen its own evidence read: private paths of another owner are not in the bundle, and requesting them is refused. |
| VI-14 | Deleting the duplicate re-verification, characterization re-check and promotion-review modules leaves no caller in the acceptance path. |
| VI-15 | A verdict is recorded as evidence with its reviewer identity, profile and input digest, so a later run can show what was actually seen. |
| VI-16 | Verification never merges, publishes or answers a human gate on anyone's behalf. |

## Migration

| Current | Target | Effect |
| --- | --- | --- |
| `publisher/delivery-checks` (236) run per owner, again at assembly, again as `delivery.verify`, plus `assembly-acceptance` | `checklist` once on the assembled candidate | removes the re-verification chain and the `acceptedChecks` cache that existed to mitigate it |
| `publisher/promotion-review` (131) and `delivery-verification` (147) | deleted with the promotion subsystem | one publication route, one meaning of accepted |
| `assignment/captured-verification` (103) and `session-verification` (148) | folded into `checklist` and `classification` | no per-stage re-check of the same bytes |
| `task-intake/verification-assessment` and `verification-evidence` | `review` — one call covering engineering and goal | direction stops judging its own plan; verification stops running twice |
| `report/execution-evidence` (356), `evidence-pages` (200), `referenced-evidence` (138), `invocation-diagnostics` (204) | `evidenceSet` with a stated cap | the paging subsystem disappears because the bundle is bounded where it is produced |
| `report/delivery-evidence`, `publication-evidence`, `recovery-evidence` | coordination entities and derived reports | removes mirrors of facts the store already holds |

Migration lands in cleanup batch 3 (one gate) and is verified by VI-14 together with EX-17, CO-16
and DI-15: no caller left for the duplicate checking, and no caller left for what it rescued.

## Non-goals

Continuous regression dashboards, flaky-test quarantine, coverage targets as acceptance, a second
independent reviewer, performance benchmarking, security scanning, and any check whose only output is
a paragraph an agent can agree with.

## Open questions for the architect

1. **Cap value.** I propose a reviewer input cap around 200,000 characters — comfortably below the
   observed harness rejection at 2,115,566 and above the 139,660-byte turn prompts that worked — with
   the diff carried by reference and read on demand. Do you want that number, or tighter?
2. **Who may re-run verification.** I propose only an input or environment change re-runs it, and a
   rejected verdict is re-run solely after a correction milestone changes the candidate. The
   alternative allows an operator to request a fresh review of unchanged bytes; I would rather refuse
   that, because re-reviewing identical input is how the 33-repeat-check defect class returned.
3. **Goal assessment placement.** I propose one reviewer call covers engineering criteria and goal
   acceptance, as the MVP plan states. The alternative is a separate goal assessor, which I count as a
   second reviewer and would violate I1. Confirm before locking.

## Lock record

```yaml
id: arcnexus/verification
stage: proposed
revision: 1
acceptedBy: null
acceptedAt: null
changes: null
```
