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
capture. Approved guidance can reach the next activation through Architecture's
recorded in-run model adoption boundary; it cannot rewrite an in-flight agent's
instructions, grant candidate-side authority or weaken original acceptance.
The Manager service does not schedule, activate or review agents.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| MGR-1 | The same revision and scope resolve the same guidance. Different scopes receive their applicable directives and skill references. |
| MGR-2 | Invalid metadata or a missing skill reference is reported by the shared validation path. |
| MGR-3 | Unapproved directive edits cannot change the Agent view. After approved model adoption, the next activation receives the updated guidance; in-flight activations and historical evidence retain their original identity and original acceptance is preserved. |
