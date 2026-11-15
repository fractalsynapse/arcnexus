# CLI commands plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

The CLI application composes the plugin and adapts arguments and exit codes.
The plugin exposes `arcnexus inspect [component] [activity]` and
`arcnexus task run "<goal>"` for the project resolved from the working directory.

Inspection renders what ArcNexus passes to Codex from the production request
builder. Resolve the same captured inputs as activation, identify runtime-only
placeholders, and refuse unknown owners or activities. Inspection reads without
model calls, writes, worktree creation or upstream effects.

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
| GW-15 | `inspect <component> implementation` renders the component context, resolved guidance, profile, role, standards, authorized scope and operations in production assembly order. It names task-only inputs that are unavailable. |
| GW-16 | `inspect` output equals a live activation's context for the same revision, component, activity and milestone, differing only in the declared placeholders. |
| GW-17 | `inspect` writes no state, starts no host, calls no model and creates no workspace; repeated runs on an unchanged revision are byte-identical. |
| GW-18 | A runtime-only value appears as a named placeholder and is never filled with invented content; the header lists what was substituted. |
| GW-19 | The foreground task prompts for a genuine human gate and records the answer as evidence. |
| GW-20 | `inspect` with an unknown component or an activity outside the declared set is exit 2 naming the valid values. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

GW-4, GW-8, GW-9, GW-10, GW-12, GW-13, GW-14, GW-21
