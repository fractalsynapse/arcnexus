# Execution plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Run one host process and one activation at a time per project. A registered
launcher may start the trusted Host composition inside a project-specific
container under the approved gateway deployment. Resolve the assigned image
from trusted deployment configuration. Record its exact identity and use it
for recovery unless an approved runtime adoption replaces it. Preserve native
confinement, isolated project worktrees and credentials, and the single writer.
The caller, imported project files and installed toolchain cannot grant new
operation permissions or select an unapproved runtime. Prepare one
issue-linked task branch from its recorded staging base and one private worktree
per attempt before any steward milestone runs, using the issue selected by
Direction. Director-requested research before plan acceptance uses the same
read-only source as planning. Research uses the existing sequential lane and
can invoke only its mapped read-only project tools. The execution provider controls built-in web access. All milestones contribute in order to the same branch. Record each activation outcome,
attribution and evidence. Commit checked changes and push an issue-linked checkpoint
through Collaboration before advancing. An unchanged activation records an event. Assemble one candidate by snapshotting the
goal worktree. Refuse a stale edit, mismatched worktree or ownership conflict and
retain enough evidence to diagnose it.

Use the architecture-model request builder for both inspection and Codex activation.
Bindings select the harness and operations. Bubblewrap confines operations on the
host. Local MCP mediates all agent-initiated project operations. Direct shell and
unmapped invocation are unavailable. A checked edit touches exactly one file,
retains its checkpoint and receipt before acknowledgment, and is the only agent
write path to maintained source. Resolve
current-Step and owner authority, reject unsafe aliases and stale hashes, and
refuse all attempts to modify locked contracts or the registry. Changes to captured project authority require the architecture proposal route. Credentials and
upstream mutations stay with trusted host services. Checks report actual exits and
logs. Detect stalls from progress. Cancellation stops descendants, retains the task
branch, checked edits and evidence, and records one result. After preserving
checked edits, remove the task-owned worktree on termination. On restart reconcile
the retained branch, checkpoint and any abandoned worktree before activation. No application work budget
or special recovery process participates in this path.

Tool refusals and operation failures return the exact exit, diagnostic and log to
the calling activity together with retained successful receipts. Ownership refusal
does not revoke earlier edits or grant foreign scope. A repair preserves the issue,
branch, checkpoint and complete clarification or research answer. Workflow may
rewind within the same milestone; Execution enforces the selected activity's
approved model version, resolved operations, parameters and ownership. Only the
recorded host adoption boundary can advance that version during a run.

Applicable component checks are selected from declared operations by category and
applicability, including formatting, lint, types/build and relevant tests. The
absence of a test suite does not skip other applicable checks. Read-only checks
never reformat source, and all automatic fixers stay within captured write scope.
Host-required assembled checks remain independent acceptance requirements. Required
applicable activity verification runs before progression, using its resolved
operation parameters. Expected-red evidence identifies the intended failed assertion
and does not excuse unrelated operation failures. Changed relevant parameters,
inputs or environment invalidate the affected evidence.

Native/provider observations are declared Execution-owned operations using the
configured real provider and existing request builder and confinement lifecycle.
Retain the request, actual result, versions, configuration, command and logs as
immutable evidence. A model claim alone is not an observed native result. Retain
the exact activation request and configuration and all exposed harness events,
messages, tool calls/results, errors, usage and process diagnostics as they arrive.
Correlate them with local MCP effects in the existing journal/evidence path and
forward ordered observations during execution. Preserve raw unknown events and
explicitly identify unavailable provider fields. Record timing and reported tokens
overall and per execution profile, including its actual model/settings. Missing
usage is unknown, not zero; subset usage and nested durations are not added twice.
Cost estimates name their verified pricing source and effective basis. Retain
complete artifacts and expose authorized read-only access to acting agents.
Measurement never introduces a work budget, content cap or automatic profile change.

The only protected-source write exception is Architecture's trusted host
application of an exact human-approved proposal. It is separate from model
checked edits. At admission or an approved in-run adoption boundary, validate
available handlers and any updated runtime, then revalidate retained work against
the approved model before its next activation. Preserve original goal acceptance,
checkpoints and failed observations; a candidate cannot authorize that transition.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| EX-1 | A checked edit inside the owner's scope applies and records the change with its before and after digests. |
| EX-2 | The same edit against a stale expected hash is refused naming the file, and nothing is applied. |
| EX-3 | An edit to another owner’s path returns the refused path and captured owner to the requesting steward in the same run. An explicit supplier request is sequenced by Direction and grants no additional authority. |
| EX-4 | Checked edits to a locked file or the registry are refused in a product run, with the lock named. |
| EX-5 | A symlink, alias or hardlink anywhere in the workspace, target path or evidence path is refused. |
| EX-6 | `activate` produces byte-identical context to `inspect` for the same revision, component, activity and milestone, apart from declared placeholders. |
| EX-7 | Two activations in one project cannot overlap; the second is refused while the first holds the lane. |
| EX-8 | Cancellation during a running operation stops the process group, leaves no orphan, and produces one terminal event and one terminal state. |
| EX-9 | An activation with no observable progress is reported as stalled with its last evidence; no budget ever terminates healthy work. |
| EX-10 | Every executed operation yields command, cwd, exit, duration and log path in evidence; a skipped check reports as skipped. |
| EX-11 | All milestones use one issue branch and one clean worktree per attempt. Retry reconstructs it from the verified checkpoint. A worktree bound to a different task or base is refused before activation. |
| EX-12 | `snapshot` distinguishes staged, unstaged and untracked changes, and reverting a working file does not hide a staged edit. |
| EX-13 | Two sequential owners contribute authorized edits to the same worktree and one candidate retains both attributions. |
| EX-14 | An attempted edit across owner scope or against stale content is refused before it changes the worktree. Prior successful files and refusal evidence survive, and the steward can correct the refused request without rewriting those files. |
| EX-16 | The local MCP boundary refuses an unmapped operation, invalid arguments or an unmet prerequisite before execution and records the reason. Native shell is unavailable. Built-in web access follows the execution provider policy. |
| EX-17 | Restart reads the retained position without a separate recovery service or host process. A completed checkpoint survives worktree cleanup. An identical checked edit request returns its retained receipt without repeating the write. |
| EX-18 | Each activation records its resolved profile/model/settings. A profile change during a task requires an approved model adoption boundary and cannot be inferred from usage measurements or a model request. Historical activations retain their actual profile. |
| EX-20 | Planning a step under one activity and attempting it after a later bucket has opened is refused, and the refusal names the open earlier items; reordering the same plan into canonical buckets runs unchanged. |
| EX-21 | An activation whose every bucket is closed while a criterion of the goal is unmet is recorded as failed, and no checklist state can mark it accepted. |
| EX-19 | Two lanes for two different projects can exist in one process without interference: the lane is obtained per project, holds no process-global mutable state, and neither activation observes the other's workspace, store or evidence. |
| EX-22 | A failed operation resumes its caller with exact diagnostics and retained receipts. A successful checkpointed file and a complete answered question are reused after restart without another write or prompt. |
| EX-23 | A component with no suite runs its other applicable declared quality checks. A real lint or type failure reaches its accountable activity before progression; assembled checks remain required. |
| EX-24 | A declared native observation uses the configured real provider through production assembly and records its actual request, versions, result and failure logs. It cannot silently substitute simulation or another profile. |
| EX-25 | A retained checkpoint survives an approved architecture update. At admission or an approved activity-boundary transition in the same run, revalidate ownership, resolved operations, original acceptance and affected evidence before resuming. Unavailable handlers and candidate-side authority edits cannot enable adoption. |
| EX-26 | A real activation exposes messages, tool calls/results, progress, timing and available usage before completion, with complete raw evidence. Interrupted output and unknown provider events remain readable and attributable. |
| EX-27 | Required applicable activity checks use the resolved parameters and run before completion. A failed check returns its exact result to the accountable caller; missing suites do not skip other checks and disabled native tests cannot establish a native pass. |
| EX-28 | Run and profile totals reconcile to underlying observations, distinguish missing usage and estimated cost, and avoid double-counting nested timing or token subsets. Agents can read authorized complete run evidence without gaining write or approval authority. |
| EX-29 | A registered launcher starts the approved image for the verified project. The Host enforces the same captured activity and native confinement rules; an image mismatch or revoked provider prevents execution. |
| EX-30 | Replacing an interrupted Host with the captured image recovers its retained position and reconciles uncertain effects before continuing. The journal retains the original image identity and complete evidence. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

EX-15
