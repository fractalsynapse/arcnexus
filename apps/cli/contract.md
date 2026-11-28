# CLI gateway contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

The CLI app owns terminal input, output and exit codes. Its Cordis adapter
delegates structured inspection, ownership audit and task operations to the shared
[Commands SDK](../../packages/commands/contract.md). The CLI exposes
`arcnexus inspect <component> <activity>` and `arcnexus task run "<goal>"` for
the project resolved from the working directory. Bare `arcnexus task run`
loads one round from the project goal inventory and evaluates each goal in priority
order through the same task service. The CLI delegates these Plan forms through
Commands using the shared progress, cancellation and output contract:

- `arcnexus task plan` assesses the captured project and standing inventory.
- `arcnexus task plan "<objective>"` preserves the exact human submission and
  offers resumable clarification and objective review.
- `arcnexus task plan --recommend-objectives [<focus>]` recommends objectives
  from captured documentation. Project documentation directories guide default
  discovery. Focus can select other authorized sources at that same revision.
  Duplicate flags, extra positional arguments and blank explicit inputs are
  rejected before admission.

Plan retains exact human decisions on objectives. Authorized objective wording
feeds goal alignment in the same admitted session. Both kinds of guide changes
use checked edits, independent review and verified staging. Goal changes proceed
without a human approval prompt.

`--json` is a general CLI output option, accepted once before the command or
after its positional arguments. Inspection and ownership audit each print one
structured JSON result on stdout. Long-running task, planning, architecture update
and refinement commands stream ordered JSONL observations on stdout followed by a
typed terminal result record.
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
Human approval concerns objectives and architecture. Ordinary tool repair,
implementation, checks, plan sequencing and authorized staging delivery do not
require human approval. Unavailable external prerequisites remain observable holds;
they are never treated as approval to proceed.

Exit 0 represents the verified staging merge for a single goal, or a completed
round in which every goal has a Director assessment supported by evidence for the
evaluated revision or a verified merge. The Director can plan applicable checks
through the existing activity mappings. Assembled-candidate checks remain required
for changes. A completed mapping or an already recorded objective may exit 0
without a new staging merge. Missing project setup is reported as a prerequisite.
Exit 1 represents a failed or blocked run, exit 2 invalid or unavailable input,
and exit 130 cancellation. Refuse a second active task in the same project.
`arcnexus architecture check-ownership` is an available command with the separate
read-only audit output and exit meanings defined below. Other verbs, option modes
and launch surfaces are reserved for later qualification.

The Data SDK, a platform-bound CLI mode, OpenAPI and MCP gateways, and registered
Host launchers may be implemented and verified against isolated test projects
and stores. Operator-facing activation for real projects remains subject to
the existing live qualification requirement. An enabled network adapter
forwards its authenticated project scope to the same Data and Commands services.
It preserves argument meaning, admission, durable human approvals, cancellation,
and outcomes. Terminal output and exit codes remain the responsibility of CLI.

`arcnexus architecture update [<feedback>]` assesses the approved guides, captured
architecture, implementation and relevant prior observations. Feedback focuses the
assessment. A no-change assessment can complete without a merge. Proposed changes
show a purpose, consequences and exact diff for human approval. Required
implementation is delivered within the Architect phase before Run begins.

`arcnexus refine [--rounds <N>]` runs standing-inventory Plan, Architect and then
every goal in the verified inventory, in priority order for each round.
N defaults to one and must be a positive integer.
Every round invokes Planner, Architect and the Director for each goal, even when
existing measures pass. Accepted no-change outcomes are valid. The general
`--json` option applies to both commands. A complete refinement invocation exits 0;
pending approval or an external prerequisite exits 1 without losing its cursor.
Approval pauses retain the exact proposal and resume the same phase and round.
A later invocation resumes unfinished refinement before starting new rounds;
changing the requested total while that invocation is unfinished is refused.
No answer, an unknown response or elapsed time supplies approval.

## Working-tree ownership audit

`arcnexus architecture check-ownership` audits the Git project's current
working-tree ownership declarations. It accepts no positional arguments after
`check-ownership` and no command-specific options. The general output option permits
exactly these forms:

- `arcnexus architecture check-ownership`
- `arcnexus --json architecture check-ownership`
- `arcnexus architecture check-ownership --json`

The CLI passes its current working directory to `Commands.checkOwnership(directory)`.
Commands delegates to the public Architecture service for repository discovery,
project identity validation, Git inventory and ownership rules. Invocation from a
nested project directory resolves the same repository as invocation from its root.
The audit uses working-tree catalog declarations and the complete inventory of
tracked paths and nonignored untracked paths supplied by Architecture. It does not
require a clean working tree or substitute committed declarations for candidate
working-tree declarations.

Human mode prints the resolved source identity, complete audited path inventory
and every finding on stdout. Source identity includes the working-tree kind,
repository root, remote and HEAD revision. Each unowned finding identifies its
complete path. Each collision identifies its complete path and every colliding
owner identity. Paths and owner identities must remain unambiguous, including
when their text contains whitespace or control characters. A successful audit
with no findings explicitly reports that no ownership findings were found.

JSON mode prints one JSON object containing the complete SDK audit result,
including `source`, `paths` and `findings`. It is not a task observation stream.
The CLI preserves the SDK's fields, path inventory, finding order and owner order
without filtering, truncation or summarization. Each `unowned` finding retains
its `path`; each `collision` finding retains its `path` and complete `owners`.
Human mode preserves the same information and order. The HEAD revision identifies
the repository's HEAD, not a claim that mutable declarations or untracked paths
are committed there. Neither representation declares candidate architecture
approved or adopted.

A completed audit exits 0 when `findings` is empty and exits 1 when it contains
any findings. Both outcomes print the complete audit result on stdout and leave
stderr empty. If discovery, project validation or audit execution fails, the CLI
exits 1, prints the service diagnostic on stderr and leaves stdout empty. An
invalid project or declaration must not become an empty successful result.
An unavailable command handler is exit 2 with a stderr diagnostic and empty
stdout; recognizing the spelling alone cannot produce a successful audit.

Missing command words, extra positional arguments, unknown options, duplicated
`--json` or a `--json` between command words are refused with exit 2, a stderr
diagnostic and empty stdout. Parsing finishes before dispatch, project service
invocation or task admission. For example,
`arcnexus architecture --json check-ownership` and
`arcnexus architecture check-ownership extra` are input refusals.

Discovery and auditing are local and read-only. They do not change project source,
the Git index, catalog declarations or active captured authority, and do not admit
a task, acquire the task lane, create a worktree, write durable task state,
activate a provider or contact an upstream service. The audit asks no questions
and has no approval or resumable task lifecycle. The foreground task cancellation
and recovery obligations above continue to apply to task operations; auditing
does not start such an operation.

These obligations define the intended CLI capability. Contract approval alone
does not establish implementation or qualification. Delivery evidence must
exercise the actual CLI built from the assembled candidate against real temporary
Git projects, identify that candidate's revision and actual built entry point,
and demonstrate the scenarios below. An installed command from the Host image
cannot establish delivery of this candidate's CLI.

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
| GW-19 | Objective and architecture review retain the question, exact proposal and human answer. Goal changes and routine technical repairs proceed through applicable checks without a human approval prompt. Unavailable external prerequisites remain named holds. |
| GW-20 | `inspect` with an unknown component or an activity outside the declared set is exit 2 naming the valid values. |
| GW-22 | Inspection, ownership audit, task execution, goal planning, architecture updates and refinement delegate through the same structured SDK available to in-process callers. The CLI alone translates terminal arguments, progress, questions and results into its transport. |
| GW-23 | Bare `inspect`, an invocation with only one positional argument, and an invocation with extra arguments each exit 2 without effects. |
| GW-24 | `inspect director planning` and `inspect reviewer assessment` resolve the captured special actor bindings. `inspect direction planning` remains a valid component and activity selection. |
| GW-25 | Inspection prints the full ordered context and request from the activation builder. With matching inputs the payload matches the Codex adapter's input. Before admission it prints `<goal>` and names unavailable task-only values. |
| GW-26 | Both permitted placements of `--json` return the same structured inspection result. Its `request.input` equals the default rendered prompt. Duplicate or misplaced flags exit 2 with stderr diagnostics and empty stdout. |
| GW-27 | Bare `task plan` maps the captured project. Explicit `task plan "<objective>"` retains its verbatim submission and can resume a clarification. Recommendation mode reads the captured sources and resumes the exact objective review. Authorized wording feeds goal alignment and resulting changes enter reviewed delivery. |
| GW-28 | Both architecture update forms assess through the same SDK and return a no-change result or an exact proposed diff. Approval and required prerequisite delivery complete before the following Run phase. |
| GW-29 | refine defaults to one round and accepts a positive integer --rounds value. Invalid, duplicate or unsupported arguments exit 2 before admission. Every completed round runs Plan, Architect and all captured goals in priority order. |
| GW-30 | Interrupting a refinement phase or awaiting approval retains its identity and cursor. The same invocation resumes without replaying completed phases, losing answers, repeating edits or creating a duplicate PR. Changed round totals are refused while it is unfinished. |
| GW-31 | Human and JSONL task modes display observations before completion from the same structured observer. JSONL stdout contains only typed event/result records in order; inspect --json remains one result and exit semantics remain unchanged. |
| GW-32 | A running task exposes actor/activity, operations, elapsed time and available profile-level usage/cost with evidence links. Cancellation and restart preserve the recorded timeline and unknown measurements are not reported as zero. |
| GW-33 | An authorized CLI or MCP command and the matching API operation use the same scoped application service. A gateway disconnect preserves the active command, and reconnect resumes its retained ordered observations. |
| GW-34 | The actual built CLI delegates `architecture check-ownership` through Commands composed with the public Architecture service. A real temporary Git project with unique ownership coverage prints its complete audit and exits 0. Both permitted --json placements produce the same single structured result. Evidence identifies the assembled candidate revision and actual built entry point. |
| GW-35 | An audit containing uncovered tracked and nonignored untracked paths exits 1 and reports every path. Working-tree catalog collisions are audited even when the committed catalog differs; each collision reports all owner identities. Human and JSON output preserve the complete inventory, source identity and findings supplied by Commands, including coexisting uncovered paths and collisions. |
| GW-36 | Root and nested-directory audit invocations resolve the same project. Source, Git index and catalog remain unchanged, active authority is not adopted from the candidate, and there is no task admission, task-lane acquisition, durable task write, worktree creation, question, provider activation or upstream effect. |
| GW-37 | Missing command words, extra positionals, unknown options and duplicated or misplaced --json exit 2 with stderr diagnostics and empty stdout before audit dispatch or admission. An unavailable handler reports unavailability rather than simulated success. |
| GW-38 | Discovery, invalid project or declaration, and audit execution failures exit 1 with the service diagnostic on stderr and empty stdout. A completed audit with findings instead retains its complete result on stdout; neither condition is converted into a clean audit. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

GW-4, GW-8, GW-9, GW-10, GW-12, GW-13, GW-14, GW-21
