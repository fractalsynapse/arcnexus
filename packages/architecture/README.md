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
to subsequent work; the active capture remains immutable.

Implementation of this approved capability is bootstrap work in #631. Deterministic
checks, hosted CI and real phase acceptance are reported separately.

## Component index intent (#615)

Planned behavior for the efficiency work in #615 follows the
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
inspect/activation parity and Director/Reviewer access coverage. This section records
intent before behavioral edits; implementation and assembled acceptance remain to
be demonstrated through the normal workflow.
