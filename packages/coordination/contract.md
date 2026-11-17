# Coordination plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Own one SQLite store per verified repository, one active goal and one writer.
Persist the plan, position, gate answers, requests, escalation, attribution,
outcomes and evidence references. A goal id is the digest of its full text.
A round and inventory entry identify a fresh logical task; attempts share that
task identity. Retain issue and checkpoint identities and the last committed
activity position in the same journal.
Transactional writes reject stale versions and are idempotent for identical content.
Events are append-only observations. Git owns revisions, and reports are derived
from retained records.

The runtime persists structured agent-authored plan content. The committed plan is
a deterministic render. The store and external application artifacts remain the
durable evidence. Retain authored evidence, including failed or unavailable checks,
and expose artifacts by identity with bounded range reads. The first build applies
no automatic per-goal cache threshold. Record one terminal outcome and retain the
last committed position for restart inspection. Observe an uncertain upstream effect
before attempting it again.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| CO-1 | A fresh project creates exactly one database file; no other store appears for the same project. |
| CO-2 | A second writer opening the same project store is refused with the active goal id, and no queue row is created. |
| CO-3 | `put` with a stale `expectedVersion` fails and leaves the entity unchanged. |
| CO-4 | Re-`put` of identical content for the same id is idempotent: one row, one event. |
| CO-5 | Every status literal in the store's vocabulary is reachable by at least one transition and consumed by at least one reader; an unused literal fails this scenario. |
| CO-6 | A cancelled run records one terminal event and one terminal entity state; reports show one outcome. |
| CO-7 | `report` output is computed from entities and events; deleting every derived artefact and re-reading produces the same result. |
| CO-8 | No stored record duplicates a Git fact: changing the branch head does not stale any stored revision field, because none exists beyond ids and digests. |
| CO-9 | A foreground human answer is evidence against the open gate. Continue from the recorded position without replaying an uncertain operation. |
| CO-10 | A request that names existing accepted work links to it and preserves owner and acceptance; it creates no duplicate milestone. |
| CO-11 | Evidence reads honor offset and length and never inline an unbounded artifact. |
| CO-12 | Measures are recorded per milestone; a milestone closed without measures is a validation finding, not a silent zero. |
| CO-13 | `planRender` is deterministic: the same store state produces byte-identical plan output, so plan changes review as diffs. |
| CO-15 | Reopening the store after an abrupt process exit yields the last committed position. Resume reconciles uncertain provider effects before replaying an activity, without operator repair. |
| CO-16 | A normal observation of retained task position is sufficient to diagnose an interruption. No alternate recovery workflow is required. |
| CO-17 | The same goal text always resolves to the same goal id, and a single-character change produces a different id; a 4,000-character goal still resolves to one digest and one plan file. |
| CO-18 | A hand-edited committed plan is reproduced away by the next render, and a render that disagrees with store state is reported rather than trusted. |
| CO-20 | An escalation is stored as an `escalation` entity carrying its reason, goal identity, plan revision, open steps and evidence references; it reads as one owner waiting on another, is replayable as a directive input, and resolving it closes the entity without rewriting the goal or its acceptance. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

CO-14, CO-19
