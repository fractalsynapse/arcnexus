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
