# Library contract — Coordination

Type contract: `library`. Stage: **proposed**. Owner: `coordination` (absorbs
`coordination-store` and `report`).
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-architecture-model.md`](arcnexus-architecture-model.md).
Depended on by: `direction`, `execution`, `verification`, `delivery`, `report` consumers, the
gateway, and every read command.

Coordination is durable memory: what a goal is, where it stands, what was decided, what was
observed, and what is owed to whom. It is the only place run state lives. Everything it does not
store either lives in Git (code revisions) or is derived on read (reports).

## Identity

| Field | Value |
| --- | --- |
| component | `coordination` |
| paths | `src/library/coordination`, `tests/library/coordination`, `docs/library/coordination` |
| storage | one SQLite file per project in application storage, keyed by verified repository identity |
| current cost | 7 databases (~20 tables), 3 lock-only databases, ~10 JSON/JSONL mirrors of the same facts, 101 distinct state literals, 4,288 lines in 39 recovery files |
| target cost | 1 database (entities + events), 18 state literals, no recovery subsystem |

## Provides

| Service | Obligation |
| --- | --- |
| `open(project)` | one store handle per project with a single writer; a second writer is refused, not queued |
| `put(kind, id, data, expectedVersion)` | transactional entity write with optimistic versioning; a stale writer fails instead of merging; identical content for an id is idempotent |
| `append(event)` / `events(after, limit)` | append-only ordered journal of transitions, used for reporting and audit — never to repair state |
| `position(goalId)` | current milestone and Step, plus the owner cursor reserved for the workday seam |
| `gates` | open question records with the answer stored as evidence; replaces the `needs_input` outcome and its clarification machinery |
| `requests` | a link from one milestone to existing accepted work, with owner and acceptance preserved; replaces the dependency graph |
| `evidence(put/get/list)` | artefacts by id with digest, size and kind; bounded range reads; retention honours the stated policy |
| `measures(goalId)` | counters recorded, never inferred: wall time, model turns, added and removed lines, net change in stores/states/owners/subsystems, failures and blocks with cause |
| `report(query)` | derived views computed on read: status, plan, evidence index, diagnostics. No report is stored |
| `planRender(goalId)` | the deterministic committed record of a plan: milestones, acceptance, checklists, status and measures, written only by the runtime lane |

Entity kinds are exactly: `goal`, `milestone`, `step`, `execution`, `gate`, `request`,
`evidence`, `measure`, `delivery`. Anything else is a property of one of these, not a new table.

## State vocabulary

| Record | Allowed values |
| --- | --- |
| goal | `active` \| `closed` \| `failed` \| `cancelled` |
| milestone | `planned` \| `active` \| `prepared` \| `verified` \| `delivered` \| `failed` \| `cancelled` |
| step | `pending` \| `done` \| `failed` \| `not-applicable` |
| gate | `open` \| `answered` \| `withdrawn` |
| request | `open` \| `linked` \| `satisfied` \| `rejected` |

Eighteen literals in total. There is no `pausing`, `paused`, `stopping`, `idle`,
`needs_attention`, `needs_input`, `interrupted`, `uncertain`, `settled`, `retained`, `prepared
contribution`, `ready-clock`, or per-store milestone enum. A value with no transition in the
current path is deleted, not deprecated (I8).

## Must never do

Schedule or dispatch work, decide authority, run commands, call a model, hold code revisions or
diffs (Git owns those), maintain a second projection of a fact it already stores, repair another
run's state, or keep a store alive because some historical record needs reading. Old runs stay
readable as data.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | One store per project. No second database holds any part of the same fact. |
| I2 | One authoritative write per fact; every other view is derived on read. |
| I3 | Events are append-only and are never used to reconstruct or repair state. |
| I4 | Entity writes are version-checked; concurrent stale writes fail rather than merge. |
| I5 | A terminal transition is recorded exactly once; cancellation cannot produce two outcomes. |
| I6 | Ids are stable; derived artefact ids are content-addressed. |
| I7 | Evidence is bounded by size and retention policy; reports reference ids, never inline artefacts. |
| I8 | No state value exists without a reader in the current path. |
| I9 | The plan record has one writer: the runtime lane. Stewards never edit it directly. |
| I10 | Code revisions live only in Git; the store holds ids and digests, never copies. |
| I11 | Live and simulation share one schema. Isolation is a namespace plus a refusal, never a second store or a second publication engine. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| CO-1 | A fresh project creates exactly one database file; no other store appears for the same project. |
| CO-2 | A second writer opening the same project store is refused with the active goal id, and no queue row is created. |
| CO-3 | `put` with a stale `expectedVersion` fails and leaves the entity unchanged. |
| CO-4 | Re-`put` of identical content for the same id is idempotent: one row, one event. |
| CO-5 | Every status literal in the store's vocabulary is reachable by at least one transition and consumed by at least one reader; an unused literal fails this scenario. |
| CO-6 | A cancelled run records one terminal event and one terminal entity state; reports show one outcome. |
| CO-7 | `report` output is computed from entities and events; deleting every derived artefact and re-reading produces the same result. |
| CO-8 | No stored record duplicates a Git fact: changing the branch head does not stale any stored revision field, because none exists beyond ids and digests. |
| CO-9 | A gate opened by a human-only step is answered through `task answer`; the answer is evidence and the run resumes from `position`, with no replay of an uncertain operation. |
| CO-10 | A request that names existing accepted work links to it and preserves owner and acceptance; it creates no duplicate milestone. |
| CO-11 | Evidence reads honour `offset` and `length` and never return more than the stated cap; oversized artefacts are refused at write time with their size reported. |
| CO-12 | Measures are recorded per milestone; a milestone closed without measures is a validation finding, not a silent zero. |
| CO-13 | `planRender` is deterministic: the same store state produces byte-identical plan output, so plan changes review as diffs. |
| CO-14 | A simulated run writes into the simulation namespace only; any attempt to write a live record from it is refused. |
| CO-15 | Reopening the store after an abrupt process exit yields the last committed state with no repair step, no reconciliation pass and no operator action. |
| CO-16 | Deleting the recovery modules leaves no caller: no code path references a state it existed to rescue. |

## Migration

| Current | Target | Effect |
| --- | --- | --- |
| `execution`, `deliveries`, `lifecycle`, `portfolio`, `provider`, `workday` databases + `container.lease`, `host.lease`, `evidence-retention.lease` | one project store; the single-writer lock is the store's own write lock | 7 databases and 3 lock files → 1 |
| `report.json`, `timeline.jsonl`, `events.jsonl`, `activities.jsonl`, `checkpoint.json`, `receipt.json`, `host.json`, per-command evidence projections | entities + events + derived reports | removes the 3–4× mirror writes and the reconciliation code that existed to align them |
| 101 state literals across 12 enums | 18 literals on 5 record kinds | removes the states that required 4,288 lines of recovery, retained-host, promotion-resume and lease reclamation |
| `coordination-store` (2,881 lines) + `report` (2,570 lines) | `coordination`, target ~1,400–1,800 lines | one owner for durable memory and its views |
| delivery milestone receipts and external-effect ledgers | one `delivery` entity with the recorded merge identity | removes the four-place "merged at head X" projection that produced the current publication defect class |
| candidate pointers, contribution groups, assignment replacements, direction admission, required work | milestone, request and delivery entities | removes admission, retirement and cycle-detection machinery that a single sequential lane makes unreachable |

Migration lands with cleanup batches 1 and 2 (one store, one process) and is verified by CO-1,
CO-15 and CO-16 together: fewer stores, no repair path, no orphaned states.

## Non-goals

Scheduling, fairness, queues, priority, concurrency control beyond one writer, cross-project or
cross-repository transactions, event sourcing as the state model, analytics or dashboards,
backup and archival policy beyond a stated retention cap, and any capability whose only purpose
is reading historical configuration versions.

## Open questions for the architect

1. **Plan authority.** I propose the store is authoritative and `.arc/plans/<goal>.md` is a
   deterministic render the runtime commits, so PRs still show reasoning and there is no second
   source of truth. The alternative is the file being authoritative, which reintroduces two
   writers over one fact. Which do you want?
2. **Evidence retention.** A concrete cap per goal with automatic removal of regenerable caches
   only — authored evidence, diffs and verdicts never deleted — or retain everything and accept
   the disk growth the last nine days demonstrated?
3. **Entities plus events, or events only?** I propose entities for current state and events for
   history, because reporting needs both and neither alone is honest. Confirm before locking.

## Lock record

```yaml
id: arcnexus/coordination
stage: proposed
revision: 1
acceptedBy: null
acceptedAt: null
changes: null
```
