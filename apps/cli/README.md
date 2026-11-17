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
reads the worktree and returns structured edit proposals. The host applies
checked edits and runs captured checks in a disposable networkless overlay.
In JSON mode, progress uses stderr and the outcome is one JSON object on stdout.

If a Director proposal fails validation, ArcNexus records the diagnostic and
asks the Director for one correction within the same task. The host validates
the corrected proposal before advancing and preserves any accepted work.

A malformed steward reply gets one repair in the same activity. The host
returns the exact diagnostic and retained transcript before applying any edits
or running proposed checks. When the installed project formatter is available,
a steward can request exact text substitutions and formatter output in a
checked edit. Execution computes the bytes inside confinement and checks the
original file hash before applying them.

When a steward check exits unexpectedly, Direction schedules a correction for
the same owner. The correcting steward receives the exit status and retained
log. Correction assignments also carry the exact supplier or independent review
finding that caused Direction to add the milestone. The host reruns the original check before the paused activity resumes.

If publication is interrupted, invoke `task run` with the identical goal.
ArcNexus resumes from the verified candidate and observes GitHub before taking
another publication action. A matching remote branch, pull request or merge is
reused. See [Publication recovery evidence](../../docs/release/verification.md#publication-recovery-evidence)
for what to compare in the retained task evidence.

## Run a round of standing goals

Run `arcnexus task run` without a goal to evaluate the project's captured
[goal inventory](../../.arc/goals/). Markdown frontmatter supplies the numeric
priority and the component whose declared owner suite measures the goal.
Requirements and success measures remain in the Markdown body. Lower priorities
run first, with stable file IDs breaking ties. Each goal verifies the current
staging head and reuses the local Git object when available.
The Director assesses the full authored goal against current staging, recent
changes and the owner-test evidence. The Director can plan work even with a
passing suite. If the suite passes and the Director records that no work is
warranted, the round records the assessment and continues. Engineering work
uses the normal task loop and stops the round if it cannot complete.

Direction opens or reuses the issue after the plan is accepted. Execution
prepares the issue branch and private worktree before the first steward and
checkpoints checked edits on the issue branch after activations. Retry an
interrupted engineering task with the same goal, or invoke bare `task run` again
to continue the unfinished round. The task's locally recorded evidence and
verified checkpoint survive worktree removal.

Resumed activities can read earlier evidence for the same task. The host
provides self-review a diff against the captured staging base.
