# Direction

Direction turns a goal into an ordered sequence under the
[Direction contract](contract.md) and [plan template](../../.arc/architecture/plan-template.md).
The host retains the canonical accepted plan; its plan file is a reviewable render.

## Bounded revision intent

Status: approved intent for DI-21, recorded before behavioral implementation
for #615. This document does not establish runtime qualification.

Initial planning still returns a complete plan. Initial invalid-response repair
keeps its existing response boundary. An explicit activity escalation or final
independent rejection activates revision; ordinary operation failures and
same-owner repairs follow DI-7 without invoking the Director.

At revision activation, the read-only Director receives readable immutable
references to the exact previous accepted plan and full retained evidence,
including failed observations and complete answers. The activation identifies
completed milestones, completed Steps and the pending position, and supplies the
current relevant finding. A large completed plan prefix is available through
the retained reference rather than embedded in the inline prompt. The Director
can read that context without being asked to reproduce it.

The native revision response contains only the necessary pending sequence.
It does not regenerate the accepted Focus, completed milestones or completed
Steps. Direction reconstructs the candidate from the retained accepted plan and
the pending proposal, then validates it before use. The host preserves:

- The accepted Focus and captured authority.
- Stable owners for existing milestones and one accountable owner per milestone.
- Original acceptance criterion identities and descriptions, including those
  belonging to completed work.
- Completed milestones, completed Steps and their recorded outcomes and evidence.

A proposal cannot remove accepted obligations by omitting them from its pending
sequence. Invalid pending proposals leave the canonical accepted plan intact.
The exact validation finding returns to the same Director activity for repair;
it does not require resubmission or regeneration of the completed prefix.

Supplier escalation follows DI-5, DI-6 and DI-15: link already accepted work or
place distinct supplier work before its dependent. Preserve the requesting
milestone, its owner and acceptance, and link a complete supplier answer before
resumption when an answer is required. Final independent rejection supplies the
rejected criteria and retained evidence as the current finding. Corrections
preserve completed work and original acceptance through the same bounded
revision boundary.

Initial planning, revision and invalid-response repair continue through the
shared transport-neutral public task lifecycle. No adapter-specific task path,
second plan store or new authority source is introduced.

## Public revision boundary (BPR-1–3)

Status: intended Direction API for the distinct
`bounded-director-pending-reconstruction` contribution. The existing public
`direct(..., { plan, feedback })` and complete-plan decoder do not yet provide
this boundary. Prompt wording alone does not establish BPR-1 or BPR-2.

Workflow uses a `RevisionRequest` containing `acceptedPlan: string` and
`retainedEvidence: string` (readable immutable artifact paths),
`position: { completed: number; activities: Readonly<Record<string, number>> }`
and `finding: RevisionFeedback`. The position is committed host data:
`completed` counts the completed milestone prefix; each activity index is the
next Step in that milestone, defaulting to zero. It is never inferred from a
model reply. The finding carries the current supplier request or rejected
criteria and their evidence, including the requester when relevant.

The intended native signature remains
`direct(agent, session, signal, options): Promise<unknown>`; its options become
`{ revision?: RevisionRequest; feedback?: Feedback; standing?: StandingGoalEvidence }`.
The revision request replaces the inline `plan?: Plan` option. A revision
activation includes those two artifact references, the position and finding,
rather than the completed plan or bulk observations. Initial activation without
`revision` retains the existing complete-plan and standing-goal boundaries.
Repair feedback does not change which boundary is active.

The native host composition obtains one snapshot using Coordination's public
`revisionSnapshot(hostTask(session).observations())`, before allocating artifacts.
It stores the exact snapshot plan and observations as JSON using
`task.store('accepted-plan.json', ...)` and
`task.store('retained-evidence.json', ...)`. The complete Coordination answer
retained in `51-25-codex.jsonl` establishes this reuse: the snapshot uses the
latest accepted plan and committed position after the latest planner refresh,
and retains observations across attempts, including failed observations and
complete supplier answers. Referenced logs and transcripts remain readable.
Neither `task.history()` nor `task.evidence.slice()` substitutes for that full
observation set. These artifacts are immutable views, not another plan store.

Direction exposes
`decodeRevisionResponse(response: unknown, capture: Capture, accepted: Plan, request: RevisionRequest)`.
It returns `{ kind: 'plan'; plan: Plan }` with a reconstructed, validated full
candidate, or the existing `{ kind: 'question'; question: string; evidence: readonly string[] }`.
Invalid proposals throw `DirectorResponseError` with the exact diagnostic.
The trusted `accepted` argument is the host-retained plan matching the request's
artifact; a model-provided plan cannot replace that baseline.

The native wire response is `{ kind: 'plan', plan: { milestones: [...] } }`,
without Focus. Each proposed milestone carries its stable ID, owner, criteria
and only its pending Steps. Existing pending milestones must remain present;
their original criteria and owners must match exactly. Completed milestones are
omitted. For a partially completed requester, only the Steps from its committed
activity index onward are supplied. New supplier or correction milestones
provide all five Steps. A completed supplier is reused by its retained identity,
without asking the Director to reproduce it.

Reconstruction prepends the exact completed milestone prefix, restores the
accepted Focus, and prepends each existing milestone's completed Steps to its
proposed pending suffix. It preserves completed order and does not mutate the
accepted plan, request or response. Reject an invalid cursor, a supplied Focus,
repeated or completed milestone IDs, missing original pending milestones,
changed owners or criterion identities/descriptions, and missing, repeated or
out-of-order pending Steps. Do not silently discard attempted changes to
completed content. Run the existing captured-owner/activity, checklist,
engineering coverage and revision checks on the reconstructed candidate.
Supplier scheduling and rejected-criterion correction must also pass the
existing `scheduledSupplier` and `validateCorrection` rules before use.

Malformed field diagnostics identify the exact field path. Invariant diagnostics
identify the affected milestone, Step or criterion; preserve existing validation
messages when reusing their checks. The caller forwards the exact error message
as `plan-repair.diagnostic`, retains the original finding and the same revision
references/cursor, and retries the same Director activity. Failed proposals and
complete replies remain evidence. Only a validated candidate may replace the
accepted plan; no failure advances the committed cursor.

## Contribution evidence and remaining observations

Reuse the earlier Direction intent and `bounded-revision.test.ts` regressions.
The retained `50-4-owner-tests.log` records the pending-only decoding failure:
`plan.focus: expected object, received undefined`; the completed-acceptance,
completed-Step and initial-planning cases passed in that observation. These
results expose the missing boundary, not qualification of the new API.

BPR-3 adds public activation and reconstruction observations for a large
completed prefix, a partially completed requester with a supplier inserted ahead
of it, reuse of an already completed supplier with its complete answer, and final
rejection after all original milestones are complete. The last case retains the
entire original plan and appends fresh correction work for the original owner
and acceptance. Negative proposals must leave accepted inputs unchanged and
produce repair diagnostics without requesting the completed prefix again.
Initial complete-plan decoding and same-activity repair remain covered.

Before Workflow resumes `bounded-director-workflow-revision`, the complete
supplier answer must name the implemented exported types and signatures, the
pending wire shape, the reconstructed result and exact repair behavior, with
retained public regression evidence. This intended interface is not yet that
implementation answer.

## Required observations

Public regressions must demonstrate a large completed prefix remaining outside
the inline revision prompt while its exact plan and full evidence remain readable;
pending-only response decoding and reconstruction; and rejection of altered
completed acceptance without replacing accepted work. Supplier escalation and
final independent rejection must exercise that same boundary. Existing initial
planning and initial invalid-response repair behavior remain covered.

## Simplification ledger

- Remove the native inline \`plan?: Plan\` revision input, complete-plan revision
  response shape and decoding, and repair wording that asks revision to regenerate
  a complete response. Keep complete-plan decoding and repair for initial planning.
- Reuse the canonical accepted plan, retained evidence, existing plan validation
  and shared task lifecycle.
- Add only the pending response boundary and reconstruction/validation needed
  to enforce DI-21; avoid a parallel planner or revision store.
