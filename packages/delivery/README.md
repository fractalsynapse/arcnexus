# Delivery

Delivery carries the independently accepted candidate through one staging PR.
The [locked contract](contract.md), particularly DE-2 through DE-6 and DE-14,
governs publication identity, reconciliation, gates and recorded results.
The scenarios below state intended behavior and required regression evidence;
they do not establish that a real delivery has occurred.

## Retained publication identity

The [public entry](src/index.ts) exposes publication with a retained staging
`target`, issue `branch`, accepted commit `head`, `issue`, accepted tree digest
`candidate` and reviewed staging `parent`. Keep these identities fixed throughout
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

## Evidence and remaining coverage

The retained `104-1-owner-tests.log` reports five passing delivery unit tests.
The [owner suite](tests/unit/publication.test.ts) covers initial publication,
resumption after lost push or PR responses, refusal of a closed PR, reuse of an
observed merge, conflicting initial remote heads and unavailable PR reads.
Its staging fixture always returns the reviewed parent, and its provider call
log records operation names without arguments.

Required additional evidence is controllable staging movement, conflicting
observed PR heads and targets, conflicting resumed branch state, exact arguments
for verification, merge and confirmation, verification and confirmation failures,
and returned identities for both new and reused merges. Refusal assertions must
show that the prohibited subsequent effects did not occur. Preserve the existing
reconciliation and reused-merge coverage under DE-REGRESSION. Observe a failing
public regression before correcting any discovered behavioral defect.

This documentation step declares no executable checks. Later owner checks must
retain their candidate and test scope. Simulated provider calls establish owner
behavior only. A real delivery additionally needs independent acceptance,
configured hosted CI and review, and retained provider evidence linking the single
staging PR and observed merge commit to the accepted tree on staging.
