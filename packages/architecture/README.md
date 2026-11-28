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

## Complete ownership diagnostics

Implementation intent for `validateCapture`: Architecture maintainers and admission
callers must be able to identify every ownership defect in a captured inventory
from one refusal. This correction implements the existing locked
[Architecture obligations](contract.md#acceptance-scenarios), especially ARC-3
(path coverage), ARC-4 (conflicting component IDs), ARC-7 (capture stability),
ARC-16 (deterministic findings) and ARC-23 (unambiguous ownership).
The [project contract](../../docs/interface/arcnexus-project.md#obligations)
requires exactly one owner for each tracked maintained path.

The public input is a `Capture`: its component definitions supply declared owned
roots, and `capture.source.paths` supplies the captured maintained inventory.
Use [Team's public service](../team/src/index.ts) to obtain the complete captured
roster and its coverage results. Preserve Team's ownership decisions rather than
introducing another root matcher, fallback owner or authored ownership map.
The [Team contract](../team/contract.md#team) remains proposed; its roster,
resource lookup and coverage views describe the shared boundary.

At this intent stage, `validateCapture` already requests Team coverage but throws
on the first finding, reporting only its kind and path. The intended correction
must retain every uncovered-path and collision finding in the ownership refusal.
Each uncovered resource names its path; each collision names its path and all
conflicting component IDs. Multiple defective paths must remain visible together,
including when both kinds occur in the same inventory. Ownership validation must
use the full captured roster: a component, activity or eligibility filter used to
select a steward cannot conceal another owner's claim or turn a collision into
unique ownership. A uniquely owned inventory passes the ownership portion of
validation and proceeds to the existing activity and binding validation.

For unchanged captured inputs, repeated validation must produce identical
ownership diagnostics. Preserve deterministic inventory and component ordering
without sorting or otherwise mutating captured definitions or source paths in
place. Eligibility can affect whether a steward is available; it cannot change
the captured ownership decision. Supplier selection continues through Team and
Direction under locked
[DI-20](../direction/contract.md#acceptance-scenarios).
A supplier request grants no edit capability, as also required by locked
[EX-3](../execution/contract.md#acceptance-scenarios).

A caller uses the complete refusal to locate the responsible declarations and
resources. Correct ownership declarations through the approved architecture
route, then validate a fresh capture; a diagnostic cannot grant authority or
change the existing snapshot. This ordinary documentation records the diagnostic
correction before behavior changes. It does not amend a lock or adopt new
architectural authority.

Public regressions must exercise `validateCapture` through Architecture's public
entry with realistic Capture data: a uniquely owned inventory, multiple uncovered
paths, multiple collisions with every conflicting ID, and a mixed invalid
inventory. Retain an intended failing assertion for omitted owners and subsequent
findings before implementation. Repeated calls must compare complete diagnostics
and establish that captured inputs remain unchanged. Preserve Team's existing
filtering, ordering and repeated-lookup coverage. Current passing regressions and
applicable Architecture quality evidence belong to later engineering activities;
assembled independent assessment and delivery remain host responsibilities.

## Working-tree ownership audit

Accepted implementation intent for `ownership-audit-service`: expose a read-only
audit through [Architecture's public entry](src/index.ts) for callers inspecting
candidate ownership before adoption. The service is available as
`new Architecture().checkOwnership(directory)`. It extends the ownership diagnostics above under the
existing locked ARC-3, ARC-4 and ARC-16 obligations; it does not change the
committed-source or authority boundaries of ARC-7 and ARC-8.

The input is a directory within a Git working tree, including a nested directory.
Resolve its repository root and canonical repository identity. Read the component
catalog from that working tree, including modified declarations and newly added
component definitions. The audited inventory is the union of Git index-tracked
paths and nonignored untracked paths, relative to the repository root. Staged
additions therefore participate before a commit exists; ignored untracked files
do not. Tracked paths remain part of the index inventory even if their working
files are absent. Do not substitute HEAD's tree or walk every filesystem entry.

Preserve literal Git paths, including whitespace, newlines and pathspec
metacharacters. A nested caller must receive the same repository-relative
inventory and ownership findings as a caller at the root. The result identifies
the resolved repository and the working-tree source of the declarations and
inventory, keeping any committed revision identity distinct from those mutable
inputs. It must not present candidate bytes as a committed snapshot or accepted
authority.

Use `Team.list` without eligibility or activity filtering and
`Team.validateCoverage` through [Team's public entry](../team/src/index.ts).
Refactor the existing ownership diagnostic responsibility for direct reuse by
capture validation and the audit. Keep the ownership rules and diagnostic
formatting canonical rather than implementing another matcher or copying the
validation loop. Return all uncovered paths and all collisions, with every
conflicting component ID, in deterministic path and component order. A covered
inventory has no ownership findings. A malformed catalog or unreadable Git
project is an explicit source error rather than a successful empty audit.

Auditing reads candidate data without admitting a task, activating a provider,
writing source or the Git index, committing, contacting upstream, or adopting
architecture. `openProject` and `Architecture.capture` continue to read fixed
committed objects; an existing capture remains immutable when working-tree
declarations change. A successful candidate audit cannot grant edit authority,
unlock a contract or update the active Team. Correct a reported declaration
through the approved architecture route, or correct an owned candidate resource,
then audit the changed inputs again. Adoption still follows the contract's
recorded host boundary.

Public regression evidence must use real temporary Git repositories through the
Architecture public boundary. Distinguish a modified working-tree declaration
from HEAD, include staged additions and nonignored untracked paths, exclude
ignored untracked paths, and compare root and nested invocations. Include literal
unusual filenames, multiple uncovered paths and collisions with all owner IDs;
repeat unchanged inputs to establish complete deterministic output. Observe source
and index state before and after auditing to establish the absence of writes.
Retain separate regressions for immutable captures and `openProject` committed
reads. Testing records the intended behavioral failure before implementation;
later implementation obtains applicable passing owner evidence.

Commands and CLI consume this service through their separately accountable
contributions. Their protected interface changes require their own exact review;
this intent supplies neither terminal policy nor foreign contract bytes. Execution
separately enforces the approved updating activity's completion verification.
Those prerequisites and the candidate-built command must be validated before
recorded adoption; an installed host command does not demonstrate delivery.
Independent assembled verification and staging delivery remain host responsibilities.

### Implementation ledger (#762)

The Architecture steward's `ownership-audit-service` contribution adds
`Architecture.checkOwnership(directory): OwnershipAudit`. The public result holds
`source: { kind: 'working-tree', root, remote, revision }`, sorted `paths` and
complete `findings`. Here `revision` identifies HEAD for reference; it does not
identify the mutable declaration bytes. Unowned findings contain `kind` and
`path`; collisions also contain every conflicting component ID in `owners`.
The public `ownershipDiagnostic(findings)` renders the complete refusal for
consumers needing text.

The owned implementation changes are in `src/index.ts`, `src/working-tree.ts`,
`src/ownership.ts`, `src/catalog.ts`, `src/source.ts` and `src/validation.ts`.
The earlier documentation and Testing contributions supply the intent and real-Git
regressions. Checked-edit receipts retain each preimage and resulting owned diff.

The simplification replaces capture validation's inline Team coverage and message
loop with shared structured findings and one renderer. Candidate inspection reuses
the same catalog mapping reader, definition loader, canonical remote validation
and local read-only Git invocation. It introduces no second ownership matcher,
component roster, capture type, lock loader or task execution path. Committed
capture still loads fixed Git objects and verifies its existing locks.

The public regressions retain separate assertions for candidate declaration
changes, literal inventory, nested invocation, all collision IDs, no writes and
committed-source preservation. Commands, CLI and completion enforcement remain
the subsequent accepted contributions; independent assessment, runtime adoption
and staging delivery remain host obligations.

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
