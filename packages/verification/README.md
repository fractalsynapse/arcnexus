# Verification quality evidence

This records V-1/V-2 regression intent for `quality-verification`, after the
`quality-execution` supplier contribution. It implements
[VI-1, VI-3, VI-5, VI-6, VI-9, VI-12, VI-14, VI-17 and VI-18](contract.md#acceptance-scenarios).
The locked contract remains authoritative. This document establishes neither
implemented regression coverage nor assembled acceptance or delivery.

## Authority and supplier evidence

The exact approved batch is identified in
[Architecture's application input](../architecture/README.md#exact-approved-application-input):
proposal `303689eed95a3874ed0da695718d9280ec3e88328d87ada30268dbec40984a64`
against baseline `dfa59ad5c14665d02c1780d6dc060d198784283a`.
Only the trusted host applies its protected bytes. The active capture remains
immutable; subsequent work captures the accepted delivery.

Consume these contributions through their public boundaries rather than copying
their selectors, inventories, availability rules or cache implementation:

- `quality-identity-boundary`: the
  [Architecture supplier answer](../architecture/quality-identity-boundary.md)
  separates selection identity from reusable observation provenance. It records
  bootstrap assistance without autonomous qualification credit.
- `quality-foundation` and `quality-architecture`:
  [Foundation selection](../../docs/foundation/quality.md#discovery-and-selection-boundary)
  and [Architecture operation validation](../architecture/README.md#owner-scoped-quality-operations)
  define operation-specific applicability and pre-activation availability.
  Static availability never establishes successful execution.
- Completed `quality-foundation-selection`:
  [explicit candidate-root selection](../../docs/foundation/quality.md#explicit-candidate-root-selection)
  and [90-22-owner-tests.log](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/90-22-owner-tests.log)
  retain FS-1/FS-2 evidence (160 passes). Selection uses the candidate root even
  when the process or command cwd differs.
- `foundation-quality-reuse-eligibility`:
  [the eligibility boundary](../../docs/foundation/quality.md#selection-reuse-eligibility),
  [96-102-owner-tests.log](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/96-102-owner-tests.log)
  (178 passes), and [96-105-codex.jsonl](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/96-105-codex.jsonl)
  retain the final local supplier evidence. Supported static dependencies permit
  scoped reuse; uncertain dependency coverage requires a fresh observation.
- `quality-execution`: [Execution intent](../execution/docs/quality-evidence.md),
  [96-181-owner-tests.log](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/96-181-owner-tests.log),
  [96-182-owner-tests.log](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/96-182-owner-tests.log), and
  [96-185-codex.jsonl](/home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/8e8abf1c5eb4ef14ecd9dc22b25de62d96d8d65067bc35510f0b36ccc83d2485/96-185-codex.jsonl)
  retain the prediction-correction failure, subsequent result (141 passes,
  six skips), and final local assessment. The completed contribution is
  engineering evidence for the later assembled assessment.

These observations have distinct candidates and scopes. Their counts do not
constitute a current Verification result. Native cases were disabled or
Bubblewrap namespace creation was unavailable, including the nested-cwd case.
Actual confined execution remains an evidence gap; controlled composed results
cannot discharge it.

## Actual assembled evidence shape

VI-12 requires public regressions to consume the records produced by the real
host assembly, rather than an alternate fixture with stronger fields.

[HostTask.check](../execution/src/index.ts) journals
`{ check, scope, checkInput }`; a reused observation additionally records
`reusedFrom` pointing to its retained log. `scope` carries owner, activity and
expected pass/fail. The actual
[CheckResult](../execution/src/check.ts) carries operation `id`, numeric exit
status, `null` or `'not-applicable'`, optional reason, command, args, cwd,
duration, log and optional selection. A format/lint selection carries operation,
optional owner, sorted repository-relative files, identity and
`reuseEligibility: { eligible, reason? }`. A selection receipt alone is neither
a passing observation nor complete authorization/environment provenance.

[Owner review assembly](../execution/src/review-observations.ts) returns
`{ scope, check, afterLastEdit, candidate?, operation? }`.
The optional candidate contains tree and base; the operation is the captured
declaration. Currently those two fields attach only to observations after the
last checked edit when a clean candidate and operation are available.
The owner-review projection does not carry the journal's `checkInput` or
`reusedFrom`. Its chronology flag alone cannot prove input-matched scoped reuse.
A new host reuse observation can retain the original log while appearing after
the edit; retaining that original log is valid when current inputs match.
Do not invent a provenance field or equate an earlier timestamp with staleness.

[Reviewer assembly](../reviewer/src/index.ts) supplies
`assignment.ownerChecks` alongside candidate digest, owner-evidence digest and
assembled checks, captured milestones/acceptance and complete retained evidence
references. [Verification](src/native.ts) obtains assembled results through
`HostTask.check`; [verdict validation](src/index.ts) checks candidate and criterion
identity. Public regressions must exercise this assembly boundary and detect
missing information in it, without a second owner-check pass to manufacture
the evidence that should already exist.

## Required regression observations

V-1 requires separate evidence for every captured applicable operation. Derive
obligations from captured declarations, never a Verification-owned inventory.
Testing may retain declared expected-red owner tests while other applicable
operations require pass; Implementation requires current passing observations.
Completed expected-red Testing is retained without reproducing red against the
implemented candidate.

| Public scenario | Required observation |
| --- | --- |
| Missing or unrelated evidence | An omitted obligation, empty reply, another operation's pass, another owner's result or another activity's result cannot satisfy the required operation. |
| Unavailable or incomplete evidence | Null/unavailable, skipped, interrupted, missing-log or unresolved required evidence leaves acceptance unavailable or unaccepted with the precise reason; capability inspection cannot substitute for execution. |
| Independent inapplicability | Current empty format and lint selections each retain their own operation, owner, activity, scope, selection inputs and reason. JSON-only inputs can require format while lint is empty. Suite absence affects only owner tests; shared types/build remain independent. |
| Stale observation | Changed relevant source bytes with unchanged paths, new/deleted inputs, discovery/ignore/configuration dependencies, ownership, authority, command/cwd, expectation, tool or environment require affected evidence to be refreshed. A former empty selection requires current discovery. |
| Valid scoped reuse | Known unchanged relevant inputs after an unrelated owner or generated-output edit can reuse a satisfied observation through the existing host cache. Preserve its log reference; do not reject solely because the original result predates that edit. |
| Ineligible reuse | Foundation ineligibility requires fresh observation. It grants neither successful inapplicability nor permission to omit the operation. A fresh passing result can satisfy the current obligation without promising future reuse. |
| Expected red and correction | Deliberately expected-red owner tests satisfy Testing's declared expectation. An accidental expected-fail prediction that passes is corrected through a fresh expected-pass observation with the original retained; required-pass obligations cannot be weakened. |
| Independent verdict identity | A changed full candidate invalidates its previous verdict even when scoped observations remain reusable. Matching captured acceptance, checks and environment remain necessary; reject unknown or incomplete criteria and preserve reviewer identity/profile, evidence and input digest. |

V-2 also requires ordinary operation failures to return exact diagnostics and log
references to the same accountable activity through Workflow (VI-17). Preserve
edit receipts, complete answers, failed observations and unaffected evidence.
Only distinct ownership work uses supplier routing; only valid final independent
rejection returns failed criteria through Direction. Malformed review citations
return to the same Reviewer with the candidate and applicable evidence retained.

## Assembled acceptance and delivery limits

VI-1 and VI-14 retain one assembled checklist and one independent candidate-bound
assessment. All five assembled requirements remain mandatory:
`repository-build`, `repository-types`, `repository-format`,
`repository-lint` and `repository-tests`. Owner-scoped evidence and valid
owner-operation inapplicability cannot discharge any assembled requirement.
A missing required result never becomes a pass; required unavailable results
retain their reason under VI-3.

Verification regression work adds no intervening engineering verification pass,
new evidence store, selector, handler, fixer or authority. The host alone performs
assembled verification and delivery, including required CI, required PR review
and observed staging integration. Main and production remain separate.
Execution-path changes restart live qualification; retained local observations
do not establish a live qualification streak.
