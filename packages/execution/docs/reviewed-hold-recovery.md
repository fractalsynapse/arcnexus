# Retained context for holds after independent rejection

This implementation-intent note serves Execution maintainers and Workflow
consumers working on [#699](https://github.com/fractalsynapse/arcnexus/issues/699).
It records the intended evidence boundary for `hold-context-complete` and
`hold-progress-grounded` before behavioral changes. Execution now exposes the public hold context through its steward result.
Workflow routing, assembled independent review and delivery remain later milestones.

The governing obligations are the [Execution contract](../contract.md#obligations),
especially EX-11, EX-17 and EX-22, and
[Direction's revision boundary](../../direction/contract.md#obligations), DI-7 and
DI-21. [Workflow](../../workflow/contract.md) owns recovery routing and ordered
execution. Execution supplies observed effects and recoverable identity; it does
not revise plans, decide independent acceptance or publish final delivery.

## Context a consumer must receive

When correction following independent rejection reaches a steward hold, Execution
must expose host-attested context through its existing public boundary. Workflow
must be able to pass the complete relevant observation to Direction without
reconstructing it from model prose. Preserve these responsibilities together:

| Context                    | Required observation                                                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Origin                     | The exact independent rejection, finding, criterion identity and original acceptance, linked to the held milestone and activity. A later diagnostic supplements rather than replaces the originating finding.                                                                                                     |
| Current failure            | The exact diagnostic and operation identity. For a check, retain the original expected result, actual exit or other observed status, command, arguments, working directory and complete log. A missing exit or log is explicitly unavailable; a prerequisite failure does not imply that the requested check ran. |
| Checked effects            | Successful checked-edit receipts with path and before/after digests, their secured checkpoint association, and any exact refusal. A later refused file does not undo earlier acknowledged files.                                                                                                                  |
| Task continuity            | The existing task and issue, branch, engineering base, captured authority, secured checkpoint and current recorded position. Preserve completed outcomes, pending checks and their expectations, and unaffected evidence.                                                                                         |
| Knowledge                  | Complete recorded clarification, research and supplier answers with their caller and evidence identities. Continuation can read their full content, including deciding conditions, without asking again.                                                                                                          |
| Progress and prerequisites | The relevant checked inputs and diagnostic observations used to compare holds, plus actual prerequisite observations and any pending decision gate. Preserve the evidence supporting the comparison and the required next action.                                                                                 |

Use the canonical Coordination journal and retained artifacts. Complete raw logs,
answers and receipts may remain outside source with durable readable references;
an index entry is not a substitute for making its target readable through mapped
file access. Preserve historical failed observations after a later result passes.
Do not invent a parallel recovery database or copy bulk transcripts into source.

The engineering base defines the candidate's relationship to staging. Captured
authority defines allowed work. A secured checkpoint protects acknowledged bytes.
The assembled candidate and verification checkout identify what checks and the
independent verdict actually assess. None of these identities substitutes for
another, and a checkpoint push establishes durable progress rather than acceptance.

## Reuse existing observations

The current [steward path](../src/steward.ts) returns host-generated check failures
and response-repair holds. Its check path retains operation identity, expectation,
exit and log; its reply repair records the exact validation diagnostic.
[Check results](../src/check.ts) additionally identify the actual invocation and
observed prerequisite failures. Extend the public recovery context by retaining
these observations, including a hold with no numeric check result, rather than
decoding a second model-authored failure format.

[HostTask](../src/index.ts) already exposes task identity, retained observations,
pending checks and checkpoint/worktree recovery. Its existing checked effects and
the [checkpoint lifecycle](../src/checkpoint.ts) supply secured receipt provenance.
[Correction finding selection](../src/correction.ts) and
[activity progress](../src/steward-progress.ts) preserve originating findings and
current versus historical completion. Retain these associations through correction
and restart; do not infer that a completed activity satisfies an unresolved goal.

[Steward check and reply inputs](../src/steward-check.ts) already compare checked
file state and completed caller knowledge. The
[caller recovery intent](caller-recovery.md) explains why a genuinely new complete
answer can change the caller's available inputs while duplicate answers and
unrelated artifacts cannot. Reuse this journal-backed path and the existing
[retained evidence index](../src/context-evidence.ts), strengthening relevance
where required rather than introducing another retry mechanism.

## Progress and genuine gates

Compare the same unresolved criterion and finding using relevant host-observed
inputs and actual diagnostic content. A checked correction that changes relevant
bytes, a newly completed relevant answer, or a check exposing a distinct defect
can justify further correction. Retain the before/after observation that explains
that decision. An edit unrelated to the finding does not establish progress.
Different transcript filenames, temporary directories, artifact allocation,
replayed answers and rephrased model claims do not make an equivalent hold new.

Keep the exact original diagnostics readable even when comparison normalizes
incidental paths. Neither a changed evidence reference nor a fresh invocation of
an unchanged failing check establishes progress. Healthy successive corrections
continue without an attempt count, timeout, work budget or profile substitution.
When a correction returns an equivalent hold without relevant progress, preserve
the unresolved criterion, exact diagnostic, evidence, position and required next
action so Workflow can stop automatic repetition before another correction.

A model's claim that a prerequisite is unavailable is not host attestation.
Investigate through authorized operations and retain the actual refusal, check
prerequisite failure or recorded human gate. A genuine human decision names the
decision and required authority; an external prerequisite names the unavailable
resource or effect and the action needed to supply it. Preserve the task while
dependent work waits. Resume only after the relevant satisfaction is observed:
elapsed time, another artifact or an optimistic model statement cannot satisfy a
gate or grant additional authority.

Ordinary repair remains with its caller or an applicable local rewind. This
post-rejection context enables Workflow's explicit Direction revision route.
Direction may sequence smaller runnable contributions for an oversized correction;
each retains its captured owner, link to the original finding and criterion, and
secured effects before its successor. Execution supplies evidence at each boundary
without prescribing the plan. Their assembled candidate still needs assessment
against original acceptance. Held or stopped work is never accepted or delivered;
final publication belongs to [Delivery](../../delivery/contract.md).

## Canonical retained-log comparison for Workflow

The supplier milestone `expose-canonical-check-failure-signature` supports
Workflow's `correct-reviewed-hold-restart` correction of the original
`reviewed-hold-progress-stop` criterion. Its accepted public-boundary criteria
are `canonical-check-signature-public` and
`canonical-check-signature-evidence`. Reuse the completed
`retain-reviewed-hold-context` contribution and its evidence; this contribution
does not reopen that work or replace the original recovery acceptance.

The intended public boundary is `checkFailureSignature(log: string): string`,
exported from [Execution's public entry](../src/index.ts). Workflow's public
import is intended to be
`import { checkFailureSignature } from '../../execution/src/index.js';`.
At this documentation stage the entry does not yet export it. Implementation
must re-export the existing [canonical function](../src/steward-check.ts),
without a second comparator or changes to its semantics. Consumers must not
import the private implementation, as required by the
[project contract](../../../docs/interface/arcnexus-project.md#obligations).

Here, `log` is the retained log-file **path**, not diagnostic text. The function
synchronously reads that file as UTF-8. It selects TAP `not ok` lines,
TypeScript error lines and lines beginning with optional whitespace followed by
`error:`, `Error:` or `FAIL` at a word boundary. When those lines exist,
it combines them with matching two-space-indented `error:` blocks and their
four-space-indented or blank continuation lines; otherwise it uses the complete
log text.

It then removes incidental TAP numbering, parenthesized numeric source
locations, absolute path prefixes through `worktree/` or
`measure-worktree/`, and colon-separated line/column locations. Matching
`/tmp/` names become `/tmp/<temporary>`. After trimming surrounding whitespace,
it returns the SHA-256 hexadecimal digest of the normalized content. These
normalizations define comparison identity; they do not rewrite or replace the
retained original log. Recognized failure lines take precedence over unrelated
transcript text, while logs without recognized failure lines retain their
ordinary content for comparison. This is a comparison of selected diagnostics,
not a claim that every byte difference denotes a different failure.

File-read failures propagate to the caller. The function does not substitute an
empty signature, manufacture diagnostic fields, decide check success or attest
that a prerequisite is satisfied. Callers retain exact diagnostic, operation,
exit and readable log evidence alongside the signature.

Public-boundary evidence must invoke the exported function with actual retained
log files. Equivalent failures differing in incidental TAP numbering and matching
transient paths must yield the same signature. Genuinely different ordinary
failure content must yield different signatures, including the complete-text
fallback when no recognized failure line exists. Preserve read-error propagation.
These are required observations for the later Testing and Implementation
activities, not results established by this documentation edit.

The supplier answer must identify the actual public import, preserved semantics,
secured implementation receipt and applicable evidence so Workflow can replace
its private import and refresh its affected observations. It must preserve the
same issue, checkpoint, complete answers, original rejection, acceptance and
cursor. Check scope and expectations, host prerequisite observation and captured
authority stay governed by their existing boundaries. Only subsequent assembled
checks and independent review can establish the original recovery acceptance.

## Evidence required for the behavior

Testing must exercise the public Execution boundary with a real retained journal,
committed fixtures, distinguishable rejection findings, actual check observations,
checked receipts and complete answers. A controlled Agent can establish this
deterministic boundary without waiting for the Workflow consumer implementation.
The regression must expose missing context before implementation and then show:

- Verbatim diagnostic, original expectation, actual exit and readable complete log,
  or checked-edit receipt/refusal evidence, remain linked to the originating
  rejection, criterion, secured bytes and task identity after continuation.
- Equivalent failures with different log paths remain unchanged repetition;
  relevant checked corrections and new complete answers remain distinguishable
  from unrelated edits, duplicate answers and model progress claims.
- An observed unavailable prerequisite and a pending human decision retain their
  evidence and position; neither is reported satisfied without the corresponding
  host observation.

Workflow's later assembled scenarios must consume the actual Execution context
and demonstrate Direction correction, sequential contributions, explicit stops,
prerequisite continuation and fresh independent assessment against the original
acceptance. Deterministic coverage does not establish native confinement, live
provider behavior, hosted CI, required PR review or staging delivery. Those
observations remain separately attributable; this intent note claims none of them.

## Implemented public boundary

The public entry exports `HoldContext` and `StewardOutcome`. A host-generated
blocked steward result following recorded independent rejection carries
`holdContext` and a readable immutable `steward-hold.json` artifact. The
projection uses retained journal observations across attempts. It includes the
complete originating rejection, original milestone criteria, current position,
exact failure and actual check when available, deduplicated edit receipts with
their checkpoint associations, complete caller clarifications, research
references and supplier replies.

Progress identity combines committed bytes for paths explicitly named by the
accepted finding/work or observed check selection, normalized diagnostic content,
and completed caller knowledge. It omits transient log paths, provider claims
and unrelated edits. The existing caller-repair path uses net relevant checked
changes for post-rejection check failures; restoring the previous bytes does not
renew an unchanged hold. Refused replies use the same relevant secured-input
comparison. Unnamed dependencies are not inferred as relevant progress.

Only a typed host check prerequisite or a recorded unanswered clarification can
populate the prerequisite projection. Ordinary command stderr remains exact
diagnostic evidence. A dependency-preparation failure preserves its actual
command and log and states that the requested check did not run; it never counts
as a satisfied prerequisite or as the requested check passing.

The deterministic integration regression uses the public types with real
committed Git fixtures, SQLite continuation, checked-edit receipts and subprocess
observations. It covers equivalent failures, unrelated changes, net reverted
corrections, relevant corrections, dependency prerequisites, ownership refusal and
an actual unanswered human clarification continued after restart. The human gate
retains its exact question and evidence until a complete answer is recorded.
The command confinement, provider and remote transport are controlled seams;
these observations establish neither native confinement nor live inference.
Workflow's task-level gate/resume and independent recovery scenarios remain its
assembled contribution.
