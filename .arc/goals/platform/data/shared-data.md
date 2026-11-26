---
id: shared-data
priority: 210
---

# Expose domain models consistently across adapters

Expose domain resources through typed registrations defining identity, scope, schemas, supported operations and caller permissions. Keep validation, storage and revision rules behind each resource's public service. Reject duplicate registrations and declared operations without handlers.

Use the same schemas and domain semantics across REST, MCP and applicable CLI operations. Enforce expected revisions atomically so stale concurrent writes fail explicitly. Unsupported and unauthorized operations remain unavailable. Reads cannot create databases, workflow executions or journal records.

Preserve append-only journal semantics and the existing approval and delivery path for guide changes. Isolated verification does not authorize real-project gateway activation.

## Success measures

- Equivalent adapter requests produce equivalent typed results and errors.
- Concurrent writes against one revision accept one change and reject stale updates.
- Duplicate registrations, missing handlers and out-of-project access fail explicitly.
- Read-only calls leave persistent state unchanged.
