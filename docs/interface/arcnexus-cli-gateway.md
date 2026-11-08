# Gateway contract — ArcNexus CLI

Type contract: `gateway`. Stage: **proposed**. Owner: `cli`.
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

### 1. Delivered commands (MVP surface)

```text
arcnexus task run [project] "<goal>" [--async] [--json]
arcnexus task status [goal-id] [--follow] [--json]
arcnexus task stop [goal-id]
arcnexus task answer <goal-id> "<response>"
arcnexus plan show [goal-id] [--json]
arcnexus component list [project] [field=value ...] [--search <text>] [--limit <1-100>] [--cursor <token>]
arcnexus component get <project> <id> [--json]
arcnexus standard list <project> [field=value ...]
arcnexus standard get <project> <id> [--json]
arcnexus test inspect [project] [--component <id>] [--level unit|integration|acceptance] [--tag <tag>] [--json]
arcnexus test run [project] [component] [--level <level>] [--tag <tag>] [--json]
arcnexus validate [project] [--json]
arcnexus evidence get <id> [--offset <n>] [--length <n>] [--json]
```

`task run` means: pursue this goal until it is met, released and verified, or until it is
stopped. `task status` and `plan show` read the same generated plan; `plan show` renders the
milestones, Steps, checklists and status, `task status` renders the run position. `validate`
is the document, architecture and ownership check a caller runs before delivery. `evidence get`
reads retained records by id with bounded ranges — historical data stays readable without any
executable adapter.

### 2. Reserved names

Fixed now so nothing invents them later. They are refused as *not available in this build*
with exit `2`, never repurposed:

```text
arcnexus workday start|stop|status        # self-directed loop on the same plan machinery
arcnexus project show|configure           # replaces platform and package management
arcnexus release verify                   # verify-release against CI/CD and deployment
arcnexus delivery status                  # read-only view of a published candidate
```

### 3. Retired commands

Removed, each with a one-line pointer to its replacement in the refusal message:

| Retired | Replacement |
| --- | --- |
| `platform` and `package` create/update/remove/migrate/list/get | `project` vocabulary; `component` and `standard` reads |
| `config get/update/migrate` | bindings file under the project contract |
| `workspace prepare/cleanup/list/get` | runtime-managed; read through `evidence get` |
| `delivery approve/publish/promote` | human gates answered through `task answer`; release stage later |
| `experiment inspect`, `--simulate` | deferred simulation lane; its isolation invariant stays tested |
| `task pause`, `task resume` | `task stop` then a new `task run` reading the recorded position |
| `task list/get/follow/inspect`, `workday list/get/history/follow/inspect` | `task status`, `plan show`, `evidence get` |
| `inspect <component> <objective>`, `guidance validate`, `run` | folded into `validate` and `test run` |

### 4. Accepted options

`--json`, `--follow`, `--after`, `--limit`, `--cursor`, `--search`, `--component`, `--level`,
`--tag`, `--project`, `--async`, `--offset`, `--length`, `--kind`, `--help`, `--version`.
Anything else is rejected with exit `2` naming the option and the replacement. Options that
once existed and are now gone (`--model`, `--codex-path`, `--max-attempts`,
`--timeout-seconds`, `--composition-profile`, `--execution-profile`, `--simulate`, `--issue`,
`--mode`, `--output`, `--input`, `--base`, `--write`, `--workspace`, `--bindings`, `--activity`,
`--category`, `--assignment`) are refused with a stated reason, never silently ignored.

### 5. Output contract

- Default output is a human-readable progress stream: milestone and Step transitions, check
  results with status, and the final report location.
- `--json` emits the same facts as one machine-readable object, versioned by
  `schemaVersion`, on stdout; diagnostics go to stderr in both modes.
- Artefacts are referenced by id with a size, never inlined. A reader asks for a range.
- Every check result is one of `passed`, `failed`, `skipped`, `unavailable` or `not-applicable`,
  and only `passed` supports an acceptance claim.

### 6. Exit codes

| Code | Meaning |
| --- | --- |
| 0 | verified completion or successful control action |
| 1 | blocked, awaiting a named gate, or an unsuccessful execution |
| 2 | invalid invocation: unknown or misplaced option, ambiguous or unresolved project, unavailable binding, reserved name |
| 130 | cancelled by the caller; managed execution stopped and evidence retained |

### 7. Cancellation and interruption

`SIGINT` and `SIGTERM` cancel managed execution promptly, stop subprocesses, retain the
branch, workspace and evidence, and exit `130`. There is no time, turn, call or attempt budget;
governing is by observed progress and cancellation only.

### 8. Human gates

A step only a human can complete surfaces as a question with an id. The caller answers with
`task answer <id> "<response>"`; the run then continues from the recorded position. No flag
bypasses a gate and no agent may answer its own.

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
| I8 | Unknown, misplaced and obsolete options are rejected with a reason, never ignored. |
| I9 | Reserved names are refused as unavailable, never implemented opportunistically. |
| I10 | A human caller, a steward operation and CI run the same commands with the same results. |

## Acceptance scenarios

| Id | Given / when / then |
| --- | --- |
| GW-1 | `task run "<goal>"` from a nested directory resolves the project and component, prints progress, and exits 0 only when the goal is verified and delivered. |
| GW-2 | `task run` with no goal, or with a second positional, is exit 2 and writes no state. |
| GW-3 | `task run` while another goal holds the lane is exit 2 naming the active goal; no queue row is created. |
| GW-4 | `task status` and `plan show` describe the same run: same milestones, same statuses, same evidence ids. |
| GW-5 | `task stop` cancels managed execution, retains branch, workspace and evidence, and a later `task run` reads that position instead of replaying an uncertain operation. |
| GW-6 | A gate that needs a human ends the run at exit 1 with the question id; `task answer` resumes and the answer is recorded as evidence. |
| GW-7 | `SIGINT` during execution exits 130 with retained evidence and no orphaned process. |
| GW-8 | Every delivered command's `--json` form parses, carries `schemaVersion`, and reports the same pass/fail set as its human form. |
| GW-9 | `evidence get <id> --offset --length` returns exactly the requested range and never the whole artefact. |
| GW-10 | An obsolete option (`--model`, `--simulate`, `--max-attempts`) is exit 2 with the replacement named. |
| GW-11 | A reserved command (`workday start`, `release verify`) is exit 2 reporting it is not available in this build. |
| GW-12 | `validate` reports ownership, architecture and guidance findings with paths, and exits non-zero when any tracked maintained path lacks exactly one owner. |
| GW-13 | `test run <owner>` runs only that owner's suites and reports the count; `test run` runs the full set. |
| GW-14 | The same command run by a steward operation and by a human produces the same exit status and the same evidence shape. |

## Migration

| Current surface | Change |
| --- | --- |
| 16 command modules and ~40 subcommands | 13 delivered subcommands plus 4 reserved names |
| 34 accepted options | 15 accepted options; the rest are refused with a reason |
| `needs_input` outcome and interactive clarification loop | one `blocked: awaiting <gate>` outcome plus `task answer` |
| FIFO task queue and workday pause/resume coordination | single lane, refuse-while-busy |
| `platform`, `package`, `config`, `workspace`, `delivery`, `experiment`, `inspect`, `guidance` commands | retired as above |
| inline catalog and evidence in output | bounded references by id |

Migration is one batch with the Project contract: retire the command families and their option
parsing in the same change that removes platform and package, so no intermediate build offers
both spellings.

## Non-goals

HTTP, MCP and React adapters over these services (later gateways on the same application
functions), a daemon control surface, an interactive terminal UI, per-run budget flags, and any
gateway-side authority, retry or recovery behaviour.

## Open questions for the architect

1. **Busy lane.** I proposed refusing a second goal (I3/GW-3) instead of queueing. Queueing
   was part of the current design; refusing is one less state. Which do you want?
2. **`--async`.** Kept because a long goal should not hold a terminal. If you would rather the
   MVP be foreground-only, I will reserve the flag instead of delivering it.
3. **`plan show` vs `task status`.** Both read the same plan. I kept two names because one is
   about the goal and one about the run; say the word and I will collapse them into one.

## Lock record

```yaml
id: arcnexus/cli-gateway
stage: proposed
revision: 1
acceptedBy: null
acceptedAt: null
changes: null
```
