# Correct supplier links at the caller boundary

Issue [#678](https://github.com/fractalsynapse/arcnexus/issues/678) addresses a
concrete hold in the retained #668 refinement implementation. A Coordination
activity asked for CLI work while naming an accepted Commands milestone. Direction
correctly preserved that milestone's owner and could not accept the request.

Validate an existing supplier link before acknowledging its local MCP handoff.
The requested owner must match the accepted milestone's owner. Return an exact
diagnostic naming the requested owner, linked milestone and accepted owner. The
caller may reuse a matching accepted milestone or name genuinely distinct work.
This grants no new scope and does not change the plan or acceptance.

Use the same Direction-owned diagnostic for structured steward responses and
retained activation replay. A previously acknowledged inconsistent request remains
historical evidence; restart resumes the original activity at its retained cursor
with that diagnostic, rather than invoking Direction with an impossible request.
Retain successful file receipts and complete answers. Corrected valid requests use
the existing sequential supplier path.

The host enforces request validity. Separate proposed guidance improvements teach
Testing to make discriminating public assertions, keep evidence fixtures free of
recursive transcript copies, and make Architect review purpose and instruction
effectiveness against objectives, goals and actual execution findings. Guidance
cannot replace host enforcement or count as live behavioral proof.

Reuse the canonical plan, activity position, journal and response repair. Add no
store, request budget, retry count, alternate scheduler or operator state repair.
Locked contracts and the registry remain unchanged. Required assembled checks and
independent review remain mandatory. Qualification is still 0/3 until the real
production refinement rounds finish.

## Required checks awaiting accepted foreign work

This implementation intent is for Execution maintainers and regression authors
working on `execution-explicit-foreign-handoff`. The human-approved Architecture
proposal `9730646a057f81f2889a11170ee5dd13b986bc2efecfcdf2502a004c589d085b`
against baseline `4d82c9051ade6ce48c7761028f7c1f5235b42777` clarifies the
[shared Implementation role](../../../.arc/architecture/roles/systems-engineer.yaml).
That protected role is the canonical decision; this contribution aligns the
existing host feedback with it without editing guidance.

A required repository check can fail on an unfinished foreign consumer migration
after the caller has secured its owned correction. Read the exact diagnostic,
resolve ownership through the captured Team and inspect accepted pending work.
Invoke mapped `request-supplier` before returning `completed`, linking the
matching accepted milestone with its actual owner and criteria. Accepted work
later in the plan still requires explicit sequencing. Describe a distinct new
contribution only when no accepted milestone covers the required work. Listing
foreign failures in `summary` or `answer` does not request that contribution or
satisfy a required-pass check. A compiler failure before an owner test reaches
its assertion is not intended behavioral red.

In [the public steward path](../src/steward.ts), replace the ambiguous
“when new work is needed” correction with the exact approved instruction:

> Read failedCheck.log first. It is the latest observed failure. Preserve the earlier finding and acknowledged edits. Correct an owned defect through this activity. If a required check needs unfinished work from another owner, use request-supplier before returning completed. Link the existing accepted milestone with its actual owner and criteria when it covers that work; already accepted pending work still requires explicit sequencing. Describe distinct new work only when no accepted milestone covers it. Listing foreign failures in summary or answer does not request their contribution. After the supplier result, refresh affected checks; the host preserves the original expectation and required completion verification.

The same request's `responseShape` guidance must express this decision consistently
and retain the mapped supplier capability. Reuse
[ActivationTools](../src/activation-tools.ts) for the checked receipt and explicit
handoff, [supplier context](../src/supplier-context.ts) for complete replies, and
[Workflow](../../workflow/contract.md) for Direction's existing sequential routing.
A non-completed supplier outcome already returns before completion verification.
Preserve the caller's issue, branch, activity position, original acceptance,
acknowledged receipts and complete answers. On resumption, consume the complete
supplier result and refresh affected required checks. A supplier may secure its
own correction and explicitly request another genuine foreign prerequisite;
already secured contributions must not be repeated.

### Required public regression observations

- **handoff-feedback:** Inspect the actual public steward correction request,
  including the exact instruction above, consistent response guidance and the
  available mapped `request-supplier` capability. A private constant assertion
  alone does not establish what the caller receives.
- **handoff-retention:** Secure an owned checked correction, observe a failing
  required repository check, then explicitly request the existing matching
  foreign milestone. Assert its actual owner and criteria, retained receipt and
  unchanged original acceptance across the handoff. Resume with a distinguishable,
  complete supplier result and passing affected rechecks after that contribution.
  An unrelated supplier edit alone does not prove explicit sequencing.
- **handoff-negative:** Return `completed` while merely acknowledging the unresolved
  foreign failure. The activity must remain unfinished and expose the exact
  diagnostic, original expectation, log and retained owned work. Repetition
  without changed relevant inputs must reach the existing unchanged-failure hold
  without delivery.

These are intended controlled regression observations, not results already
demonstrated by this document. Retain the existing completion gate, supplier-link
validation and unchanged-failure guard. Add no automatic supplier inference,
scheduler, store, retry limit or alternate recovery route. The contribution also
requires applicable owner-format, owner-lint, repository-types, repository-build
and owner-tests evidence before readiness. Controlled observations, native host
confinement, live inference, independent review, CI and staging delivery remain
distinct evidence.

The approved objective remains delivery of retained task
[#668](https://github.com/fractalsynapse/arcnexus/issues/668) through the normal
lifecycle, followed by three consecutive Plan -> Architect -> Run rounds.
Unfinished migrations in that retained candidate do not establish a storage
defect in the staging baseline. Do not repair its plan or database by operator
action, weaken required checks or count this feedback correction as live
qualification. [Delivery](../../delivery/contract.md) retains final publication
responsibility.
