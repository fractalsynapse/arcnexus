---
id: release-snapshot
priority: 330
---

# Prepare production scope from a pinned verified staging snapshot

Preserve the proposed release-preparation outcome for exact contract review before adoption. Use the previous production release's recorded source staging commit as the exclusive range boundary and a verified descendant as the inclusive boundary. Missing ancestry or required verification produces a named hold.

Derive complete included scope from staging history, preserving merge order, issue links, acceptance evidence and unresolved attribution. Include every change in the range, including tested merge resolutions.

Pin source boundary, selected snapshot and scope when preparing a candidate. New eligible snapshots cannot silently replace it. Explicit replacement creates a new identity and refreshes affected review and approval. Production authorization remains separate.

## Success measures

- Squash history uses retained staging-source identity rather than inferred production ancestry.
- Prepared candidates remain stable when newer staging becomes eligible.
- Preview and explicit replacement expose actual scope changes.
- Unlinked commits and partially accepted work remain visible.
