# Library contract — Verification

Type contract: `library`. Stage: **locked** (revision 2). Owner: `verification` (absorbs the checking
half of `publisher`, the verification modules of `assignment` and `task-intake`, and the evidence
readers of `report`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-architecture-model.md`](arcnexus-architecture-model.md), [`arcnexus-coordination.md`](arcnexus-coordination.md), [`arcnexus-execution.md`](arcnexus-execution.md), [`arcnexus-direction.md`](arcnexus-direction.md).
Depended on by: `delivery`, `direction` (corrections), the gateway, and every acceptance claim.

Verification decides what the word **passed** is allowed to mean. It is the only component that can
turn a candidate into an accepted candidate, and the only one whose failure mode historically cost
the most: in the last real end-to-end attempt, 40 of 49 failed runs stopped at
`Independent verification needs attention`, one director made 56,273 identical evidence calls at
the same offset, a reviewer consumed 1.7 million input tokens without citing the observation it was
handed, and a review artifact of 2,048,073 characters was rejected at the harness input limit of
2,115,566. Those are not model-quality problems, and they are not solved by caps. They are an interface that
inlined what should be referenced, repeated what should be assembled once, and never measured what
it sent.

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
| `evidenceSet(candidate, acceptance)` | the bundle the reviewer is given: candidate digest, changed-path inventory, per-path diffs **by reference**, check results with exit status and log ids, and the acceptance text. Nothing is truncated, sampled or omitted for size. The bundle's byte count, item count and composition are recorded as measures with the verdict, so a future limit is placed on evidence rather than on instinct. |
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
| I4 | **No limits in the first system.** Verification imposes no size, count, attempt or duration cap, and never truncates, samples or omits evidence to fit. Artefacts travel by reference and are read on demand, so a paging loop is unnecessary rather than forbidden. Where an external harness cannot accept an input, that is recorded as an unavailable check with the measured cause and byte count — never silently worked around by cutting content. |
| I4b | Every bundle is measured: bytes, item count, the largest contributors, and the reviewer's token use. These are recorded as measures on the verdict so limits can be located later from observed evidence. |
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
| VI-4 | A bundle is assembled in full at any size, with artefacts carried by reference and read on demand; the recorded measures name its bytes, item count and largest contributors, and no paging loop is entered. |
| VI-4b | When an external harness cannot accept an input, the check is recorded `unavailable` with the measured byte count and cause; the content is never trimmed to make it fit and the candidate is not accepted. |
| VI-5 | Changing any byte of the candidate voids the previous verdict; the same candidate reproduces it. |
| VI-6 | Unchanged inputs reuse recorded evidence; a changed input digest forces a re-run. |
| VI-7 | Verification cannot edit the candidate: an attempted write is refused by the checked-edit path, and no verification stage grants itself write authority. |
| VI-8 | The reviewer runs under the reviewer profile with read-only scope, and is never the steward who authored the change. |
| VI-9 | An expected-red regression and a deliberate negative test are recorded as verification that passed, and do not end a clean-cycle sequence. |
| VI-10 | A rejected verdict names each failing acceptance id and its accountable owner, and direction turns it into a correction milestone rather than a new state. |
| VI-11 | Live and simulated verification produce the same verdict shape with the same meaning, from the same code path. |
| VI-12 | A regression whose input is built from an assignment-shaped fixture, while the production record differs, fails VI-12 rather than passing green. |
| VI-13 | The reviewer reads within its captured read scope. Widening that scope is an authority decision for the architect, never a size decision taken by verification. |
| VI-14 | Deleting the duplicate re-verification, characterization re-check and promotion-review modules leaves no caller in the acceptance path. |
| VI-15 | A verdict is recorded as evidence with its reviewer identity, profile and input digest, so a later run can show what was actually seen. |
| VI-16 | Verification never merges, publishes or answers a human gate on anyone's behalf. |

## Migration

| Current | Target | Effect | Status |
| --- | --- | --- | --- |
| `publisher/delivery-checks` (236) run per owner, again at assembly, again as `delivery.verify`, plus `assembly-acceptance` | `checklist` once on the assembled candidate | removes the re-verification chain and the `acceptedChecks` cache that existed to mitigate it | partly done (#362, #375) — per-owner replay and the assembly `AssemblyAcceptance` chain are deleted, and verdict reuse replaced the `acceptedChecks` cache; a provider-declared `delivery.verify` step remains in the live route |
| `publisher/promotion-review` (131) and `delivery-verification` (147) | deleted with the promotion subsystem | one publication route, one meaning of accepted | partly done (#367, #374) — `promotion-review` is deleted and publication now attests to the one recorded verdict; `delivery-verification` remains as the capture attestation |
| `assignment/captured-verification` (103) and `session-verification` (148) | folded into `checklist` and `classification` | no per-stage re-check of the same bytes | partly done (#375) — `captured-verification` is deleted with no caller left; `session-verification` remains as the single owner-side verification and has not yet been folded into `checklist`/`classification` |
| `task-intake/verification-assessment` and `verification-evidence` | `review` — one call covering engineering and goal | direction stops judging its own plan; verification stops running twice | not started |
| `report/execution-evidence` (356), `evidence-pages` (200), `referenced-evidence` (138), `invocation-diagnostics` (204) | `evidenceSet` with artefacts by reference and full measurement | the paging subsystem is **replaced**, not capped: references make the repeat-read loop unnecessary, and measures make its cost visible | not started — this is step 3c |
| `report/delivery-evidence`, `publication-evidence`, `recovery-evidence` | coordination entities and derived reports | removes mirrors of facts the store already holds | not started |

Migration lands in cleanup batch 3 (one gate) and is verified by VI-14 together with EX-17, CO-16
and DI-15: no caller left for the duplicate checking, and no caller left for what it rescued.

## Non-goals

Continuous regression dashboards, flaky-test quarantine, coverage targets as acceptance, a second
independent reviewer, performance benchmarking, security scanning, any check whose only output is a
paragraph an agent can agree with — and **no size, count, attempt or duration limits in the first
system**. Limits are placed later from recorded measures, because where this project has used limits
they cost time and lost work.

## Accepted decisions

1. **No limits.** The architect rejected caps on reviewer input for the first system: limits have
   historically cost time and lost work, so the design measures and observes, and a limit is placed
   only where evidence later says it belongs. I4 and I4b replace the proposed cap with assembly in
   full, artefacts by reference, recorded measures, and an honest `unavailable` outcome when an
   external harness refuses an input.
2. **Re-run authority:** only a changed input digest or environment identity re-runs verification; a
   rejected verdict is re-run after a correction changes the candidate, and identical bytes are never
   re-reviewed on request (I8, VI-6).
3. **One reviewer:** a single independent assessment covers the engineering criteria and, for a task,
   the original goal. A separate goal assessor would be the second reviewer I1 forbids (I1, VI-1).

## Lock record

```yaml
id: arcnexus/verification
stage: locked
revision: 3
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 3: migration table gains a Status column recording cleanup batch 3 and 4 against the
    files that exist — `assembly-acceptance` and `captured-verification` deleted with no caller
    left (#375, VI-14 checked), the `acceptedChecks` cache replaced by content-addressed verdict
    reuse (#362), promotion-review deleted (#367), and publication now attesting to the one
    recorded verdict rather than reconstructing a second goal proof (#374). Rows still open remain
    visible, including step 3c's evidence-by-reference replacement. Invariants, scenarios and
    targets unchanged.
  - revision 2: locked with the architect's answers. The proposed reviewer input cap is removed
    entirely — no size, count, attempt or duration limits in the first system; bundles are assembled
    in full with artefacts by reference and every bundle measured, and an external harness refusal
    becomes an unavailable check with its byte count rather than trimmed content (I4, I4b, VI-4,
    VI-4b). Re-run authority and the single reviewer confirmed as proposed.
  - revision 1: proposed in #356 with three open questions, all since answered
```
