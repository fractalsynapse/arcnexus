# Manager plugin contract

Stage: **proposed**. The [registry](../../docs/interface/registry.yaml) records its status.

Manager owns agent directives and bundled guidance. Its public service supplies
directive and skill inputs to [Architecture](../architecture/contract.md)
when project authority is captured.

| Operation | Contract |
| --- | --- |
| `guidanceFor(source, scope)` | Resolve applicable project directives, skill metadata and referenced files from the supplied source revision for the requested scope. Return their identities and contents in a deterministic order. |
| `validateGuidance(source)` | Report missing references and invalid or conflicting metadata. Return findings to Architecture for the shared catalog validation result. |

Architecture owns the capture and model-facing request. Manager supplies
guidance through that capture. Later directive edits become inputs to a future
capture and cannot change an active agent's instructions, operations or acceptance.
The Manager service does not schedule, activate or review agents.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| MGR-1 | The same revision and scope resolve the same guidance. Different scopes receive their applicable directives and skill references. |
| MGR-2 | Invalid metadata or a missing skill reference is reported by the shared validation path. |
| MGR-3 | Editing directives after admission leaves the active Agent view unchanged. A later capture can see the newly approved guidance. |
