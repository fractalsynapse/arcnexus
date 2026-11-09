# Library contract — Delivery

Type contract: `library`. Stage: **locked** (revision 2). Owner: `delivery` (absorbs the publication
half of `publisher`, the upstream transports in `operations`, and the delivery-record consumers in
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
| `integrate(delivery)` | commit to the goal's work branch, push, open the pull request against the base branch, wait for CI and any configured review requirement, **request the merge from the provider and record the identity it returns**. Automatic for staging. Publication targets belong to the `release` contract; delivery reaches the branch the policy names and no further. |
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
| I4 | Staging integration is automatic once checks and CI pass. **The only human gates in the system are a production release, and a blocking question that needs an answer or an external action.** No gate exists for staging, CI, review, or anything an agent can observe and act on itself. |
| I5 | Upstream effects are observed, not assumed. An unknown outcome is resolved by inspecting provider state before retrying, and is never blindly replayed. It becomes a human gate only when the observation shows external action is genuinely required — a credential, a provider incident, an irreversible state — not merely because the outcome was uncertain. |
| I6 | The merge is performed by the **provider**, which returns the merge identity; delivery records that identity once and every other view derives from it. No local merge-and-push path, and no parallel milestone-receipt store for the same fact. |
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
| DE-4 | `integrate` opens one pull request for the goal, waits for CI, requests the merge from the provider once gates are satisfied, and records the identity the provider returns — with no human turn and no local merge-and-push of the base branch. |
| DE-5 | A push whose outcome is unknown is followed by a provider inspection; the retry is justified by the observed state, and no blind replay occurs. The uncertainty alone does not raise a human gate. |
| DE-5b | An observation showing genuinely required external action — a missing credential the run cannot obtain, an irreversible provider state — raises a blocking-question gate naming that action, and nothing else does. |
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

| Current | Target | Effect | Status |
| --- | --- | --- | --- |
| `publisher/live-publication` (208) and `simulation-publication` (179) | one publication route with a namespace refusal | removes the twin engines and the 44 live-versus-simulation branch points | done (#370) — one `publication.ts` engine with live/evidence providers |
| `publisher/promotion-review` (131), promotion assembly and resume paths | deleted with the promotion subsystem | the simulation-to-live handoff stops being a lifecycle stage | done (#367) — promotion subsystem deleted with no caller left |
| `publisher/publication-effects` (121) and the `lifecycle` external-effect intent store | `reconcile` observing provider state | removes the prepared/uncertain/completed ledger and its reconciliation code | not started — both remain; reconcile-by-observation is batch 5 |
| `coordination-store/delivery-store` triple status columns plus milestone receipts | one delivery entity in the project store | one recorded merge identity, derived views, no parallel ledgers (I6) | partly done (#371) — three status columns became one recorded `route` with derived views; the project-store move remains |
| `operations/simulated-pull-requests` (278), `simulated-releases` (115), `simulated-upstream` (100), `provider-store` | a simulation namespace over the same transport | removes a second fake-GitHub implementation while keeping the isolation invariant | done (#368, #372) — the change record derives from recorded effects and `provider-store.ts` is deleted |
| `arcnexus delivery approve/publish/promote` | retired per the gateway contract; gates answered through `task answer` | no operator command bypasses a human gate | partly done (#367) — `promote` and `publish` retired; `approve` is retained because `task answer` cannot yet record a delivery approval, recorded as a prerequisite |
| `publisher/delivery-checks` (236) and `delivery-verification` (147) | moved to `verification` as the single gate | publication stops re-verifying what was already accepted | partly done (#374) — capture reads the one recorded verdict instead of reconstructing a second proof; the move of both modules into `verification` remains |

Migration lands in cleanup batch 4 (one route) and is verified by DE-14 together with VI-14, EX-17,
CO-16 and DI-15.

## Non-goals

Cross-repository transactions, multi-branch release trains, deployment orchestration of external
services, package-registry publication beyond what the release contract declares, automatic
production merge under any configuration, and any recovery path for a historical failed delivery.

## Accepted decisions

1. **Merge mechanics:** the **provider** performs the merge and returns its identity; delivery
   records that identity and derives every view from it. No local merge-and-push path (I6, DE-4).
2. **Human gates:** only a production release, and a blocking question that needs an answer or an
   external action. Staging, CI and review are never gates. An uncertain upstream outcome is first an
   observation, and becomes a gate only when the observation shows external action is genuinely
   required (I4, I5, DE-5, DE-5b).
3. **Publication scope today is the CLI.** Delivery reaches the branch the project policy names.
   Container image, connected runner, package-registry and installer publication are declared as
   reserved targets by the `release` contract — recorded direction, not implemented capability — so
   they shape the interface without adding machinery now.

## Lock record

```yaml
id: arcnexus/delivery
stage: locked
revision: 4
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 4: migration status updated for step 4e (#374) — publication reads the one recorded
    verdict, so no second goal assessment remains; the delivery-checks and delivery-verification
    move into `verification` is still open. Targets and invariants unchanged.
  - revision 3: migration table gains a Status column recording what implementation has actually
    delivered against this contract, dated by pull request and verified by file existence rather
    than by assumption — one publication route with live and evidence providers (#370), promotion
    deleted (#367), the simulated twins and the provider receipt store retired with the change
    record derived from effects (#368, #372), and the delivery-store status columns collapsed into
    one recorded merge identity (#371). Rows still marked not started remain the plan; the
    `delivery approve` row records why it cannot retire yet. No invariant, scenario or target was
    altered — operational status only, at the architect's direction.
  - revision 2: locked with the architect's answers — the provider performs the merge and returns its
    identity; the only human gates are a production release and a blocking question needing an
    answer or external action, so an uncertain upstream outcome is reconciled by observation before
    it can become a gate (new I4, I5, I6, DE-4, DE-5, DE-5b); publication scope today is the CLI,
    with container, runner, registry and installer targets reserved as declared direction in the
    release contract
  - revision 1: proposed in #359 with three open questions, all since answered
```
