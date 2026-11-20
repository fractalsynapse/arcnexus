# Architecture application

The [contract](contract.md) governs capture, request construction and the
Architect assessment. The application uses the existing Agent, HostTask,
Coordination journal, Clarifications and normal Workflow delivery. It introduces
no separate proposal store or simulated source adapter.

`architecture update` assesses accepted direction and retained findings. Feedback
focuses that assessment. A justified no-change result retains its source links.
A proposal records purpose, consequences, implementation outcomes, baseline and
exact file contents, including any registry digest amendment, before human review.
Approval binds those exact bytes and intent. Unknown approval remains pending;
changed proposals and baselines require renewed review.

After approval, Direction plans prerequisite implementation through the ordinary
steward lifecycle. The host applies the approved guide batch to that same candidate
before assembled verification and independent review. Model checked edits cannot
perform this protected application. A completed delivery supplies a fresh capture
to subsequent work. The approved efficiency amendment permits the host to adopt
resolved architecture between activities in the same run once the necessary
implementation is validated. Execution uses its existing workspace/checkpoint
boundaries for [validated adoption](../execution/docs/architecture-adoption.md);
an in-flight activation and historical observations retain their actual authority.

Follow the [efficiency checklist](../../docs/plans/efficiency-foundation.md) and
[prompt practices](docs/prompt-practices.md) for the model resolution, operation
parameter, activity instruction and observability changes. Here “model” means
resolved architecture; the execution profile separately selects an AI model.

Implementation of this approved capability is bootstrap work in #631. Deterministic
checks, hosted CI and real phase acceptance are reported separately.

Optional component research admits a model activity with no operations or only
mapped read/list tools. The same capability predicate governs the request context,
inbox and MCP request boundary. Command executors, unknown mappings and effectful
tools cannot enable research. Inspection and activation refuse an invalid research
activity before constructing its request. This aligns the runtime with the
already approved read-only tool declarations (#645); it adds no operation authority.

Prior-finding assessment references the complete recorded technical outcomes and
repairs in one readable artifact derived from the append-only journal.
Expected human decision pauses are preserved as gates, rather than classified
as technical failures. Referencing the artifact adds no scheduler or separate knowledge store.

## Component discovery (#615)

The source-linked index delivered through [PR #664](https://github.com/fractalsynapse/arcnexus/pull/664) follows the
[Architecture contract](contract.md#obligations), especially ARC-9 and ARC-10:
keep complete definitions in the immutable capture and build one source-attributed
request for inspection and activation.

The request's Team/component index identifies each other available component by
its stable component identity and canonical definition source reference. It includes
an optional `summary` only when explicitly authored on that component. Without a
summary, identity and source are sufficient for discovery. The index contains
neither another component's full expanded purpose nor its activity definitions.
Summaries are never inferred by truncating purposes. Existing definitions without
a summary remain valid; this behavior requires no active catalog migration.
The captured catalog remains the single source for
[Team](../team/contract.md#team), rather than introducing a second roster.

The acting component's full purpose and the selected activity's complete resolved
instructions remain in the request with their source attribution and normal task
placeholders. Explicitly long selected content is valid: this change introduces no
content budget, rejection threshold, truncation or paging protocol. Full component
definitions remain available through the normal mapped read operation; the compact
index does not replace that access.

[Agent inspection and activation](../agent/contract.md#public-interface) continue
to use Architecture's single request builder. Default rendered inspection and JSON
inspection describe the same request; JSON `request.input` equals the rendered
prompt under [CLI GW-25 and GW-26](../../apps/cli/contract.md#acceptance-scenarios).
Director and Reviewer retain their existing scoped access, including the Reviewer's
complete authorized evidence references. Codex continues to discover AGENTS.md and
skills normally; the request adds no duplicate guidance. Profiles, permissions,
operation mappings, approved architecture, ownership and accepted contracts remain
unchanged. [Commands](../commands/contract.md) remains transport-neutral, and CLI
arguments, output modes and exit behavior retain their existing contract.

Before implementation, a generic public regression must supply valid project,
component, role, profile, operation and source data independently of this repository.
Decode serialized rendered sections before asserting that the complete long acting
purpose and selected instructions survive with source attribution and task
placeholders. Assert that a different component with a long purpose has only its
identity, source and authored summary in the index, with no foreign purpose or
activity definitions, and that a component without a summary remains discoverable
by source. Retain the intended failing observation before implementation and current
passing owner evidence afterward, with candidate identity, actual exit statuses
and logs. Keep literal suite metadata aligned with path ownership and preserve
inspect/activation parity and Director/Reviewer access coverage. The live task
retained its intended red and passing results, repaired one caller response and
resumed after a controlled logging correction through one PR. Its staging merge
`1ebec5bd` passed the [Staging workflow](https://github.com/fractalsynapse/arcnexus/actions/runs/44660298873).
This establishes the index delivery, not the complete refinement qualification.
