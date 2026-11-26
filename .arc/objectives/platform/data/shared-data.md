---
id: "shared-data"
---

# Expose domain models consistently across adapters

Expose domain resources through shared typed registrations that define identity, scope, schemas, supported operations and caller permissions. Keep each resource's validation, storage and revision rules behind its public service. Reject duplicate model registrations and declared operations without handlers.

Use the same schemas and domain rules across REST, MCP and applicable CLI operations. Enforce expected revisions atomically so concurrent stale writes fail explicitly. Unsupported and unauthorized operations remain unavailable. Reads must not create databases, workflow executions or journal records.

Preserve append-only journal semantics and the existing approval and delivery path for guide changes. Isolated implementation and verification do not authorize real-project gateway activation.

## Observable success

- Equivalent adapter requests produce equivalent typed results and errors.
- Concurrent writes against one revision admit one change and reject stale updates.
- Duplicate registrations, missing handlers and out-of-project access fail explicitly.
- Read-only calls leave persistent state unchanged.