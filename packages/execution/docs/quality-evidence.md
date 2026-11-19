# Owner quality obligations and evidence

This records intended behavior for `quality-execution` (E-1 through E-4), before
its behavioral changes. It implements [Execution EX-10, EX-22 and EX-23](../contract.md#acceptance-scenarios)
and [Foundation FND-9 and FND-10](../../foundation/contract.md#acceptance-scenarios).
It does not establish implemented behavior, passing observations or delivery.

The authority is the approved architecture batch
`303689eed95a3874ed0da695718d9280ec3e88328d87ada30268dbec40984a64`
against baseline `dfa59ad5c14665d02c1780d6dc060d198784283a`, retained as
`62-1-approved-architecture.json` in the task evidence. The
[quality identity supplier answer](../../architecture/quality-identity-boundary.md)
(QI-1/QI-2) supplies the division of responsibilities below; it is recorded
bootstrap assistance, without autonomous qualification credit.
[Foundation quality intent](../../../docs/foundation/quality.md) defines selection
and its bounded identity coverage. Architecture validates declared applicability
and implementation availability through Foundation's public boundary before
activation (ARC-13 and ARC-22). Static availability is not execution evidence.

## Each operation has its own obligation

The existing steward and `HostTask.check` path must expose the captured check
obligations for the selected owner and activity and reconcile every obligation
before progression, including checks omitted from a completed reply. Use the
captured declarations by category and applicability rather than a second inventory.
Candidate edits cannot add authority, remove obligations or weaken expectations.

| Captured operation | Applicability | Testing evidence | Implementation evidence |
| --- | --- | --- | --- |
| `owner-format` | Foundation's `format:check` selection for the captured owner | Passing, or current operation-specific empty-selection evidence | Passing, or current operation-specific empty-selection evidence |
| `owner-lint` | Foundation's `lint` selection for the captured owner | Passing, or current operation-specific empty-selection evidence | Passing, or current operation-specific empty-selection evidence |
| `owner-tests` | Existing owner suite inventory | Deliberately declared expected-red or passing tests; suite absence recorded separately | Passing tests, or current suite-absence evidence |
| `repository-types` and `repository-build` | Their configured shared project inputs | Passing independently of owner suite presence | Passing independently of owner suite presence |

Testing's deliberate expected-red declaration applies to owner tests, not to
formatting, lint or shared types/build. Retain the actual failing observation and
its expectation as satisfied red evidence. Implementation consumes that completed
Testing evidence without reproducing red against the implemented candidate, then
requires current passing applicable observations. An accidental expected-fail
prediction that passes must be corrected to expected pass through the same tool,
with a current passing recheck and the original observation retained. Never weaken
a required-pass obligation to make a failure acceptable.

An empty completed response, an unrelated passing check or another operation's
inapplicability cannot satisfy an obligation. Missing, stale, unavailable,
interrupted or skipped required evidence prevents progression for that operation.
A known handler, successful capability inspection or model assertion cannot stand
in for its actual result. Suite absence affects only owner tests.

## Captured ownership and selection parity

Before discovery, invocation and reuse, validate current component IDs and owned
roots against the captured ownership projection. Reject drift, unknown or explicitly
empty owners, unowned applicable paths and collisions with the exact affected owner
or paths. These are failures, never successful empty selections. A candidate catalog
cannot expand scope. Resolve resources through Team's public ownership boundary.

Consume Foundation's public `selectQualityInputs` through its public entry.
Applicability and the confined command must use its same maintained-file discovery,
operation, owner, cwd, coverage, configuration and ignores. Include newly
checked-created maintained files; exclude generated, ignored and deleted inputs.
Keep owner-test discovery separate and unchanged.

Foundation supplies deterministic repository-relative selected paths, operation,
owner and selection identity. If invocation recomputes selection, establish
matching current inputs and compare its receipt with applicability. A change
between selection and invocation requires refusal, reselection or another
observation; it cannot silently execute a different scope. Preserve existing
read-only tool flags and configurations. Fixers remain separate, within captured
write authority.

Empty format and lint selections each require their own evidence identifying
operation, owner, activity, scope, selection inputs and precise reason
(`no applicable maintained files` for that operation). An owner with JSON-only
inputs can require format while lint is empty; code without suites can require
lint, format and shared types/build. Unavailable discovery, configuration or tools
cannot be recast as empty selection.

## Observation binding and reuse

Use the existing host journal and check-input boundary. A Foundation scope receipt
is the selection part of an observation, not its complete reusable fingerprint.
Its additional content/configuration hashing is bounded, as documented by
Foundation; neither that digest nor selected-content hashing proves authority,
expectation, discovery completeness or environment.

For each observation, retain operation and captured declaration, owner, activity,
expectation, selected scope and applicability reason where relevant. Bind:

- Current selected source bytes and presence, plus discovery inputs capable of
  adding or removing files, including new files and formerly empty selections.
- Captured ownership and its current validation; resolved executable, arguments
  and cwd; operation authority and selector/runner implementation.
- Coverage, ignores, relevant configuration and dependencies, package/lock and
  toolchain inputs. Shared types/build bind their project inputs independently
  of owner format/lint scope.
- Runtime, installed dependencies, tool identity and confinement/environment inputs.

Reuse requires a satisfied observation for the same operation and expectation with
matching relevant inputs and environment. Revalidate current discovery even for a
formerly empty selection. Changes to selected contents without path changes,
configuration dependencies, ignores, ownership, command authority, toolchain,
expectation or environment invalidate affected evidence. Known unchanged relevant
inputs permit scoped reuse after unrelated-owner edits or generated-output changes.
When relevance is unknown, decline reuse and observe again; this fallback does not
replace demonstrating reuse for known unchanged relevant inputs.

The existing [revision cache](../src/check-cache.ts) binds a clean revision,
operation, scope and environment. Revision-only binding over-invalidates unrelated
commits; its dirty-state guard can prevent reuse for ignored build/dependency
outputs. Removing that guard without current-input binding would allow stale
evidence. The QI answer also identifies chronology-based review freshness as
insufficient for scoped reuse. These are implementation gaps to resolve through
the existing evidence path, not claims that the current cache satisfies E-4.

## Failure, repair and cancellation

An actual confined command retains command, cwd, exit, duration, exact diagnostics
and immutable log reference (EX-10), with the scope and input identities above.
Record whether evidence comes from actual confined invocation or controlled
simulation. A simulated collaborator cannot establish real confinement or command
execution; unavailable actual confinement evidence remains an outstanding
requirement.

Real lint length and type failures must return to the same accountable caller,
including owners with no suites. Preserve exact logs and failed observations when
a later invocation passes. Ordinary repair follows EX-22 within the same milestone;
self-review selects the earliest affected applicable documentation, testing or
implementation activity. Retain successful edit receipts, complete clarification
and research answers and unaffected evidence. Cross-owner contributions go through
Direction without granting foreign edit scope. A repeated diagnostic without
changed inputs follows the existing no-progress hold rather than endless retries.

Cancellation stops managed descendants and records one terminal outcome (EX-8).
After preserving edits and evidence, remove the task-owned worktree; restart
reconciles its checkpoint and resumes the retained cursor (EX-17). Interruption,
handoff and ordinary correction preserve exact diagnostics, complete answers and
failed observations. Reuse still requires current matching inputs.

## Evidence needed for the next activities

E-1/E-2 require public regressions for captured/worktree ownership drift,
collisions, unknown owners, applicability/command parity, independent empty
selections, expected-red Testing followed by passing Implementation, and omitted
obligations or empty replies. E-3 requires real lint-length and type failures for
an owner without suites, same-caller diagnostics and inability to hide failure
with unrelated evidence.

E-4 requires composed consumer regressions for changed source with unchanged
paths, new/deleted inputs, changed coverage/ignore/configuration dependencies,
tool/environment/expectation changes and known unchanged relevant inputs after
unrelated edits. Preserve confinement, cancellation, receipts and no-progress
characterization. Use actual confined-command evidence separately from simulation;
do not duplicate Foundation's selection engine or treat fixture passes as delivery.

The exact protected batch is applied only by the trusted host. Active captured
authority remains unchanged. All five assembled checks (`repository-build`,
`repository-types`, `repository-format`, `repository-lint`, `repository-tests`),
one independent candidate-bound assessment, required CI/review and observed staging
delivery remain mandatory under ARC-22. Main and production remain separate.
Execution-path changes restart live qualification; this document claims no
qualification rounds or delivery.
