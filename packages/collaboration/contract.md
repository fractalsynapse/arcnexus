# Collaboration plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Expose tracking, comments, pull-request creation and observation, remote head
inspection, and merge against the verified head. The application composes the
GitHub implementation. The provider performs the merge and returns the resulting
identity. Observe actual check and review results and distinguish unavailable
operations from success. Host policy supplies credentials, authorized repository,
branch and operation. A steward cannot select a provider or receive its credentials.

Tests may inject a provider through the same public seam. Their isolation prevents
live upstream access. Evidence from a test provider establishes test behavior only.
An evidence-package provider and live simulation flag are deferred.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| CP-4 | A provider that cannot complete an operation reports `unavailable`; the run is blocked, never accepted. |
| CP-6 | A fixture provider can replace GitHub at composition through the same declared collaboration interface. No test path can reach the live upstream. |
| CP-8 | A merge request for the verified head returns the provider merge identity. A head mismatch is refused and no merge is requested. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

CP-1, CP-2, CP-3, CP-5, CP-7
