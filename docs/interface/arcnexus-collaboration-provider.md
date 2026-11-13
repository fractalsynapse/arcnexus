# Library contract — Collaboration provider

Type contract: `library`. Stage: **locked** (revision 3). Owner: `delivery` (absorbs the
upstream collaboration modules in `operations`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-delivery.md`](arcnexus-delivery.md), [`arcnexus-coordination.md`](arcnexus-coordination.md).
Depended on by: `delivery`, `direction`, the gateway, and every future forge or hosting integration.

This is the seam the architect asked to keep: the part of a run that talks to the outside world —
tracking issues, pull requests, comments, reviews and releases — is one interface with pluggable
providers. GitHub is the first real provider. **Simulation is not a fake GitHub; it is a provider
that keeps every interaction and publishes it as an evidence package instead of to a remote.**

## Providers

| Provider           | Upstream                                       | Artifacts                                                            | Selected by                             |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| `github`           | real repository, issues, PRs, checks, releases | remote state plus local evidence                                     | the project's delivery policy           |
| `evidence-package` | none                                           | every would-be upstream object captured as local, addressed evidence | `--simulate`, i.e. `mode: 'simulation'` |

Both providers run the **same lifecycle**: same plan, same milestones, same checked edits, same
workspace, same verification gate, same verdict, same measures. Only the destination of
collaboration differs. Nothing in the engine may branch on provider identity except to route
these four operations.

## Provides

| Service                    | Obligation                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `tracking(goal)`           | create or reuse the tracking issue; the evidence provider returns a local issue record with the same identity fields |
| `comment(target, body)`    | post a comment upstream, or append it to the evidence package with the same ordering                                 |
| `review(candidate)`        | open the pull request and observe provider CI and review state, or record the same observation as evidence           |
| `release(releaseIdentity)` | publish or record the release; the evidence provider records the intended release without claiming a remote state    |

## Invariants

| #   | Invariant                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | One engine, many providers. No second publication or collaboration implementation per environment.                                                                                                                                                                                                                                                                                 |
| I2  | A provider exposes the four operations above or it is not a provider. Provider-specific capabilities do not leak into the engine as flags.                                                                                                                                                                                                                                         |
| I3  | Simulation captures, it does not imitate. The evidence package holds the real issue text, real diff, real check results and real verdict — never a synthetic "success" shaped like GitHub. The package is the single home for those bytes: every other view references them by id and digest rather than copying them, so a captured fact cannot exist in two places and disagree. |
| I4  | An evidence-package run cannot reach a live upstream: no credential is resolved, no upstream client is constructed, no remote ref is written.                                                                                                                                                                                                                                      |
| I5  | Provider identity, the captured policy digest and the evidence package digest are recorded on every artifact, so a later reader can tell where an observation came from.                                                                                                                                                                                                           |
| I6  | `passed`, `failed`, `skipped`, `unavailable` and `not-applicable` mean the same thing under every provider. A provider never converts an unavailable check into a pass.                                                                                                                                                                                                            |
| I7  | Adding a forge is one provider implementation plus a delivery-policy entry — no engine change, no new state, no new status.                                                                                                                                                                                                                                                        |

## Acceptance scenarios

| Id   | Given / when / then                                                                                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CP-1 | A `github` run and an `evidence-package` run of the same goal produce identical milestone, checklist and verdict structure, differing only in provider identity and destination. |
| CP-2 | An evidence-package run performs no network call to any upstream and resolves no upstream credential.                                                                            |
| CP-3 | The evidence package contains the real tracking text, diff, check results and verdict, each addressed by digest and readable by id.                                              |
| CP-4 | A provider that cannot complete an operation reports `unavailable`; the run is blocked, never accepted.                                                                          |
| CP-5 | Comments and reviews keep their ordering and identity across both providers.                                                                                                     |
| CP-6 | Adding a third provider requires only the four operations and a policy entry; a scenario that needs an engine change fails CP-6.                                                 |
| CP-7 | Provider selection comes from captured policy or `--simulate`, never from an argument an agent supplies mid-run.                                                                 |

## Migration from what exists today

| Current                                                                                                                                              | Target                                                          | Effect                                                | Status                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `operations/simulated-pull-requests.ts` (278), `simulated-releases.ts` (115), `simulated-upstream.ts` (100) — a fake GitHub shaped like GitHub's API | `evidence-package` provider over the four operations            | deletes imitation; keeps the interaction record       | done (#368, #372) — the fake GitHub is deleted; capture lives in `evidence-package-upstream.ts` and `evidence-change-record.ts` |
| `coordination-store/provider-store.ts` (135) — simulated remote state database                                                                       | evidence artefacts in the project store and application storage | one fewer database                                    | done (#372) — the database is deleted; state derives from recorded effects and the evidence package                             |
| `publisher/simulation-publication.ts` (179) — a second publication engine                                                                            | one engine, provider-routed                                     | satisfies delivery I1                                 | done (#370) — one engine, provider-routed                                                                                       |
| `execution-runtime/simulation-repositories.ts` (167)                                                                                                 | retained                                                        | simulation still needs real local Git, just no remote | retained as designed — simulation still needs real local Git                                                                    |
| `--simulate`                                                                                                                                         | retained as the selector for the evidence-package provider      | see the gateway contract revision                     | delivered — gateway contract revision 3 keeps it as the provider selector                                                       |

## Non-goals

Simulating provider outages, latency or rate limits; synthetic approvals or fabricated CI
green; multi-forge parity features; and any provider that reports success for work it did not
observe.

## Lock record

```yaml
id: arcnexus/collaboration-provider
stage: locked
revision: 3
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-08
changes:
  - revision 2: the evidence package is named the single home for captured bytes, with every other view referencing them by id and digest.
  - revision 2: migration table gains a Status column: the fake GitHub, the provider state database
    and the second publication engine are recorded as deleted (#368, #370, #372) with capture now
    living in the evidence package and the derived change record, and `--simulate` is recorded as
    delivered by the gateway contract's revision 3. Targets and invariants unchanged.
  - revision 1: accepted by the architect as written, and made the governing seam for the
    batch-4c work: simulation becomes an evidence-package provider behind the same four
    operations rather than an imitation of GitHub, and future forges are provider
    implementations plus a delivery-policy entry
```
