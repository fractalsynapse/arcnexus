# Delivery plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Consume one assembled candidate, its retained engineering base and the accepting
verification verdict. Match candidate digest and scope before performing an effect.
Execution may commit and push checked intermediate checkpoints to the issue branch
through Collaboration. Delivery opens one staging pull request for the independently
accepted final tree. Checkpoint availability confers no integration authority. Observe CI and configured review. The provider merges the
verified head when authorized and returns the merge identity. Store that result once.
Use milestone attribution from the single worktree instead of steward branches.

A pending check or review leaves the delivery pending. An unavailable external
prerequisite is a named hold. It is distinct from approval of objectives, goals or
architecture and cannot authorize an effect. Inspect provider state after an
uncertain effect before another attempt. Preserve the report and candidate if delivery cannot finish. Delivery
cannot accept work, modify the candidate, bypass review, approve a PR, or merge
to main. Release and simulation operations are deferred.

A retryable or uncertain publication remains with Delivery, which observes the
provider before retrying through the same path. When publication reveals an
engineering defect, return the actual failure to Workflow for accountable repair.
Delivery cannot edit the accepted candidate. Changed work requires refreshed
affected checks and an applicable independent verdict before publishing again.
Retain the issue and existing PR identity; discover the existing publication
before creating another. Ordinary staging retries require no new human approval.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| DE-1 | A candidate without an accepting verdict cannot be captured; the refusal names the missing verdict. |
| DE-2 | `capture` records the retained assembly base as the publication parent. A regression built from the **actual production assembled record**, not an assignment-shaped fixture, proves it; a fixture that hides the real record shape fails this scenario. |
| DE-3 | Publishing from the architectural authority revision or from a verification checkout is refused with the three identities distinguished. |
| DE-4 | The host opens one staging PR for the task, observes CI and configured review, requests provider merge of the verified head, and records the resulting identity. |
| DE-5 | A push whose outcome is unknown is followed by a provider inspection; the retry is justified by the observed state, and no blind replay occurs. The uncertainty alone does not raise a human gate. |
| DE-5b | An observation showing an unavailable external prerequisite, including a missing credential or irreversible provider state, retains a named hold with the required action. It is not a request to approve routine implementation and never authorizes bypassing a delivery gate. |
| DE-6 | A second delivery attempt for an already merged candidate is a no-op reporting the recorded merge identity, not a duplicate pull request. |
| DE-7 | Conflicting contributions are refused before overwriting recorded workspace content. The goal retains prior attribution and conflict evidence. |
| DE-13 | Delivery cannot widen the candidate: an edit attempted during publication is refused by the checked-edit path. |
| DE-14 | Staging integration uses one delivery path and derives its status from retained observations and provider facts. |
| DE-15 | The delivery record holds ids and digests only; no Git object content is duplicated into the store, and the store survives a repository garbage collection unchanged. |
| DE-16 | Two sequential owners retain attribution in one candidate and one PR, without allocating branches per steward. |
| DE-17 | Uncertain publication is reconciled before retry. A publication-discovered engineering defect returns for accountable repair, then refreshed affected checks and independent review. The existing issue and PR are reused without editing a candidate during publication. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

DE-8, DE-9, DE-10, DE-11, DE-12
