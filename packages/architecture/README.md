# Architecture application

Architecture resolves immutable project captures and the shared request builder.
Its [locked contract](contract.md), especially ARC-12, ARC-15 and ARC-20–22,
governs the standalone Architect phase described here. This guide records intended
behavior before implementation; it does not establish runtime availability.

## Assessment

The transport-neutral application capability serves both bare
`arcnexus architecture update` and `arcnexus architecture update "<feedback>"`.
Feedback focuses assessment and remains recorded input; it grants no authority.
The [Commands SDK](../commands/contract.md) exposes structured progress and outcomes.
The [CLI gateway](../../apps/cli/contract.md) owns argument parsing, terminal
interaction and the existing general `--json` convention. Inspection,
`task plan` and `task run` retain their standalone behavior.

Select the captured project's explicit architect component and activity through
[Agent](../agent/contract.md) and its shared Architecture request builder. Do not
substitute a default activity or activate an unavailable handler. A missing
architect binding makes updating unavailable without disabling inspection.

Assessment reads approved objectives and goals, captured architecture, current
implementation and relevant retained execution findings and Reviewer lessons.
Cite sources by path and revision or retained evidence identity so the reader can
inspect the basis of the decision. Return either a justified source-linked
no-change assessment at the captured revision or one exact reviewable proposal.
Research is optional. Reuse complete clarification and research answers through
the existing inbox and journal rather than asking them again after interruption.

## Proposal and human decision

Keep proposals separate from accepted authority under ARC-15. Persist one proposal
with its identity, purpose, architectural intent, consequences, prerequisite
implementation outcomes, baseline identity and exact batch of paths and intended
bytes. Each entry identifies original and final content digests, including
explicit absence for creation or deletion. Bind the proposal identity to all
reviewed content, not only its file diff.

Before asking for approval, include any required contract registry amendment in
the same batch. Follow the [registry procedure](../../docs/interface/README.md):
preserve contract stages, accepted identities, acceptance reason and prior digest
and path history; compute new digests from the intended bytes. Never generate
additional protected edits after approval.

Reuse [Planner's approval behavior](../planner/contract.md) and the existing
Clarifications path. Present the exact proposal, intent and baseline together.
Record the human decision in trusted Coordination evidence and bind it to that
proposal. A delegation must explicitly authorize the trusted host to apply the
reviewed batch on the issue-linked task branch.

| Decision or discrepancy | Required behavior |
| --- | --- |
| Missing or unknown answer | Retain the exact pending proposal and decision position; never infer approval. |
| Decline | Retain the decision and leave existing source and authority intact. |
| Exact recorded approval | Permit only the host validation and application described below. |
| Forged, candidate-authored or mismatched approval | Refuse application and preserve the failed observation. |
| Changed intent, intended bytes or baseline | Reconcile the discrepancy and return one revised proposal for renewed review. |
| Implementation correction within approved intent | Use ordinary repair without another human gate. |

## Trusted application

ARC-21 permits a narrowly scoped host-only application capability. It is absent
from model tools. Model checked edits continue refusing locked contracts and the
registry, even when a proposal is approved or candidate-side records claim it is.

The host verifies the trusted recorded human decision, exact proposal identity,
intent and baseline, authorized task branch, and every original and final digest
for the complete batch before applying it. It refuses extra paths, altered bytes,
stale originals and candidate-side authorization. Validate the entire batch before
mutation; retain application observations so restart can reconcile an interrupted
application against the approved originals and finals instead of blindly replaying
writes. A mismatch cannot silently rebase protected edits or grant broader authority.

Application changes source for the candidate, never the active capture. Existing
tasks keep their original permissions, operations, checks, acceptance and trusted
composition. A later task captures the accepted delivery afresh. Validation must
refuse activation of unavailable operations or handlers even after human approval.

## Writer, prerequisites and recovery

Use the existing [Coordination](../coordination/contract.md) database and journal.
The foreground phase retains its project writer across sequential ordinary task
sessions through `Journal.child`, delivered in #630. Consume the existing
[Execution admission boundary](../execution/contract.md) rather than recreating
writer ownership, a lock store, scheduler or orchestration engine. Completing a
child cannot release the live parent's writer; competing admission remains refused.

[Workflow](../workflow/contract.md), especially WFL-8, owns prerequisite execution
and combined delivery. Required implementation and supplier contributions use its
ordinary Director, scoped steward, independent Verification and Delivery lifecycle
inside Architect. Direction sequences distinct supplier work. Approved architecture
and required implementation form the assembled candidate for validation, independent
review and staging delivery. Do not start a competing nested admission or publish
the architecture separately from its required implementation.

Resume the same phase and proposal at the first unfinished position. Retain complete
answers, optional research, completed child outcomes, original issue, branch, PR and
checkpoint identities, successful edit receipts and failed evidence. Reconcile
uncertain application or publication against observed effects before retrying.
Reuse completed outcomes and accepted delivery rather than duplicating work or PRs.
Changed architectural intent returns one revised proposal; routine corrections
remain with the earliest affected applicable activity.

## Public regression obligations

Before behavioral implementation, retain observed failing public regressions for
ARCAPP-1–4 using isolated fixtures. Cover explicit architect selection and assessment
inputs, source-linked no change, exact proposal content, complete inbox recovery,
and interruption/resumption of the same pending proposal.

Exercise exact, declined, missing, unknown, forged, stale and mismatched decisions;
altered intent or bytes; changed original or final digests; protected checked-edit
refusal; candidate-side authorization attempts; and immutable active capture.
Changed baseline must produce reconciliation and renewed review. Workflow lifecycle
evidence additionally covers shared-writer prerequisites and suppliers, combined
validation and delivery, uncertain publication, no duplicate delivery and a fresh
capture after accepted changes.

These are intended observations, not a claim of passing implementation or live
qualification. Implementing this already-approved capability does not edit current
objectives/goals, active architecture declarations, locked contracts or the registry.
Future guide proposals pass through the reviewed application boundary above.
