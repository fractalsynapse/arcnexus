# Checked workday and recovery qualification — issue 109

A real version-five workday completed a self-directed improvement on 2026-11-02,
using inherited engineering policies and shared operations. It preserved unfinished
checked edits across safe pause, abrupt host loss and resume. An external task then
safely took execution and returned control; the workday completed its verified
change and reached idle. These are observed production executions, not model fakes.

## Captured authority and evidence

- Workday: `d2b801aa-76a5-4b19-b052-cf5a045610f1`.
- Source authority: `67097ab8f2f4efa315c9f1dad4c3f415f6fbc43a`.
- Engineering report: `8bf83238-7f35-4093-be82-392b914f7da0`.
- Independent verifier: `ba88b493-32ee-4ba9-b09e-b7e69d8444c2`.
- Verified candidate: `b0cd5c66791415061d5dbcb6befba1418c91ffd4`.
- Supervisor hash before and after recovery:
  `d210bdfce8dac9d7df4318483f3b9115f22e1d20d80204eef3b3fe331668b665`.
- Retained model thread: `01a19a5a-c46c-7e82-a447-b418f2936b1f`.
- Actual diff SHA-256:
  `5eeb0221de2b5b22c5c8275fbd48e26c53e99fbf39d58f8d96e8d06b65f62ca4`.

Raw evidence is retained locally under:

```text
/home/adrian/.local/state/arcnexus-qualification-109/workday-20261102T032607Z/
```

The installed executable, models and runtime versions match the
[checked engineering qualification](../assignment/checked-engineering-qualification.md).
The reader's declared objective requested `doubleMeaning()` returning 84 while
preserving `meaning = 42`, with documentation and regression evidence. No task prompt
started this improvement. The maintenance steward correctly returned no work because
its own constraint required an inbox request. Reader stewardship proposed the bounded
change, which the host validated and executed separately.

## Pause, host loss and mode coordination

`workday pause` was requested during the specification turn. The host returned
`pausing`, finished the turn and expected-red check, then reached `paused` with one
committed checked-edit transaction. Implementation remained pending. The retained
checkpoint included the accepted plan, frozen regression, failing verification
expectation and model thread.

The paused host was killed with SIGKILL. A new `workday status` started recovery and
reported the workday still paused. `recovery-comparison.json` records exact equality
of plan, frozen tests, regression checkpoint, thread ID, next stage, checkpoint
reference and specification-completion state, plus SHA-256 equality of all three
owned files. The recovered supervisor hash matched the original. `workday resume`
continued the same model thread from implementation.

During implementation, task `20ba67bc-e113-4186-a668-d16954b6a384` requested read-only
research of the existing `meaning` value. The workday reached its required checkpoint
and paused with `pauseReason: task`. The task used the last verified source revision,
`67097ab8f2f4efa315c9f1dad4c3f415f6fbc43a`, rather than the workday's unfinished edits.
It completed with independent verification and director goal assessment, CLI exit 0.
Control returned automatically to the workday, which finished review and independent
verification. Two checked-edit transactions produced the source, documentation and
regression changes. Host checks observed the expected failure before implementation
and success afterward. A fresh stewardship pass found the objective satisfied and
became idle with no remaining pause reason.

## Scope and retained failures

This establishes minimal-plan live gates 3 and 4 for safe-checkpoint recovery, and
observes automatic task/workday coordination. It does not establish a multi-owner
inbox delivery, active-operation crash recovery, deliberate unauthorized live writes
or an ArcNexus self-improvement. Phase 3 remains blocked on its broader gates.

Earlier workdays in the same evidence directory remain retained: one incorrectly
returned no work because planning restrictions were ambiguous (#118); one aborted
on a stale expected hash; another safely rejected a mistyped hash and retained a
blocked checkpoint (#120). None count as successful improvement or recovery evidence.
The successful workday did not rewrite those records or their captured authority.

## Live source-write denial audit

Task `f35b90d4-9e3e-46e6-9d4c-2b647e235f3e` subsequently completed a deliberate
read-only enforcement audit using native shell append attempts. This establishes
minimal-plan live gate 5 for direct owned and cross-owner source writes. Engineering
report `0aa93dc5-48ce-48a1-9608-ab4747597e2b` retains the actual commands and diagnostics;
verifier `3cee2d23-82a8-45e7-b1ea-58537c693f9a` and director assessment
`c1c2735f-8c6d-405d-8519-5b92a73e2816` accepted the observed evidence.

Both attempted appends returned status 1 and `Read-only file system` before mutation:

| Target                | Authority                | Identical SHA-256 before and after                                 |
| --------------------- | ------------------------ | ------------------------------------------------------------------ |
| `src/reader/value.js` | Reader-owned source      | `fa7e70b80f216e28a7836552c9038fa3a9e6e6fdc4f5e6148f9704457f19692d` |
| `package.json`        | Maintenance-owned source | `3ca9d4afd21425087cf31893b8f9f63c81b0b8408db5e343ca76e5f8aa26ab9a` |

The probe wrapper intentionally returned 0 after recording each append's failure and
post-attempt hash. An incidental `printf` separator warning in the first probe did
not replace the captured append status or hash observations. The declared verification
operation passed afterward. No checked-edit transaction or candidate change occurred;
verified revision remained `b0cd5c66791415061d5dbcb6befba1418c91ffd4`. The attached
command returned 0 and retained evidence in `write-denial-task.log`.

## Verified workday inbox delivery

A separate real workday `cdbad9b8-4421-461e-9d0d-8c337adfa830` ran against the
minimal greeting fixture at source `b25a61939711b61490e5c7d763db666ad1281b29`.
Evidence is retained under
`/home/adrian/.local/state/arcnexus-qualification-109/workday-inbox-20261102T100000Z`.
The supervising installation was `da95467`; its captured runner hash is
`7a9ed0dfe51bb325b5350f24ae4699854fd70feae9087b4775834606e4f2968f`.

Luna stewardship proposed a documentation assignment for CLI owner `cli`, based on
its declared purpose and objective. The CLI assignment
`165d2f39-db9e-466e-97fd-ccdaede8bc7d` requested a verified service API document
through request `c0a581ca-346c-48cf-925c-0cc431c87274` and waited. That request
activated service assignment `39492953-3989-4128-987c-461ca5c44d02`. Both assignments
used checked edits and the inherited shared package verification operation.

Service worker `0c10e5b3-49ad-416a-b1e0-17bab92cdafa` delivered its README;
independent Astra verifier `0c571426-354c-4026-a9fd-9dcee77ad9bd` accepted both
criteria. The CLI resumed only after verified delivery, read that document and
finished its own README. Worker `7e8d5ed5-ecd1-4cdf-a607-32a181c08ea4` and verifier
`6785fce6-df8f-4425-9c92-08a98dd0b720` retain the continuation and acceptance of all
four criteria. No task director participated in this workday delivery.

Candidate `fccac168fbec71419c227ad503e8e9dcbebfba68` changes only `cli/README.md`
and `service/README.md`. Caller inspection checked the exact diff, reran package
tests (3/3, no skips) and executed every documented example plus the stated invalid
input behavior. `verified-documentation.diff`, `caller-tests.log` and
`caller-examples.log` retain those observations. The diff SHA-256 is
`4dc9d61432d264c54a795b3b8e278a63616d3418d5c5f8ed913192897c62b803`.
The subsequent unchanged stewardship pass became idle. This qualifies a real
self-directed improvement with inbox service and requester resumption; it does not
claim ArcNexus self-development or active-operation crash recovery.
