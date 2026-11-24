# Delivery

Delivery carries the independently accepted candidate through one staging PR.
The [locked contract](contract.md), particularly DE-2 through DE-6 and DE-14,
governs publication identity, reconciliation, gates and recorded results.
The scenarios below state intended behavior and required regression evidence;
they do not establish that a real delivery has occurred.

[Publication recovery](docs/check-recovery.md) records the accepted continuation,
current production-service assertions and retained Execution/Verification outcomes
for issue #720 at captured revision
`fef60bb8d6aec3c2dcbedb06cac13c2cc3ee79b8`. It distinguishes existing recovery
behavior, pending Delivery characterization and remaining provider-state coverage.
Preserve the task and its history, require acceptance for the recovered identity,
inspect provider facts before effects, and reconcile the existing PR.

## Retained publication identity

The [public entry](src/index.ts) exposes publication with a retained staging
`target`, issue `branch`, accepted commit `head`, `issue`, accepted tree digest
`candidate`, reviewed staging `parent` and associated `verification` identity.
The host integration entry validates that identity against the current captured
plan, required checks and independent verdict before committing the candidate;
calling the lower-level publication helper alone does not prove this admission.
Keep these identities fixed throughout
publication. A changed staging parent requires renewed engineering acceptance;
Delivery cannot rebase or otherwise change the accepted candidate to continue.
This implements the contract's candidate-matching obligation and DE-2 through DE-4.

## Publication and refusal scenarios

The task criteria extend regression evidence for the locked scenarios without
changing their authority or the provider boundary.

| Criterion | Observation | Required outcome |
| --- | --- | --- |
| DE-BASE | Staging differs from the reviewed parent before initial publication, whether the issue branch is absent or already contains the accepted head. | Refuse before pushing or opening a PR. |
| DE-BASE | A matching open PR is resumed while staging has moved. | Refuse before merge. |
| DE-BASE | Staging matches initially but moves during provider verification. | Observe staging again after verification and refuse before merge. A previously matching observation cannot authorize integration. |
| DE-IDENTITY | An observed PR has a different head or target. | Refuse before any publication mutation, including when the observed PR is already merged. |
| DE-IDENTITY | A matching open PR has an issue branch whose remote head is missing or differs from the accepted head. | Refuse before mutation; do not repair or overwrite the branch. |
| DE-GATES | Provider verification fails. | Propagate failure without requesting merge. Pending required checks or review leave delivery pending under DE-4. |
| DE-GATES | Merge returns an identity but tree confirmation fails. | Do not return a successful delivery result. Retain the observation so a later attempt can reconcile the possible merge. |
| DE-GATES | A new merge succeeds and its tree is confirmed. | Return the single PR URL and the provider-observed merge commit identity. |
| DE-GATES | A matching merged PR is observed on a later attempt. | Verify and confirm that recorded merge, return its PR URL and commit identity, and perform no push, PR creation or merge. |

A moved-base refusal applies before effects on an unmerged publication. For an
already merged PR, DE-6 instead requires confirmation that the observed merge
contains the accepted tree and remains on staging; staging need not still equal
the original parent.

## Pinned gates and results

Under DE-4, verify the chosen PR with the accepted `head` and retained `target`
using the provider's open-state verification. Recheck the reviewed staging parent
after verification, then request merge with that same PR, `head` and `issue`.
Confirm the returned commit against `candidate` and `target` before returning
`{ pr, commit }`.

Under DE-6, verify the observed merged PR with its URL, accepted `head`, retained
`target` and explicit `MERGED` state. Confirm its observed commit against the same
`candidate` and `target` before returning the observed identities. Do not infer
success from command completion or substitute the accepted head for the merge
commit. Store the confirmed result once as required by the contract.

DE-5 requires provider inspection before retrying an uncertain effect. Reuse an
observed matching push or open PR instead of repeating it. Refuse a conflicting
remote branch, a closed unmerged PR or an unavailable observation before further
mutation. Uncertainty alone does not create a human gate; DE-5b defines when a
named external action does.

## Historical owner evidence

The current source reconciliation and characterization obligations are in
[Publication recovery](docs/check-recovery.md#current-characterization-scope-issue-720).
It supersedes treating the earlier implementation-gap description as current work.
The result below is historical owner evidence; it does not establish execution of
the current integration scenarios or apply automatically to the recovered candidate.

The retained `40-1-owner-tests.log` reports 24 passing delivery tests with no
failures, cancellations or skips from `npm test -- delivery`, including its build.
The [owner suite](tests/unit/publication.test.ts) now covers:

- DE-5 and DE-REGRESSION: initial publication after observing remote absence,
  resumed publication after lost push or PR responses, refusal of closed PRs,
  conflicting initial remote heads and unavailable PR reads.
- DE-6: reuse of an observed matching merge without push, PR creation or merge.
- DE-BASE: staging movement before initial publication with either an absent or
  matching issue branch, before merging a resumed PR, and after initial or during
  resumed verification. These cases refuse publication or merge at the
  corresponding boundary.
- DE-IDENTITY: conflicting heads or targets on open and merged PRs, and missing
  or conflicting remote issue branches when resuming an open PR.
- DE-GATES: exact verification, merge and confirmation arguments, confirmed return
  identities for new and reused merges, and use of the observed PR URL throughout
  resumed publication. Verification failures stop subsequent effects; failed tree
  confirmation rejects success for both open and already merged PRs. A controlled
  pending verification prevents merge until the gate resolves.

The scenario fixture controls staging observations and asserts provider arguments:
verification receives the chosen PR URL, accepted `head` and retained `target`,
plus explicit `MERGED` state for a reused merge; merge receives that PR URL,
`head` and `issue`; confirmation receives the returned or observed merge commit,
`candidate` and `target`. Result assertions retain the PR URL and confirmed merge
identity, including a resumed PR URL distinct from the initial fixture URL and a
reused merge commit distinct from the accepted head. Call-sequence assertions
show that refused paths do not perform prohibited subsequent effects.

The earlier documentation correction cited that retained owner result and source
inspection. This reconciliation changes no executable behavior. These deterministic tests
use simulated providers without live GitHub access. They establish owner behavior,
not a real delivery or hosted gate outcomes.

Separate real-delivery evidence remains required under DE-4, DE-6 and DE-14:
independent acceptance of the exact candidate tree, configured hosted CI and review,
and retained provider observations linking that tree on staging to its single
staging PR and confirmed provider merge identity. The host performs assembled
verification and delivery; the passing owner suite does not establish those
observations.
