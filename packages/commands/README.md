# Commands SDK

Commands is the transport-neutral Cordis application boundary for gateway authors.
Its [contract](contract.md), especially CMD-4 and CMD-5, defines the accepted
refinement and observation behavior. [Workflow](../workflow/contract.md) owns
sequencing and durable lifecycle state; [Agent](../agent/contract.md) owns
inspection and activation preparation.

## Availability and intended contribution

The public entry is [src/index.ts](src/index.ts). It currently registers
`commandsPlugin` with required Agent and Workflow injections and exposes
`inspect`, `runTask`, `planTask`, `runRound` and `updateArchitecture` on
`Context['commands']`. Workflow already exports `Workflow.refine`; Commands
does not yet expose it. The intended contribution adds direct SDK delegation
to that operation. This document records intent before that behavior changes;
neither this documentation nor an accepted declaration establishes installed
end-to-end support or live refinement qualification.

The intended public method is
`refine(directory, rounds, observer, signal): Promise<TaskOutcome>`, reusing
the signature of `Context['workflow']['refine']`. Callers pass the project
directory, an explicit positive integer round count, a `TaskObserver` and an
`AbortSignal`. The CLI owns its default of one round and validates its argument
grammar before admission. Workflow validates the structured count before
admission. No arbitrary safe-integer ceiling or other resource cap is added.
Commands has no argv, JSON option, terminal handles or exit-code policy.

Commands reuses Workflow's public types from
[its entry](../workflow/src/index.ts), rather than maintaining another event
or outcome union. The existing SDK preserves standalone operations:

| Method | Owning public operation |
| --- | --- |
| `inspect(input: InspectionInput)` | `Agent.inspect` |
| `runTask(input: TaskInput, observer, signal)` | `Workflow.run` |
| `planTask(directory, objective, observer, signal)` | `Workflow.run` with the selected planning mode |
| `runRound(directory, observer, signal)` | `Workflow.round`, returning `RoundOutcome` |
| `updateArchitecture(directory, feedback, observer, signal)` | `Workflow.update` |
| Intended `refine(directory, rounds, observer, signal)` | `Workflow.refine`, returning `TaskOutcome` |

`InspectionInput` comes from [Agent's public entry](../agent/src/index.ts).
It includes the directory and selected component and activity. Inspection
returns the same complete prepared request and separate invocation options
used by activation, with named unavailable placeholders. It performs no task
admission or provider activation.

An undefined planning objective selects exploration; an explicit objective
selects objective mode and retains the human submission. Internal refinement
phase descriptions are not human objectives. An undefined architecture feedback
requests general alignment; supplied feedback focuses assessment and does not
approve a proposal.

## Refinement lifecycle visible to callers

Workflow runs Plan, Architect and then Run for each requested round. Plan uses
Planner exploration. Architect assesses accepted guidance and delivers approved
prerequisites through the normal task path. Run captures the approved inventory
after both phases and invokes Direction for every goal in priority order, even
when its measures already pass. Every new round repeats both assessments and
captures a fresh inventory. Justified no change is valid.

Workflow holds one Coordination project writer for the foreground invocation.
Sequential phase and goal sessions are normal children sharing that writer;
another foreground root is refused. Commands does not create child admissions,
loop over SDK methods, cache authority for the invocation or maintain state.
Fresh accepted staging authority is resolved at phase/task admission, with the
existing validated in-run adoption boundary preserving original task acceptance,
ownership and historical identities. See the [Workflow contract](../workflow/contract.md)
and [Coordination contract](../coordination/contract.md) for their responsibilities.

Retrying the same unfinished request resumes its first unfinished round, phase
and goal. The requested total cannot change while it remains unfinished.
Completed phases and goal outcomes stay complete; the exact captured Run
inventory survives interruption. Proposals, approvals, answers, acknowledged
checkpoints and issue/branch/PR identities retain continuity. Successful child
outcomes are reused when a crash precedes the parent's completion record.
Uncertain publication effects are reconciled through existing delivery services
before replay. A completed invocation permits a fresh invocation with new child
identities. Validated newer installed runtimes retain progress and record their
actual identity through the existing host lifecycle.

## Observations, questions and outcomes

Pass the original `TaskObserver` and `AbortSignal` through Commands to
Workflow. The observer interface is exported by Workflow:

| Callback | Consumer responsibility |
| --- | --- |
| `progress(observation: Observation)` | Handle live phase/activity progress and evidence references. Refinement progress identifies the round and phase. |
| `event?(event: JournalEvent)` | Consume the ordered persisted host/provider stream, including complete messages, tool calls/results and correlation identities. |
| `measurements?(snapshot)` | Consume the existing event-derived `RunMeasurements` snapshot, retaining profile identity and unknown values. |
| `answer?(question, signal)` | Return `Promise<string \| undefined>` with an actual human answer asynchronously, retaining its complete text and meaningful whitespace; return undefined when no answer is available. |

Implement `event` to consume the full persisted stream; progress alone is not a
replacement for provider/tool observations.
The current Workflow observer supplies legacy persisted progress when no event
callback is present. A caller implementing both callbacks must not assume each
persisted progress observation is also delivered through `progress`.

The stream carries phase/goal positions through `RefinementProgress`, per-goal
outcomes through retained Workflow observations, and report/finding/measurement
references through `CompletedRefinementRound`. Preserve complete originating
records and evidence links without previews or truncation. Completed-round reports
live outside source in the existing evidence path. Later Planner, Architect and
Director assessments consume those findings as observations; Commands creates
neither an evidence store nor objective/goal records containing execution results.

Measurements retain elapsed time and provider-reported usage by actual execution
profile. Missing usage and unverified pricing remain unknown. Cached-input usage
must not be blindly added to input totals. Commands forwards measurements and
does not substitute profiles or impose budgets.

Human gates govern objectives, goals and architecture. An unavailable answer
yields a durable pending gate, currently represented by a `TaskOutcome` with
`kind: 'blocked'`, its reason and evidence references. Later interaction resumes
the same phase and proposal. A decline preserves the submitted intent and accepted
authority. Neither elapsed time nor absence of a callback supplies approval.
Routine repair, checks and verified staging integration add no human gate.

The returned promise supplies one aggregate `TaskOutcome`. Child terminal
observations remain part of the journal stream and must not be mistaken for the
foreground result. Current outcome kinds are `merged`, `planned`, `satisfied`,
`invalid`, `blocked`, `failed` and `cancelled`; preserve their fields and
evidence rather than converting them to success strings. A justified assessment
or complete refinement can return `planned` without claiming a staging merge.

Cancellation follows the supplied signal through managed operations and provider
execution. Retained position, answers, evidence and acknowledged edits remain
resumable. Completed provider prose does not establish aggregate success; the
owning lifecycle records cleanup and the actual terminal result. Gateways render
or transport these outcomes using their own conventions.

## Evidence required for the contribution

For CMD-REF-SDK / CMD-4, a nonterminal public-composition regression must invoke
refinement through Commands with real structured inputs, the original observer
and signal, and observe Workflow's returned outcome unchanged. Controlled explicit
collaborators distinguish phase, goal, pending-gate, recovery, cancellation and
completion behavior. Commands must not acquire its own sequencing or state.

For CMD-REF-STREAM / CMD-5, meaningful SDK regressions must observe complete,
ordered persisted host/provider and tool content, progress, evidence and
measurement references during execution, followed by one aggregate result.
Use distinct observations and full questions/answers so omission or reordering is
detectable. Preserve existing inspection, task, planning, standing-round and
architecture delegation coverage. These tests establish the SDK boundary;
Workflow recovery tests, assembled production wiring, CLI rendering and the
separate live three-round acceptance establish their respective behaviors.
