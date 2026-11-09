# Gateway contract — ArcNexus CLI

Type contract: `gateway`. Stage: **locked** (revision 3). Owner: `cli`.
Depends on: [`arcnexus-project.md`](arcnexus-project.md), [`arcnexus-foundation.md`](arcnexus-foundation.md).

The CLI is the first behavioural surface and the anchor for acceptance tests: what it promises
is what the application services underneath must deliver. It is deliberately thin — every
command maps to one application service call and the gateway holds no policy, no lifecycle
logic and no project knowledge of its own.

## Identity

| Field | Value |
| --- | --- |
| executable | `arcnexus` (built entry `dist/cli.js`) |
| discovery | run from any directory inside the target repository; the project and owning component are resolved from the working directory |
| help and version | `arcnexus --help`, `arcnexus --version` |
| configuration | none required for normal use; machine bindings come from the project contract |

## Provides

### 1. Delivered commands

Options are stated with the command that accepts them. Only `--json`, `--help` and `--version`
are global.

```text
arcnexus task run [project] "<goal>" [--async] [--simulate] [--json]
arcnexus task status [goal-id] [--follow] [--after <event-sequence>] [--json]
arcnexus task stop [goal-id]
arcnexus task answer <goal-id> "<response>"
arcnexus inspect [project] [component] [activity] [--milestone <id|file>] [--json]
arcnexus component list [project] [field=value ...] [--search <text>] [--limit <1-100>] [--cursor <token>] [--json]
arcnexus component get <project> <id> [--json]
arcnexus standard list <project> [field=value ...] [--search <text>] [--limit <1-100>] [--json]
arcnexus standard get <project> <id> [--json]
arcnexus test inspect [project] [--component <id>] [--level unit|integration|acceptance] [--tag <tag>] [--json]
arcnexus test run [project] [component] [--level <level>] [--tag <tag>] [--json]
arcnexus validate [project] [--json]
arcnexus evidence get <id> [--offset <n>] [--length <n>] [--json]
```

`task run` means: pursue this goal until it is met, released and verified, or until it is
stopped. `--simulate` selects the evidence-package collaboration provider: the real lifecycle
with no upstream and an evidence package instead of a remote. It is not a mock mode and grants no
capability — see the collaboration-provider contract. Without `--async` it streams progress and, when a gate question arises, **prompts the
terminal and records the answer as evidence**; with `--async` it never prompts and ends at
`blocked: awaiting <gate>`. `task answer` resolves a pending gate on any run, interactive or
not.

`task status` is the single read surface for a goal: milestones, Steps, checklist items with
status, the current position, blockers, evidence references and the report location. There is
no separate plan command — one fact, one command.

`validate` checks architecture, ownership and guidance for the project and lists what must be
fixed. `test run` runs selected deterministic suites. Neither renders agent context; that is
`inspect`.

### 2. `inspect` — the context a harness will actually receive

`inspect` renders the **complete generated context** for one activity, using the same generator
that a live activation uses, with placeholders substituted only where runtime data would be
injected. Activity content makes or breaks an assignment, so it must be reviewable, diffable and
tunable without spending a model turn or starting a run.

| Argument | Values |
| --- | --- |
| `project` | resolved from the working directory when omitted |
| `component` | a component id; omitted with `activity` renders the catalog index view |
| `activity` | `direction` \| `research` \| `documentation` \| `design` \| `implementation` \| `review` \| `integration` — the same set the execution profiles resolve |
| `--milestone` | a milestone id from an active plan, or a plan file, to render against real acceptance; otherwise a placeholder milestone |

The rendered context contains, in assembly order: project identity and captured revision; the
component definition with objectives, constraints and measures; inherited parent definitions;
role responsibilities; the standards attached to that activity; the milestone objective,
acceptance criteria and checklist; the authorized write scope; the declared operations and
bindings available to that activity; the evidence interface and its current references; the
workflow schedule for the activity; and the instructions file in force.

Rules:

- **One generator.** `inspect` and a live activation call the same context assembly. A second
  renderer built for preview is a defect: it drifts, and the preview then lies.
- **Placeholders are explicit.** Every runtime-only value appears as `<placeholder-name>` —
  workspace, run id, captured digests, prior evidence, base revision, event sequence. A
  placeholder is never filled with invented content, and the output header states which values
  were substituted.
- **No side effects.** `inspect` starts no host, calls no model, writes no state, and creates no
  workspace or plan.
- **Deterministic.** Same revision, component, activity and milestone input produce byte-identical
  output, so context changes are reviewable as diffs.
- **Bounded and addressable.** Output honours the same evidence rules as every other command:
  ranges on request, references by id, `--json` parity.

### 3. Reserved names

Fixed now so nothing invents them later. Refused as *not available in this build* with exit `2`,
never repurposed:

```text
arcnexus workday start|stop|status        # self-directed loop on the same plan machinery
arcnexus project show|configure           # replaces platform and package management
arcnexus release verify                   # verify-release against CI/CD and deployment
arcnexus delivery status                  # read-only view of a published candidate
```

### 4. Retired commands

Removed, each with a one-line pointer to its replacement in the refusal message:

| Retired | Replacement |
| --- | --- |
| `platform` and `package` create/update/remove/migrate/list/get | `project` vocabulary; `component` and `standard` reads |
| `config get/update/migrate` | bindings file under the project contract |
| `workspace prepare/cleanup/list/get` | runtime-managed; read through `evidence get` |
| `delivery approve/publish/promote` | human gates answered through `task answer`; release stage later |
| `experiment inspect` | deferred campaign lane; the simulation lifecycle stays, under `--simulate` |
| `task pause`, `task resume` | `task stop`, then a new `task run` reading the recorded position |
| `task list/get/follow/inspect`, `workday list/get/history/follow/inspect` | `task status`, `evidence get` |
| `inspect <component> <objective> --kind …` and the two legacy inspect forms | one `inspect [project] [component] [activity]` context preview |
| `guidance validate`, `run` | folded into `validate`; execution is `task run` |

### 5. Rejected options

Options that once existed and are gone are refused with exit `2` and a stated reason, never
silently ignored: `--model`, `--initializer-model`, `--codex-path`, `--max-attempts`,
`--timeout-seconds`, `--composition-profile`, `--execution-profile`, `--issue`,
`--mode`, `--output`, `--input`, `--base`, `--write`, `--workspace`, `--bindings`, `--kind`,
`--category`, `--assignment`, `--activity` (activity is positional).

### 6. Output contract

- Default output is a human-readable stream: milestone and Step transitions, check results with
  status, and the final report location.
- `--json` emits the same facts as one machine-readable object carrying `schemaVersion`;
  diagnostics go to stderr in both modes.
- Artefacts are referenced by id with a size, never inlined; a reader asks for a range.
- Every check result is one of `passed`, `failed`, `skipped`, `unavailable` or `not-applicable`,
  and only `passed` supports an acceptance claim.

### 7. Exit codes

| Code | Meaning |
| --- | --- |
| 0 | verified completion or successful control action |
| 1 | blocked, awaiting a named gate, or an unsuccessful execution |
| 2 | invalid invocation: unknown, misplaced or rejected option; ambiguous or unresolved project; unavailable binding; reserved name |
| 130 | cancelled by the caller; managed execution stopped and evidence retained |

### 8. Cancellation and interruption

`SIGINT` and `SIGTERM` cancel managed execution promptly, stop subprocesses, retain the branch,
workspace and evidence, and exit `130`. There is no time, turn, call or attempt budget;
governing is by observed progress and cancellation only.

### 9. Human gates

A step only a human can complete surfaces as a question. Foreground `task run` prompts;
`--async` runs end at `blocked: awaiting <gate>` and are answered with `task answer <id>`. The
answer is recorded as evidence. No flag bypasses a gate and no agent answers its own.

## Invariants

| # | Invariant |
| --- | --- |
| I1 | The gateway holds no policy or lifecycle logic: one command, one application service call. |
| I2 | Project and component resolution comes from the working directory; ambiguity is an input error naming what was missing. |
| I3 | One project has one lane. A second `task run` while a goal is active is refused with the active goal id; there is no queue machinery in the MVP. |
| I4 | Every delivered command has a human form and a `--json` form with identical meaning. |
| I5 | Output is bounded. No command inlines an unbounded artefact. |
| I6 | Cancellation is honoured at any point and never leaves a half-applied change undocumented. |
| I7 | Human gates are answered, not worked around. |
| I8 | Unknown, misplaced and rejected options fail with a reason, never silently ignored. |
| I9 | Reserved names are refused as unavailable, never implemented opportunistically. |
| I10 | A human caller, a steward operation and CI run the same commands with the same results. |
| I11 | One fact, one command. No two commands render the same state, and no command duplicates another's source. |
| I12 | `inspect` uses the live context generator. Preview and execution cannot diverge, and placeholders are never replaced by invented content. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| GW-1 | `task run "<goal>"` from a nested directory resolves the project and component, prints progress, and exits 0 only when the goal is verified and delivered. |
| GW-2 | `task run` with no goal, or with a second positional, is exit 2 and writes no state. |
| GW-3 | `task run` while another goal holds the lane is exit 2 naming the active goal; no queue row is created. |
| GW-4 | `task status` renders milestones, Steps, checklist status, position, blockers and evidence references from one source; no second command reports the same state differently. |
| GW-5 | `task stop` cancels managed execution, retains branch, workspace and evidence, and a later `task run` reads that position instead of replaying an uncertain operation. |
| GW-6 | A gate that needs a human ends the run at exit 1 with a question id; `task answer` resumes and records the answer as evidence. |
| GW-7 | `SIGINT` during execution exits 130 with retained evidence and no orphaned process. |
| GW-8 | Every delivered command's `--json` form parses, carries `schemaVersion`, and reports the same facts as its human form. |
| GW-9 | `evidence get <id> --offset --length` returns exactly the requested range and never the whole artefact. |
| GW-10 | A rejected option (`--model`, `--simulate`, `--max-attempts`) is exit 2 with the replacement named. |
| GW-11 | A reserved command (`workday start`, `release verify`) is exit 2 reporting it is not available in this build. |
| GW-12 | `validate` reports ownership, architecture and guidance findings with paths, and exits non-zero when any tracked maintained path lacks exactly one owner. |
| GW-13 | `test run <owner>` runs only that owner's suites and reports the count; `test run` runs the full set. |
| GW-14 | The same command run by a steward operation and by a human produces the same exit status and the same evidence shape. |
| GW-15 | `inspect <project> <component> implementation` renders the full activity context — component definition, inherited parents, role, activity standards, milestone acceptance and checklist, authorized scope, operations, bindings, evidence interface and schedule — in assembly order. |
| GW-16 | `inspect` output equals a live activation's context for the same revision, component, activity and milestone, differing only in the declared placeholders. |
| GW-17 | `inspect` writes no state, starts no host, calls no model and creates no workspace; repeated runs on an unchanged revision are byte-identical. |
| GW-18 | A runtime-only value appears as a named placeholder and is never filled with invented content; the header lists what was substituted. |
| GW-19 | Foreground `task run` prompts at a gate and records the answer; `task run --async` never prompts and ends `blocked: awaiting <gate>` with the question id in evidence. |
| GW-20 | `inspect` with an unknown component or an activity outside the declared set is exit 2 naming the valid values. |
| GW-21 | `task run --simulate "<goal>"` runs the same lifecycle as without the flag, records the provider as evidence-package, and performs no upstream call; omitting the flag cannot be chosen by an agent mid-run. |

## Migration

| Current surface | Change |
| --- | --- |
| 16 command modules and ~40 subcommands | 13 delivered subcommands plus 4 reserved names |
| Two legacy `inspect` forms (`<component> <objective> --kind`, `<package> <component> [prompt] --activity`) | one `inspect [project] [component] [activity]` context preview over the live generator |
| 34 accepted options | 3 global options plus per-command options; the rest are refused with a reason |
| `needs_input` outcome and interactive clarification loop | one `blocked: awaiting <gate>` outcome, terminal prompting in the foreground, `task answer` otherwise |
| FIFO task queue and workday pause/resume coordination | single lane, refuse-while-busy |
| `platform`, `package`, `config`, `workspace`, `delivery`, `experiment`, `guidance` commands | retired as above |
| inline catalog and evidence in output | bounded references by id |

Migration is one batch with the Project contract: retire the command families and their option
parsing in the same change that removes platform and package, so no intermediate build offers
both spellings.

## Non-goals

HTTP, MCP and React adapters over these services (later gateways on the same application
functions), a daemon control surface, an interactive terminal UI beyond gate prompts, per-run
budget flags, and any gateway-side authority, retry or recovery behaviour.

## Lock record

```yaml
id: arcnexus/cli-gateway
stage: locked
revision: 3
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 3: `--simulate` restored as a delivered option by the architect. Simulation keeps
    mode, so retiring its selector would leave a lifecycle with no way to reach it; it now selects
    the evidence-package collaboration provider rather than a fake GitHub. The rejected-option list
    loses it and the retired-command table no longer covers it.
  - revision 2: added `inspect` as the activity-context preview on the live generator;
    moved per-command options onto their commands and kept only `--json`, `--help` and
    `--version` global; folded `plan show` into `task status` under the one-fact-one-command
    rule; foreground `task run` prompts at gates while `--async` never does
  - revision 1: proposed in #346 with three open questions, all since answered by the architect
```
