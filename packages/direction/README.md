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

## Required observations

Public regressions must demonstrate a large completed prefix remaining outside
the inline revision prompt while its exact plan and full evidence remain readable;
pending-only response decoding and reconstruction; and rejection of altered
completed acceptance without replacing accepted work. Supplier escalation and
final independent rejection must exercise that same boundary. Existing initial
planning and initial invalid-response repair behavior remain covered.

## Simplification ledger

- Remove superseded native instructions and decoding that require full-plan
  regeneration for revision.
- Reuse the canonical accepted plan, retained evidence, existing plan validation
  and shared task lifecycle.
- Add only the pending response boundary and reconstruction/validation needed
  to enforce DI-21; avoid a parallel planner or revision store.
