# Library contract — Delivery

Type contract: `library`. Stage: **proposed**. Owner: `delivery` (absorbs the publication half of
`publisher`, the upstream transports in `operations`, and the delivery-record consumers in
`coordination-store`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-coordination.md`](arcnexus-coordination.md), [`arcnexus-verification.md`](arcnexus-verification.md), [`arcnexus-direction.md`](arcnexus-direction.md).
Depended on by: `release`, the gateway, and every claim that work reached a branch.

Delivery moves an **already verified** candidate into Git and then to a release. It is the only
component that talks to an upstream, and it converts a verdict into a commit — nothing more. It
does not decide whether work is good, and it does not publish anything that verification has not
accepted.

## Identity

| Field | Value |
| --- | --- |
| component | `delivery` |
| paths | `src/library/delivery`, `tests/library/delivery`, `docs/library/delivery` |
| current surface | ~3,693 lines: `publisher` publication modules (1,043), `operations/github-*` (751), `operations/simulated-*` (508), `upstream-*` (245), `coordination-store` delivery modules (343), `delivery-command` gateway (75) |
| target size | ~900–1,200 lines |
| upstream | the forge named by the project's delivery policy, reached with the machine's declared credential |

## Provides

| Service | Obligation |
| --- | --- |
| `capture(candidate, verdict)` | a delivery record bound to the verified candidate digest **and** the verdict that accepted it. Its base is the retained engineering baseline of the accepted assembly — not the architectural authority revision, and not a verification checkout. |
| `integrate(delivery)` | commit to the goal's work branch, push, open the pull request against the base branch, wait for CI and any configured review requirement, merge, and record the merge identity returned by the provider. Automatic for staging. |
| `prepareRelease(project, range)` | the release candidate: shipping changes derived from the pinned previous-release-to-candidate range, changelog and version edits, and the protected-branch pull request. Automated right up to the gate. |
| `awaitGate(gate)` | the production boundary: ends the goal `blocked: awaiting release` naming precisely what the human must do, with the candidate, verdict and evidence references attached. |
| `verifyRelease(releaseIdentity)` | live evidence for a release: pipeline status for the released revision, deployed health where the project kind has a deployment, and the project's live acceptance suite. Recorded as live, never as staging or simulated. |
| `reconcile(observation)` | when an upstream outcome is unknown, inspect provider state and record what is actually true before any retry. A reconciled action is a new observation, not a replay of an uncertain one. |
| `attribution(delivery)` | steward branches keep their own history and ownership; the goal is delivered as one pull request, and those branches do not each acquire a publication lifecycle. |

## Must never do

Judge acceptance, run the target's tests as proof, edit source, plan or reorder work, widen scope
beyond the verified candidate, merge a protected branch, tag, publish, deploy, or maintain a receipt
ledger that re-states a fact Git and the provider already hold.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | One publication route and one engine. Live and simulated differ by namespace and by an upstream refusal, never by a second implementation. |
| I2 | **The engineering baseline is the retained assembly base.** The authority revision and the verification checkout are not substitutes for it, and a wrong base is a defect in this contract, not a condition to work around. |
| I3 | No verdict, no delivery. A delivery record is meaningless without the candidate digest and the verdict id it came from. |
| I4 | Staging integration is automatic once checks, CI and any configured review requirement pass. Only production release awaits a human; nothing in between is human-required. |
| I5 | Upstream effects are observed, not assumed. An unknown outcome is resolved by inspecting provider state before retrying, and is never blindly replayed. |
| I6 | The merge identity is recorded once, from the provider, and every view derives from it. No parallel milestone-receipt store exists for the same fact. |
| I7 | One pull request per accepted goal. Cross-owner contributions are assembled first and attributed within that delivery. |
| I8 | Release verification is live or it is nothing. Simulated or staging evidence is never presented as proof of a release, and the check labels its own environment. |
| I9 | Delivery publishes exactly the verified candidate: same digest, same scope, no opportunistic fixes. |
| I10 | Agents never approve pull requests, merge a protected branch, tag, publish or deploy. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| DE-1 | A candidate without an accepting verdict cannot be captured; the refusal names the missing verdict. |
| DE-2 | `capture` records the retained assembly base as the publication parent. A regression built from the **actual production assembled record**, not an assignment-shaped fixture, proves it; a fixture that hides the real record shape fails this scenario. |
| DE-3 | Publishing from the architectural authority revision or from a verification checkout is refused with the three identities distinguished. |
| DE-4 | `integrate` opens one pull request for the goal, waits for CI, merges when the gates are satisfied, and records the provider's merge identity without any human turn. |
| DE-5 | A push whose outcome is unknown is followed by a provider inspection; the retry is justified by the observed state, and no blind replay occurs. |
| DE-6 | A second delivery attempt for an already merged candidate is a no-op reporting the recorded merge identity, not a duplicate pull request. |
| DE-7 | Conflicting contributions from two owners block assembly and retain both sides; delivery does not choose a winner. |
| DE-8 | A simulated delivery cannot reach a live upstream and cannot produce a live release record, using the same code path as a live delivery. |
| DE-9 | `prepareRelease` derives scope from the pinned range, edits changelog and version through the normal checked-edit path, and opens the protected-branch pull request without merging it. |
| DE-10 | Reaching the production boundary ends the goal `blocked: awaiting release` with the exact human action named; no flag or configuration turns that gate into an automatic merge. |
| DE-11 | `verifyRelease` reports pipeline status, deployment health where applicable, and live acceptance results, each labelled with its environment; an unavailable check leaves the release unverified. |
| DE-12 | Staging or simulated evidence presented as release proof fails this scenario. |
| DE-13 | Delivery cannot widen the candidate: an edit attempted during publication is refused by the checked-edit path. |
| DE-14 | Deleting the promotion subsystem, the simulated twin engine, the provider receipt store and the external-effect ledger leaves no caller in the publication path. |
| DE-15 | The delivery record holds ids and digests only; no Git object content is duplicated into the store, and the store survives a repository garbage collection unchanged. |
| DE-16 | Steward branches keep their attribution after the goal's single pull request merges; no per-owner publication lifecycle is created for them. |

## Migration

| Current | Target | Effect |
| --- | --- | --- |
| `publisher/live-publication` (208) and `simulation-publication` (179) | one publication route with a namespace refusal | removes the twin engines and the 44 live-versus-simulation branch points |
| `publisher/promotion-review` (131), promotion assembly and resume paths | deleted with the promotion subsystem | the simulation-to-live handoff stops being a lifecycle stage |
| `publisher/publication-effects` (121) and the `lifecycle` external-effect intent store | `reconcile` observing provider state | removes the prepared/uncertain/completed ledger and its reconciliation code |
| `coordination-store/delivery-store` triple status columns plus milestone receipts | one delivery entity in the project store | one recorded merge identity, derived views, no parallel ledgers (I6) |
| `operations/simulated-pull-requests` (278), `simulated-releases` (115), `simulated-upstream` (100), `provider-store` | a simulation namespace over the same transport | removes a second fake-GitHub implementation while keeping the isolation invariant |
| `arcnexus delivery approve/publish/promote` | retired per the gateway contract; gates answered through `task answer` | no operator command bypasses a human gate |
| `publisher/delivery-checks` (236) and `delivery-verification` (147) | moved to `verification` as the single gate | publication stops re-verifying what was already accepted |

Migration lands in cleanup batch 4 (one route) and is verified by DE-14 together with VI-14, EX-17,
CO-16 and DI-15.

## Non-goals

Cross-repository transactions, multi-branch release trains, deployment orchestration of external
services, package-registry publication beyond what the release contract declares, automatic
production merge under any configuration, and any recovery path for a historical failed delivery.

## Open questions for the architect

1. **Merge mechanics.** I propose the provider performs the merge and returns its identity, with the
   existing compare-and-swap check that the target head is unchanged. The current code assembles a
   local merge and pushes the branch directly. Provider merge keeps one source of truth; local push
   keeps the merge deterministic and offline. Which do you want for the MVP?
2. **What "production release" means for ArcNexus.** The package is private and unpublished, so
   today the production gate is effectively the protected-branch merge. Should the contract treat
   registry publication and container image release as declared-but-inactive targets, or name only
   the protected-branch merge until a real publication route exists?
3. **Reconcile authority.** Is inspect-and-record sufficient for an unknown upstream outcome, or
   should an unresolved uncertainty always become a human gate rather than an agent observation?

## Lock record

```yaml
id: arcnexus/delivery
stage: proposed
revision: 1
acceptedBy: null
acceptedAt: null
changes: null
```
