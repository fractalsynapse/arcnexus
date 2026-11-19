# Quality selection and evidence identity

This is the architectural answer for supplier milestone `quality-identity-boundary`,
requested by `quality-foundation`. It records explicit bootstrap-supervisor
assistance, not autonomous qualification evidence. It interprets existing accepted
intent; it changes no contract, protected guide batch, registry, acceptance or
authority.

## Authority and conclusion

The [approved architecture artifact](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/62-1-approved-architecture.json)
(proposal `303689eed95a3874ed0da695718d9280ec3e88328d87ada30268dbec40984a64`,
baseline `dfa59ad5c14665d02c1780d6dc060d198784283a`) requires common
maintained-file selection, captured ownership, matching applicability and command
execution, and input-matched evidence reuse. Its implementation outcomes 1, 2 and
5 divide tooling from host enforcement. They do not require Foundation to implement
a general transitive configuration dependency analyser.

The [accepted plan](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/74-91-accepted-plan.json)
leaves F-1/F-2/F-3 and E-1/E-4 unchanged. F-3 requires discovery to expose
“sufficient scope and input identity for matching applicability and command
execution.” E-1 requires evidence of operation, owner, activity, scope and relevant
inputs; E-4 requires matching source/discovery, ownership, operation authority,
tool/configuration, expectation and environment inputs for reuse.
[Foundation obligations](../foundation/contract.md) require command parity,
coverage and read-only checks; [Execution EX-23](../execution/contract.md) requires
applicable checks independently of suite presence.
[Verification VI-18](../verification/contract.md) explicitly permits scoped
observation reuse after unrelated edits when declared relevant inputs match.

A Foundation receipt binding operation, optional owner and deterministic selected
paths is sufficient as the **selection part** of this design, provided Execution
establishes the remaining current-input evidence and validates captured ownership.
That receipt alone is insufficient as a reusable check fingerprint. Combining it
with the **current unmodified** revision-only host cache does not finish E-4:
that cache has the limitations described below. Acceptance cannot be discharged
by moving the gap from one component to the other.

The editable [quality intent](../../docs/foundation/quality.md#discovery-and-selection-boundary)
asks the public result to expose discovery/content/configuration identities.
Read that as the combined consumer requirement: relevant identities must be
available to the host, either in the result or established by its existing
evidence boundary. It does not confer new authority or require two independent
dependency engines. Foundation may simplify this editable explanation to make
that division explicit within its scope. A change to the actual approved outcomes
would require escalation; this interpretation needs none.

## Inputs at each boundary

Foundation owns selection semantics. Its public selection and existing npm
commands must use one discovery path, current maintained files including newly
checked-created and untracked files, existing coverage/configuration and applicable
ignores. Generated, ignored and deleted paths must stay excluded. Use public Team
ownership resolution; reject unknown or explicitly empty owners, unowned
applicable paths and collisions instead of returning an empty success.
No-owner invocation retains repository-wide coverage and strictness. Owner tests
retain their existing inventory.

The selection receipt must unambiguously identify the operation, optional owner
and exact repository-relative files, deterministically ordered. An identity over
these fields is a scope identity. It need not change when file contents change
without changing selection. If a receipt also exposes a content/configuration
identity, its documented coverage must be honest and separately identifiable;
consumers must not infer complete check provenance from a scope digest.

Execution owns authorization and observation binding. Before selection, execution
and reuse, it must establish that current component IDs and ownership roots match
the captured projection. Passing the owner's name is insufficient. Candidate
ownership drift cannot authorize broader selection; invalid ownership is a
failure, never inapplicability. The approved minimal approach validates the
worktree projection then lets Foundation resolve that validated catalog through
Team. Any change between selection and command invocation must cause refusal,
reselection or a new observation rather than reuse of an old applicability result.

The confined command must execute the same selection used for applicability.
A fresh invocation may recompute selection through the same public function,
provided the host establishes matching selection inputs and checks the receipt.
A different cwd, changed catalog/configuration or newly created maintained file
cannot silently change the executed scope. An empty format selection and an empty
lint selection each need their own operation, owner, scope and precise reason.
No test suites discharges only owner-tests. Applicable shared types/build remain
independent. An unavailable selector/tool is not an empty selection.

For an actual observation or reuse decision, the existing host evidence boundary
must establish:

- Relevant selected source contents, presence/deletion, and discovery state capable
  of adding or removing inputs, including newly created maintained files.
- Captured component IDs/ownership roots and their validation against current
  selection; operation declaration, executable, arguments, cwd and activity.
- Coverage and ignore rules, applicable formatter/linter configuration and its
  relevant dependencies, selector/runner implementation, toolchain/package and
  lock inputs. Types/build use their configured project inputs; these are not
  limited to the acting owner's format or lint files.
- Expected pass or deliberate expected-red owner tests, and the actual confinement,
  runtime, installed dependencies and tool/environment identity.

The host must retain those identities with command, cwd, exit, diagnostics and
immutable log reference. Reuse requires a satisfied observation for the same
operation and expectation with matching inputs/environment. Revalidate current
discovery even for a formerly empty selection. A source-only digest cannot detect
a new file or changed ignore rule. Preserve failed observations, receipts and
complete answers. Testing may retain deliberate expected-red owner tests with
passing other applicable operations; Implementation requires passing applicable
operations. One success cannot satisfy another operation.

This is a division of responsibilities, not a mandate for a particular new API,
store or dependency resolver. Known relevant inputs can use the existing host
journal/fingerprint machinery and public selection. Where relevance cannot be
established, decline reuse and observe again; do not claim precise identity.
That fallback preserves safety but cannot replace demonstrating the scoped reuse
that E-4 and VI-18 require for known unchanged relevant inputs.

## Current implementation and limitations

[Foundation selection](../foundation/src/index.ts) currently combines selection,
a recursive local-import scanner and source/configuration hashing.
`selectionIdentity` records operation, owner, files and Team resolutions.
`qualityIdentity` adds file bytes and paths from `identityInputPaths`.
[The runner](../foundation/scripts/owner-quality.ts) uses that public selection,
prints its identity and a separate selected-content digest, and invokes existing
read-only tools. The runner and applicability must continue sharing selection;
neither digest is environment or authority evidence.

The current import scanner recognises relative static imports with a regular
expression and a short extension candidate list. It cannot establish all dynamic,
package, re-export or arbitrary configuration dependencies. Formatter configuration
collection uses conventional names along selected paths; it is not a proof of every
input loaded by the formatter. Hashing every component file over-invalidates scope
when unrelated activity/profile fields change. These mechanisms should not be
presented as a precise general transitive identity. Keeping selected source and
configuration evidence is necessary at the combined boundary; duplicating its
calculation in Foundation is optional.

[Execution checkInput](../execution/src/check-cache.ts) validates the confined
command, then requires `cleanRevision`. It binds HEAD, captured source revision,
operation ID/declaration, resolved args, relative cwd, owner/activity/expectation
and environment. The environment includes Node versions, kernel, confinement
settings, host executable metadata, Node/bwrap metadata and installed lock digest.

HEAD transitively binds committed repository source/configuration bytes, but is
broader than relevant input identity. Any unrelated commit invalidates a scoped
observation; a different commit with identical relevant bytes also invalidates it.
`git status --porcelain --untracked-files=all --ignored` disables identity on
any reported staged, unstaged, untracked **or ignored** state. Build output,
fixture output or an ignored dependency directory can therefore disable reuse.
Dirty state causes a fresh run, not stale reuse, but it cannot establish useful
matching-input reuse during ordinary task work. Removing that guard without
replacing it with actual input identity would admit stale evidence.

`reusableCheck` finds the latest matching input, checks numeric status against
expectation and requires the log path to exist. It does not reuse not-applicable
records and does not itself verify log contents; immutability relies on the
trusted evidence storage. Executable stat metadata and an installed-lock digest
are bounded environment evidence, not byte-by-byte verification of installed
dependencies or a complete machine identity.

[HostTask.check](../execution/src/index.ts) records or reuses this fingerprint
through the existing journal. [check.ts](../execution/src/check.ts) presently
implements only owner-test-suite inapplicability, not owner-format/lint selection
or ownership-projection validation. [steward.ts](../execution/src/steward.ts)
runs requested checks and reconciles existing pending failures; it does not yet
derive every required per-operation obligation before completion.
[Review observations](../execution/src/review-observations.ts) use position after
the last edit and candidate tree to mark freshness. That is conservative chronology,
not a replacement for operation-specific input matching; later integration must
not discard valid scoped reuse merely because an unrelated edit occurred.

## Regression interpretation and retained findings

The [retained findings](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/74-92-retained-evidence.json)
identify real coverage, ignore, new-file and provenance gaps, but repeatedly assign
the entire host fingerprint responsibility to Foundation. Preserve the behavioral
evidence while separating that responsibility. Repeated repairs are observations,
not new architectural authority.

| Evidence | Required claim and boundary |
| --- | --- |
| [owner-quality.test.ts](../foundation/tests/unit/owner-quality.test.ts) and [owner-quality-scope.test.ts](../foundation/tests/unit/owner-quality-scope.test.ts) | F-1/F-2/F-3: validated owner/arguments, distinct owners, new files, collision refusal, no-owner behavior, actual file diagnostics and source immutability. Keep these assertions. |
| [owner-quality-discovery.test.ts](../foundation/tests/unit/owner-quality-discovery.test.ts) | F-1/F-2/F-3: public selection, CommonJS coverage, original formatting coverage, generated/ignored exclusion, unowned-path failure and ESLint ignores. |
| [owner-quality-identity.test.ts](../foundation/tests/unit/owner-quality-identity.test.ts) | F-1/F-2/F-3: unchanged test inventory, separate empty selections, YAML/YML and configured JSX/TSX coverage. Source/config digest-change assertions support E-4 at the combined boundary, not an obligatory second fingerprint in Foundation. |
| [quality-ignore-scope.test.ts](../foundation/tests/unit/quality-ignore-scope.test.ts), [ancestor-ignore tests](../foundation/tests/unit/owner-quality-ancestor-ignore.test.ts), and ignore cases in [quality-identity-repair.test.ts](../foundation/tests/unit/quality-identity-repair.test.ts) and [quality-repair.test.ts](../foundation/tests/unit/quality-repair.test.ts) | F-1/F-2/F-3: anchoring, literal escapes, character classes, directory rules, accessible-parent restoration and excluded-ancestor handling affect actual selected files. These are necessary selection regressions even if host binding changes. |
| [quality-discovery-repair.test.ts](../foundation/tests/unit/quality-discovery-repair.test.ts) | Pruned traversal and reachable ignore read counts support one shared discovery rather than repeated scans. Exact fs/glob call counts are implementation evidence, not independent locked acceptance. Preserve exclusion and shared-discovery behavior if the implementation changes. |
| Identity cases across the Foundation suites above | Selected-content, nested/imported config, editor settings, package/lock and selector/runner changes must invalidate affected evidence somewhere. Ignored/generated and unrelated-owner edits must not alone invalidate scoped evidence. These need E-4 consumer regressions if Foundation narrows its identity; they do not justify deleting outcome coverage. A comment-only ignore edit or absent/empty irrelevant .eslintignore distinction need not invalidate a scope-only receipt. |
| [check-cache.test.ts](../execution/tests/integration/check-cache.test.ts) | Characterises unchanged checkpoint/reconstruction reuse, changed checkpoint/dependency invalidation, dirty/legacy refusal, latest-failure precedence, confinement validation before reuse and cancellation. These are controlled journal/cache tests, not actual confined execution; they do not demonstrate relevant-input reuse across unrelated edits. |
| [steward-check.test.ts](../execution/tests/integration/steward-check.test.ts) and [review-observations.test.ts](../execution/tests/integration/review-observations.test.ts) | Characterise same-caller repair, observed-failure retention and review chronology/protected-write invalidation. They do not establish complete E-1/E-4 selection parity or current evidence for every mapped operation. |

The latest [transcript](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/74-89-codex.jsonl)
shows an accepted ignore-normalization edit followed by an unsuccessful observation
and a later refusal, “This activation has already requested a handoff.”
The [owner log](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/74-90-owner-tests.log)
reports 131 tests, 123 passes and eight failures: escaped-star and escaped-question
literal cases for both operations, plus negated character-class cases for both
operations in owner and repository modes. These assert actual inclusion/exclusion
and must be repaired in Foundation. Their removal would weaken F-2. The log
supports passing identity examples only within their fixtures; it does not prove
complete transitive dependency coverage, E-4 or actual confinement. Preserve the
accepted edit receipt and historical failures.

## Smallest compliant continuation

For pending `quality-foundation`, retain the public selection/command path,
read-only flags, owner-test inventory and behavioral regressions. Repair the eight
observed ignore-selection failures. Foundation may use an explicitly scoped receipt
instead of maintaining a general configuration-import identity engine, provided
the public consumer contract states its limits and exposes the selection facts
Execution needs. Existing digest functionality need not be removed just to resolve
this question; any simplification must preserve required behavioral coverage and
the evidence already obtained.

For accepted pending `quality-execution`, consume Foundation through its public
entry, validate captured ownership before discovery/execution/reuse, establish
selection parity and separate applicability reasons, and complete individual
operation obligations through existing HostTask/check/journal paths. Extend the
current reuse binding to actual relevant inputs with explicit unchanged/changed
cases, including dirty/new-file state and known unrelated edits. Retain authority,
expectation and environment dimensions. This is already E-1/E-4 work, not a new
supplier or permission grant.

Demonstrate the combined boundary with selected source and relevant config edits
that leave paths unchanged; new/deleted maintained files; ignore/coverage changes;
ownership drift/collisions/unknown owners; unchanged relevant inputs after unrelated
owner or generated-output edits; changed tool/environment/expectation; and parity
between applicability and actual confined command scope. Existing Foundation cases
can remain as extra characterization; host consumption tests must establish the
combined guarantees rather than assuming a Foundation digest is sufficient.

No peer-owned edits are prescribed or performed here. Architecture operation-model
support remains in `quality-architecture`; Verification consumes the actual evidence
shape in `quality-verification`. The exact approved 24-file batch remains host-only.
All five assembled requirements, the single independent candidate-bound verdict,
required CI/review and staging delivery remain unchanged under ARC-22. This answer
claims neither completed prerequisites nor assembled acceptance, integration,
production release or a live qualification streak.
