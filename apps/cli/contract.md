# CLI gateway contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

The CLI app owns terminal input, output and exit codes. Its Cordis adapter
delegates structured inspection and task operations to the shared
[Commands SDK](../../packages/commands/contract.md). The CLI exposes
`arcnexus inspect <component> <activity>` and `arcnexus task run "<goal>"` for
the project resolved from the working directory.

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

The foreground task streams progress and evidence references, asks genuine human
questions, and honors SIGINT. Exit 0 represents the verified staging merge.
Exit 1 represents a failed or blocked run, exit 2 invalid or unavailable input,
and exit 130 cancellation. Refuse a second active task in the same project. Other
verbs, option modes and launch surfaces are reserved for later qualification.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| GW-1 | A task launched from a nested directory resolves the project, shows progress and exits 0 only after verified staging integration. |
| GW-2 | `task run` with no goal, or with a second positional, is exit 2 and writes no state. |
| GW-3 | `task run` while another goal holds the lane is exit 2 naming the active goal; no queue row is created. |
| GW-5 | Stopping through foreground SIGINT retains branch, worktree and evidence. A later invocation observes any uncertain effect before acting. |
| GW-6 | An unanswered human-only question results in exit 1 with a question and evidence reference. |
| GW-7 | `SIGINT` during execution exits 130 with retained evidence and no orphaned process. |
| GW-11 | A reserved command (`workday start`, `release verify`) is exit 2 reporting it is not available in this build. |
| GW-15 | `inspect <component> implementation` renders the selected activity context, role, standards, authorized scope and operations in production assembly order. It displays model settings as invocation options and names task-only inputs that are unavailable. Codex discovers project directives and skills at activation. |
| GW-16 | `inspect` output equals a live activation's context for the same revision, component, activity and milestone, differing only in the declared placeholders. |
| GW-17 | `inspect` writes no state, starts no host, calls no model and creates no workspace; repeated runs on an unchanged revision are byte-identical. |
| GW-18 | A runtime-only value appears as a named placeholder and is never filled with invented content; the header lists what was substituted. |
| GW-19 | The foreground task prompts for a genuine human gate and records the answer as evidence. |
| GW-20 | `inspect` with an unknown component or an activity outside the declared set is exit 2 naming the valid values. |
| GW-22 | Both commands delegate through the same structured SDK available to in-process callers. The CLI alone translates terminal arguments, progress and results into its transport. |
| GW-23 | Bare `inspect`, an invocation with only one positional argument, and an invocation with extra arguments each exit 2 without effects. |
| GW-24 | `inspect director planning` and `inspect reviewer assessment` resolve the captured special actor bindings. `inspect direction planning` remains a valid component and activity selection. |
| GW-25 | Inspection prints the full ordered context and request from the activation builder. With matching inputs the payload matches the Codex adapter's input. Before admission it prints `<goal>` and names unavailable task-only values. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

GW-4, GW-8, GW-9, GW-10, GW-12, GW-13, GW-14, GW-21
