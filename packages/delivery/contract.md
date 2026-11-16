# Delivery plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Consume one assembled candidate, its retained engineering base and the accepting
verification verdict. Match candidate digest and scope before performing an effect.
The host commits on the task branch, pushes and opens one staging pull request
through collaboration. Observe CI and configured review. The provider merges the
verified head when authorized and returns the merge identity. Store that result once.
Use milestone attribution from the single worktree instead of steward branches.

A pending check or review leaves the delivery pending. A genuine external action
is a named gate. Inspect provider state after an uncertain effect before another
attempt. Preserve the report and candidate if delivery cannot finish. Delivery
cannot accept work, modify the candidate, bypass review, approve a PR, or merge
to main. Release and simulation operations are deferred.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| DE-1 | A candidate without an accepting verdict cannot be captured; the refusal names the missing verdict. |
| DE-2 | `capture` records the retained assembly base as the publication parent. A regression built from the **actual production assembled record**, not an assignment-shaped fixture, proves it; a fixture that hides the real record shape fails this scenario. |
| DE-3 | Publishing from the architectural authority revision or from a verification checkout is refused with the three identities distinguished. |
| DE-4 | The host opens one staging PR for the task, observes CI and configured review, requests provider merge of the verified head, and records the resulting identity. |
| DE-5 | A push whose outcome is unknown is followed by a provider inspection; the retry is justified by the observed state, and no blind replay occurs. The uncertainty alone does not raise a human gate. |
| DE-5b | An observation showing genuinely required external action — a missing credential the run cannot obtain, an irreversible provider state — raises a blocking-question gate naming that action, and nothing else does. |
| DE-6 | A second delivery attempt for an already merged candidate is a no-op reporting the recorded merge identity, not a duplicate pull request. |
| DE-7 | Conflicting contributions are refused before overwriting recorded workspace content. The goal retains prior attribution and conflict evidence. |
| DE-13 | Delivery cannot widen the candidate: an edit attempted during publication is refused by the checked-edit path. |
| DE-14 | Staging integration uses one delivery path and derives its status from retained observations and provider facts. |
| DE-15 | The delivery record holds ids and digests only; no Git object content is duplicated into the store, and the store survives a repository garbage collection unchanged. |
| DE-16 | Two sequential owners retain attribution in one candidate and one PR, without allocating branches per steward. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

DE-8, DE-9, DE-10, DE-11, DE-12
