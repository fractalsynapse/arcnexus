# CLI gateway contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

The CLI app owns terminal input, output and exit codes. Its Cordis adapter
delegates structured inspection and task operations to the shared
[Commands SDK](../../packages/commands/contract.md). The CLI exposes
`arcnexus inspect <component> <activity>` and `arcnexus task run "<goal>"` for
the project resolved from the working directory. Bare `arcnexus task run`
loads one round from the project goal inventory and evaluates each goal in priority
order through the same task service. `arcnexus task plan [<objective>]` uses
that task lane, progress, cancellation and output contract. The explicit form
records the original human objective and offers resumable clarification. The bare
form maps the captured project and may report no inventory change. Changes to
objectives or goals require approval of the exact diff and verified staging delivery.
The verbatim human submission is retained as authorized input; a model-authored
refinement is a proposal, not a replacement for that submission.

`--json` is a general CLI output option, accepted once before the command or
after its positional arguments. Inspection prints one structured JSON result on
stdout. Long-running task, planning, architecture and refinement commands stream
ordered JSONL observations on stdout followed by a typed terminal result record.
Human mode renders those same observations live, including acting component,
activity, operations and outcomes. Complete messages and evidence remain available
as emitted or by their authorized file references. Commands use the same positional
arguments, exit codes and stderr diagnostics in both modes. No plaintext progress
is mixed into JSONL stdout; invalid input before admission retains empty stdout.

Inspection requires both positional arguments. Missing or extra arguments,
an unknown component, and an activity absent from the component's explicit
activity map are input errors with exit 2 and no effects. Use
`arcnexus inspect director planning` for the captured Director binding and
`arcnexus inspect reviewer assessment` for the captured Reviewer binding.
Declared component IDs remain valid, including `arcnexus inspect direction planning`.
Actor selectors still require an explicit activity.

Inspection prints the complete context and request ArcNexus would pass to the
Codex harness, including resolved instructions, scope, evidence descriptors,
operations and applicable standards in production assembly order. Use the same
request builder as activation. The output includes the prompt and invocation
options. Codex discovers project directives and skills in its activation
environment. Show `<goal>` when no task goal is supplied and
name other task-only values unavailable before admission. Inspection is local and
read-only, with no model call, write, worktree, task admission or upstream effect.

By default, inspection prints a placeholder and invocation-options header
followed by the exact multiline prompt, with source labels and placeholders in
place. With `--json`, it prints one result object with `actor`, `component`,
`activity`, `placeholders` and `request`. Its `request.input` matches the
prompt in the rendered output byte for byte.

The foreground task streams harness and host events, messages, tool calls/results,
progress, evidence references and available timing/usage metrics as execution
proceeds, and honors SIGINT. Overall and execution-profile summaries identify
unknown usage and the pricing basis of estimated costs. They do not impose budgets.
Human decisions concern objectives, goals and architecture. Ordinary tool repair,
implementation, checks, plan sequencing and authorized staging delivery do not
require human approval. Unavailable external prerequisites remain observable holds;
they are never treated as approval to proceed.

Exit 0 represents the verified staging merge for a single goal, or a completed
round in which every goal has a Director assessment supported by evidence for the
evaluated revision or a verified merge. The Director can plan applicable checks
through the existing activity mappings. Assembled-candidate checks remain required
for changes. A completed mapping or an already recorded objective may exit 0
without a new staging merge.
Exit 1 represents a failed or blocked run, exit 2 invalid or unavailable input,
and exit 130 cancellation. Refuse a second active task in the same project. Other
verbs, option modes and launch surfaces are reserved for later qualification.

`arcnexus architecture update [<feedback>]` assesses the approved guides, captured
architecture, implementation and relevant prior observations. Feedback focuses the
assessment. A no-change assessment can complete without a merge. Proposed changes
show a purpose, consequences and exact diff for human approval. Required
implementation is delivered within the Architect phase before Run begins.

`arcnexus refine [--rounds <N>]` runs Plan, Architect and then every approved goal
in priority order for each round. N defaults to one and must be a positive integer.
Every round invokes Planner, Architect and the Director for each goal, even when
existing measures pass. Accepted no-change outcomes are valid. The general
`--json` option applies to both commands. A complete refinement invocation exits 0;
pending approval or an external prerequisite exits 1 without losing its cursor.
Approval pauses retain the exact proposal and resume the same phase and round.
A later invocation resumes unfinished refinement before starting new rounds;
changing the requested total while that invocation is unfinished is refused.
No answer, an unknown response or elapsed time supplies approval.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| GW-1 | A task launched from a nested directory resolves the project, shows progress and exits 0 only after verified staging integration. |
| GW-2 | Bare `task run` evaluates the goal inventory sequentially, reporting each result. Owner-free goals may complete with revision-applicable Director evidence or a verified merge, without a preplanning owner test. A missing or invalid inventory, empty explicit goal, or second positional is exit 2 without admitting a task. |
| GW-3 | `task run` while another goal holds the lane is exit 2 naming the active goal; no queue row is created. |
| GW-5 | Stopping through foreground SIGINT retains checked edits, the branch and evidence. Execution removes its worktree after preservation. A later invocation observes any uncertain effect before acting. |
| GW-6 | An unanswered human-only question results in exit 1 with a question and evidence reference. |
| GW-7 | `SIGINT` during execution exits 130 with retained evidence and no orphaned process. |
| GW-11 | A reserved command (`workday start`, `release verify`) is exit 2 reporting it is not available in this build. |
| GW-15 | `inspect <component> implementation` renders the selected activity context, role, standards, authorized scope and operations in production assembly order. It displays model settings as invocation options and names task-only inputs that are unavailable. Codex discovers project directives and skills at activation. |
| GW-16 | `inspect` output equals a live activation's context for the same revision, component, activity and milestone, differing only in the declared placeholders. |
| GW-17 | `inspect` writes no state, starts no host, calls no model and creates no workspace; repeated runs on an unchanged revision are byte-identical. |
| GW-18 | A runtime-only value appears as a named placeholder and is never filled with invented content. The rendered header and the JSON result both list the placeholders used. |
| GW-19 | Objective, goal and architecture decisions retain the question, exact proposal and human answer. Routine technical repairs create no approval prompt; unavailable external prerequisites remain named holds. |
| GW-20 | `inspect` with an unknown component or an activity outside the declared set is exit 2 naming the valid values. |
| GW-22 | Inspection, task execution, goal planning, architecture updates and refinement delegate through the same structured SDK available to in-process callers. The CLI alone translates terminal arguments, progress, questions and results into its transport. |
| GW-23 | Bare `inspect`, an invocation with only one positional argument, and an invocation with extra arguments each exit 2 without effects. |
| GW-24 | `inspect director planning` and `inspect reviewer assessment` resolve the captured special actor bindings. `inspect direction planning` remains a valid component and activity selection. |
| GW-25 | Inspection prints the full ordered context and request from the activation builder. With matching inputs the payload matches the Codex adapter's input. Before admission it prints `<goal>` and names unavailable task-only values. |
| GW-26 | Both permitted placements of `--json` return the same structured inspection result. Its `request.input` equals the default rendered prompt. Duplicate or misplaced flags exit 2 with stderr diagnostics and empty stdout. |
| GW-27 | Bare `task plan` maps the captured project. Explicit `task plan "<objective>"` records the exact submission and can resume a clarification. Inventory edits require approval of the exact diff before reviewed staging delivery. |
| GW-28 | Both architecture update forms assess through the same SDK and return a no-change result or an exact proposed diff. Approval and required prerequisite delivery complete before the following Run phase. |
| GW-29 | refine defaults to one round and accepts a positive integer --rounds value. Invalid, duplicate or unsupported arguments exit 2 before admission. Every completed round runs Plan, Architect and all captured goals in priority order. |
| GW-30 | Interrupting a refinement phase or awaiting approval retains its identity and cursor. The same invocation resumes without replaying completed phases, losing answers, repeating edits or creating a duplicate PR. Changed round totals are refused while it is unfinished. |
| GW-31 | Human and JSONL task modes display observations before completion from the same structured observer. JSONL stdout contains only typed event/result records in order; inspect --json remains one result and exit semantics remain unchanged. |
| GW-32 | A running task exposes actor/activity, operations, elapsed time and available profile-level usage/cost with evidence links. Cancellation and restart preserve the recorded timeline and unknown measurements are not reported as zero. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

GW-4, GW-8, GW-9, GW-10, GW-12, GW-13, GW-14, GW-21
