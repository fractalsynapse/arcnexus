# ArcNexus CLI application

This application will mount trusted Cordis plugins and adapt terminal arguments,
progress, cancellation and exit codes. The [CLI gateway contract](contract.md)
defines the operator surface. The application owns CLI composition tests and any
scripts specific to its executable. The adapter uses the transport-neutral
[Commands SDK](../../packages/commands/contract.md).

The [Agent proposal](../../packages/agent/contract.md) defines the common inspection
and activation interface for this application.

The first executable proof exercises the same composition an operator runs.
Inspection renders the request builder's output. A real task uses that builder
for Codex, makes a checked change in its private worktree, and reports the
provider-observed staging result.

## Inspect an Agent

Run from a configured Git checkout or any directory inside it. Both arguments
are required.

```sh
arcnexus inspect agent testing
arcnexus inspect director planning
arcnexus inspect reviewer assessment
```

After `npm run build`, run the built entry directly with
`node dist/apps/cli/src/index.js inspect <component> <activity>`.
Inspection reads the committed project revision, resolves the selected activity,
and displays the complete multiline prompt from the Architecture builder. The
header lists invocation options and unavailable task fields, including `<goal>`.
Each placeholder appears where its value belongs in the prompt or invocation
options. The prompt shows the selected activity's instructions and scope and
references contracts by ID, path and stage. Section labels identify their source
files or task inputs. Codex discovers project `AGENTS.md` files and skills at
activation. The [gateway contract](contract.md) defines the observable behavior.

Add the general `--json` option for a structured result with the same prompt in
`request.input`. Place it before the command or after the activity.

```sh
arcnexus --json inspect director planning
arcnexus inspect reviewer assessment --json
```

## Run a task

`arcnexus task run "<goal>"` submits one goal for the project resolved from the
working directory. The [Commands SDK](../../packages/commands/contract.md)
passes structured input, progress and cancellation between the caller and
[Workflow](../../packages/workflow/contract.md). Direction owns planning and
corrections, and Verification obtains the independent Reviewer verdict.
The task succeeds when Delivery reports an observed staging merge.

Run from a clean checkout at the captured staging head. Install the project
dependencies there. The host uses Git, authenticated GitHub CLI, Bubblewrap and
the executable in the project's local `tools.codex` binding. For the ArcNexus
catalog that binding is `.git/arcnexus/bindings.yaml`. Set `schemaVersion: 1`
and an absolute `tools.codex` path to an authenticated Codex installation.

See [Native confinement checks](../../docs/release/ci.md#native-confinement-checks)
for the test command and default CI skip behavior for the Bubblewrap test.

The host keeps task metadata, output, and the active worktree outside the
source checkout under `${XDG_STATE_HOME:-$HOME/.local/state}/arcnexus`. Codex
uses the current activity's mapped local MCP tools for project reads, checked
edits and declared owner checks. Each `checked-edit` call touches exactly one
owned file and checks its current complete-file digest. Execution retains the
checkpoint and durable receipt before acknowledging success; the receipt
identifies the file and its before and after digests. An identical request
returns the retained receipt without repeating the write. The host runs
captured checks in a disposable networkless overlay. See the
[local MCP operations guide](../../packages/execution/docs/mcp-operations.md)
for Execution EX-1, EX-14, EX-16 and EX-17.
In JSON mode, progress uses stderr and the outcome is one JSON object on stdout.

For a terminal clarification (CLI gateway GW-19), enter the complete answer
across as many lines as needed, preserving blank lines. Finish with a line
containing only a period. The host records the full answer as evidence and
resumes the requesting activity with it; independent review receives a protected
reference to the original question and answer.

If a Director proposal fails validation, ArcNexus records the diagnostic and
asks the Director for one correction within the same task. The host validates
the corrected proposal before advancing and preserves any accepted work.

A malformed steward reply gets one repair in the same activity, with the exact
diagnostic and retained transcript. A refused checked edit returns its diagnostic
in the same run and preserves earlier successful edits, checkpoints, receipts
and refusal evidence. Correct only the refused request within existing authority:
reread a stale file digest, correct an erroneous owned path, or use
`request-supplier` through Direction for another owner's contribution. A refusal
grants no additional authority; confirmed edits need no resubmission.
When the installed project formatter is available, a steward can request exact
text substitutions and formatter output in a checked edit. Execution computes
the bytes inside confinement and checks the original file hash before applying
them.

When a steward check exits unexpectedly, Direction schedules a correction for
the same owner. The correcting steward receives the exit status and retained
log. Correction assignments also carry the exact supplier or independent review
finding that caused Direction to add the milestone. The host refreshes any
assembled checks explicitly requested by that finding against the current checkpoint.
If a steward repeats one of those host-selected checks with a passing expectation,
Execution keeps it in the host check path.
It reruns the original steward check before the paused activity resumes. The
independent Reviewer receives the owner check records and can tell which ones
were observed after the candidate's most recent edit. A rejected tree can
return to independent review when its verified owner evidence changes. A
repeated tree and evidence combination stops the correction.

If publication is interrupted, invoke `task run` with the identical goal.
ArcNexus resumes from the verified candidate and observes GitHub before taking
another publication action. A matching remote branch, pull request or merge is
reused. A known transient GitHub read error gets a bounded retry in the active
task, including the observation after a merge. See [Publication recovery evidence](../../docs/release/verification.md#publication-recovery-evidence)
for what to compare in the retained task evidence.

## Optional research

During a task, the Director, Reviewer and stewards can use the Research inbox
when external evidence could change a decision. The task resumes the same
activity with a source-linked report or an unavailable observation.
See [Research inbox recovery](../../packages/execution/README.md#research-inbox-recovery)
for report replay after interruption and the shared sequential lane.
`arcnexus inspect <component> research` previews the research activity.
Before running a task, use `arcnexus inspect <component> documentation` to see the
optional research inbox and archived report index in the ordinary activity's context.

Reusable reports stay available to that component's editing stewards. An
editing steward can choose a report to archive through checked edits. The
[component research index](../../.arc/README.md#research-reports) comes from
the committed reports.

## Run a round of standing goals

Run `arcnexus task run` without a goal to evaluate the project's captured
[goal inventory](../../.arc/goals/). Markdown frontmatter supplies the numeric
priority. Requirements and observed measures are in the Markdown body. Lower
priorities run first, with stable file IDs breaking ties. An interrupted round
keeps its original goal inventory. The Director evaluates each goal on the
current staging revision, citing captured evidence or planning the steward work
and checks needed to establish the outcome.

Direction opens or reuses the issue after the plan is accepted. Execution
prepares the issue branch and private worktree before the first steward and
checkpoints checked edits on the issue branch after activations. Retry an
interrupted engineering task with the same goal, or invoke bare `task run` again
to continue the unfinished round. The task's locally recorded evidence and
verified checkpoint survive worktree removal.

Resumed activities can read earlier evidence for the same task. The host
provides self-review a diff against the captured staging base.

## Map goals and record objectives

Use `arcnexus task plan` to rate all standing goals for project alignment and
evidence. The report links findings to the captured revision. Use
`arcnexus task plan "<objective>"` to submit and preserve the exact text. If the
Planner needs clarification, answer at the terminal or rerun the exact
submission to continue.

To refine a previous objective, begin the submitted text with
`Refines <full objective record ID>` on its own line. The record ID is the
filename without the `.md` extension. The new submission retains the original
objective identity and links to the preceding record. An unresolved objective
can be recorded while its goal mapping stays open.

Planner reports source alignment and revision-bound run observations in its
mapping. Goal files express requirements and success measures. Observed checks,
review and staging delivery stay in the task journal and its protected artifacts.

The gateway displays the exact proposed goal changes for approval. Reply
`approve` to authorize the shown bytes, or `skip` to keep the current inventory.
The submitted objective can be recorded in either case. Approved Markdown
changes pass through checked edits, candidate checks, independent review and
verified staging integration. Use `--json` for the structured result and artifact
locations.
