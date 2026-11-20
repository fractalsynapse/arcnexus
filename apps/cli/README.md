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
The shared long-running output contract is ordered JSONL observations followed by
one terminal result on stdout; stderr carries diagnostics and interactive prompts.
The existing task renderer already emits typed progress, event, measurements and
result records. Refinement will use that same observer and cancellation path,
as described below.

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

## Assess architecture

`arcnexus architecture update` assesses approved objectives and goals, current
architecture and implementation, and retained execution findings. Add a quoted
feedback argument to focus that assessment. The command uses the captured
`project.architect` activity and the same optional research and human-question
path as other agents. `--json` retains the normal structured output convention.

A justified no-change result records its source citations. A proposed batch
shows its purpose, consequences, prerequisite outcomes, exact baseline and full
diff, including derived registry changes. Enter `approve` or `skip` at the durable
human gate, followed by a line containing only a period. Noninteractive execution
reports a pending decision; rerunning resumes its exact retained proposal.

After approval, the ordinary Director and steward workflow handles prerequisites.
The host applies only the approved guide bytes to the same candidate before
assembled verification, independent review and staging delivery. Model checked
edits retain their protected-source refusals. Changed intent, bytes or baselines
require renewed approval. See the [Architecture application](../../packages/architecture/README.md).

## Refine the project

The following is approved implementation intent for
[the refinement work](https://github.com/fractalsynapse/arcnexus/issues/615),
under CLI gateway GW-29 through GW-32. At this documentation step, the CLI
dispatcher does not yet expose `refine`; these examples describe the accepted
surface to implement, not demonstrated runtime availability.

```sh
arcnexus refine
arcnexus refine --rounds 2
arcnexus --json refine --rounds 2
arcnexus refine --rounds 2 --json
arcnexus refine --json
```

There are no positional arguments. Omit `--rounds` for one round, or supply it
once with a positive integer written as decimal digits. Zero, negative values,
fractions, exponent notation, missing values, extra positionals, duplicate options
and unsupported options are input errors. The general `--json` flag is accepted
once before the command or at the end of its arguments. For example,
`refine --json --rounds 2` and `refine --rounds --json 2` are misplaced.
Input errors produce a stderr diagnostic, exit 2 and empty stdout before host
admission or provider access. Do not impose a safe-integer ceiling or another
resource cap on the requested round count.

Each round runs Plan, Architect and Run in sequence. Planner and Architect assess
again each round and can justify no change. After those phases, Run captures the
approved goal inventory and invokes Direction for every goal in priority order,
including goals with passing measures. Work follows the ordinary steward,
independent Reviewer and verified staging delivery path. An interrupted Run keeps
that exact inventory; the next round captures a fresh one.

The CLI passes structured rounds, observer and cancellation inputs through
[Commands](../../packages/commands/contract.md).
[Workflow](../../packages/workflow/contract.md) owns sequencing, admission,
cleanup and recovery. One Coordination project writer remains held throughout
the foreground invocation; sequential phase and goal sessions share it as children.
A competing foreground root is refused with exit 2. Standalone `task run`,
`task plan`, `architecture update` and `inspect` retain their public paths.
The terminal adds no scheduler, lock store, state database or private task loop.

Human output identifies the current round and phase as work proceeds, with the
acting component/activity, operations, outcomes and evidence references. JSON mode
streams the same ordered typed phase, provider/tool, progress and measurement
observations, then exactly one terminal result for the invocation. Child outcomes
remain observations inside that stream. Complete originating messages, tool
results, findings and answers remain emitted or available through authorized
evidence references; the renderer adds no previews or truncation. Stderr prompts
and diagnostics never become plaintext in JSONL stdout.

| Exit | Meaning |
| --- | --- |
| 0 | All requested rounds completed, with every captured goal assessed or delivered. No-change assessments can complete without a new merge. |
| 1 | An admitted invocation failed, awaits a human decision or has an external prerequisite hold. Its durable position and evidence remain available. |
| 2 | Invalid or unavailable input, changed requested total for an unfinished invocation, or refused competing foreground admission. |
| 130 | Foreground SIGINT cancellation, after normal preservation and cleanup. |

For an objective, goal or architecture gate, review the complete retained proposal
and baseline. Interactive answers use the multiline terminal form above; approval
applies only to the shown proposal. Noninteractive input or EOF leaves an
unanswered gate durably pending with exit 1 and its question/evidence reference.
Silence, an unknown response and elapsed time never approve it. A decline retains
the submitted intent and accepted authority. Routine repair, checks and verified
staging integration add no human gate.

After a pending decision, interruption or recoverable failure, rerun the exact
command, including its requested total. For example, retry
`arcnexus refine --rounds 2` with the same command to resume its first unfinished
phase or goal; retrying it as bare `refine` requests one and is refused while the
two-round invocation remains unfinished. Completed phases and goal outcomes,
exact proposals, approvals, complete answers, file checkpoints, issues, branches
and PRs survive. Workflow reconciles uncertain effects and reuses an observed
successful child if its parent did not yet record completion. Do not repair the
database or submit a replacement task. Once all requested rounds finish, the
same command starts a fresh invocation with new phase and goal identities.

SIGINT uses the existing SDK signal path. The host preserves acknowledged work
and evidence and cleans its managed worktree; cancellation does not imply success.
A later invocation resumes the retained position. Each phase/task admission uses
freshly accepted staging authority, retaining the approved in-run adoption
boundary and original task acceptance/ownership. The host records the runtime
actually used; resuming on a validated newer installed runtime retains progress.

The readable round report lives outside source alongside existing retained
evidence. It references phase assessments, exact guide decisions, goal outcomes,
issues/PRs, checks, recovery events, source/runtime identities and delivered
commits. The observer supplies elapsed time and provider-reported token usage
overall and by execution profile; missing usage, pricing and cost stay unknown.
Subsequent Planner, Architect and Director assessments receive prior findings and
measurement references as observations through the existing evidence path.
Historical results do not belong in objective or goal files.

### Acceptance evidence to obtain

A built CLI scenario with two rounds and distinguishable phase/goal observations
must show Plan, Architect and every captured goal in order for both rounds,
with human round/phase visibility or parseable JSONL arriving before the sole
terminal result. Invalid argument cases must prove exit 2, empty stdout and no
admission. Process-level cancellation and pending-input cases must demonstrate
the shared SDK path and documented exits; retry must preserve the unfinished
position rather than replay completed work. Existing task/publication regressions
cover preserved machinery. Controlled fixtures establish deterministic behavior,
not live model acceptance or actual GitHub delivery.

The separate final live acceptance is the production command
`arcnexus refine --rounds 3`: three consecutive rounds assessing every approved
goal, useful approved guide and code refinement, and later consumption of prior
findings without operator candidate edits, database repair or uncontrolled aborts.
This documentation and deterministic CLI scenarios do not satisfy that streak.
