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
to subsequent work; the active capture remains immutable.

Implementation of this approved capability is bootstrap work in #631. Deterministic
checks, hosted CI and real phase acceptance are reported separately.
