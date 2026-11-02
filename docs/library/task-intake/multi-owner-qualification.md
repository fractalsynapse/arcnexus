# Minimal configuration multi-owner qualification

The live multi-owner gate remains **unmet**. These production-wiring attempts used
real director, engineering and independent verifier activations, with the installed
`codex-cli 0.163.0-alpha.10.2`, Node 22.22.1 and bubblewrap 0.11.1. The fixture had
four eligible owners: maintenance, gateway, formatter and names. Engineering used
Luna; direction and independent review used Astra. No simulated run is counted.

The goal was an additive gateway `greetMany(names)` returning uppercase greetings
in input order, preserving existing greeting, formatting and trimming behavior.
The director was instructed to start engineering with gateway only. Existing owner
boundaries required formatting and normalization dependencies to be discovered and
requested during execution. The source authority was
`79c28157a15a0ec64d7522c700e2ef3acefd286b`.

## Observed attempts

Evidence roots are beneath `/home/adrian/.local/state/arcnexus-qualification-109/`.

| Task | Evidence root | Outcome and observed limitation |
| --- | --- | --- |
| `2b0d9664-b7b2-4993-8276-212d25c2e58b` | `multi-owner-20261102T035451Z` | `needs_input`; gateway → formatter → names activation occurred, but reused edit identities and incompatible shared-delivery criteria prevented completion. |
| `b0f73af0-a148-42b2-aa5d-1fe360535013` | Same root | `needs_attention`; one names delivery completed independently, but a later overlapping names assignment conflicted in documentation and regression files. Both versions and the conflict evidence were retained. |
| `91695d0d-8ead-49c2-8e62-7bf7e39c6772` | `multi-owner-guidance-20261102T043036Z` | `needs_input`; workers discovered the checked edit tool but submitted absolute paths, correctly rejected before mutation. |
| `a8d94f1b-c0ae-493e-b27a-f2288bab9377` | Same guidance root | `needs_input`; relative checked edits worked, but implementation attempted to change a frozen names regression. The host rejected it and the director requested a specification restart decision. |

The subsequent additive-compatibility task `13a34943-9913-4269-ba87-5b70d48b30b7`
used the same guidance root and clean source authority. It activated gateway, names
and formatter, and independently verified the names and first formatter deliveries.
The formatter delivery did not satisfy the whole uppercase-greeting goal. Follow-up
assignments encountered invalid verification pagination and an unknown durable
request identity. The director retained `needs_input` rather than accepting a plan
that would replace a frozen assertion. Issue [#128](https://github.com/treeseed-ai/arcnexus/issues/128)
tracks these observed failures. The log is `task-additive-preserved-modes.log`;
this attempt does not satisfy the live gate.

Two earlier additive submissions stopped before model dispatch because stable runner
capture did not preserve empty-directory permissions. Issue
[#126](https://github.com/treeseed-ai/arcnexus/issues/126) records the reproduced
failure and repair; those submissions are not model executions.

The failed directory-binding preflight before the third task is retained separately
in that root's `task.log`; it is not a model execution. Subsequent task logs are
`task-guidance.log` and `task-relative-paths.log`. The second task's log is
`task-identity-recovery.log`.

Issue [#121](https://github.com/treeseed-ai/arcnexus/issues/121) made conflicting edit
identities recoverable without replaying a different batch. Issue
[#122](https://github.com/treeseed-ai/arcnexus/issues/122) added explicit checked-tool
discovery and relative-path guidance to captured engineering context. These direct
bootstrap repairs do not convert an unsuccessful live task into a successful gate.

No attempt waived ownership, silently merged different acceptance criteria, overwrote
a reconciliation conflict, or permitted an implementation-stage change to frozen
regressions. A new task may clarify the original additive compatibility requirement;
it cannot rewrite evidence or acceptance in a retained failed task. A completed
three-owner goal, independent verification and final director acceptance are still
required. The separate ArcNexus self-development gate also remains open.

A later task `3265a369-1f76-426b-93d6-60c2fcf2c42b` attached to the existing
project host despite a different caller state directory. It correctly reused the
retained candidate, including verified normalization code. A requested new expected-red
regression consequently already passed; the task retained `needs_input` rather than
waiving the regression checkpoint. Its log is in
`multi-owner-correlation-20261102T065000Z/task.log`, but authoritative evidence remains
in the earlier guidance root. This is neither a fresh candidate nor a qualification
of the caller installation's newer runtime. Subsequent qualification uses a separate
cloned repository identity, its original declared origin, and a fresh candidate.
