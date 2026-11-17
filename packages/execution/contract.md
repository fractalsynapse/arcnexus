# Execution plugin contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Run one host process and one activation at a time per project. Prepare one
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
| EX-18 | A profile substitution made before admission is captured in evidence. It cannot broaden the operation authority or change the profile during a task. |
| EX-20 | Planning a step under one activity and attempting it after a later bucket has opened is refused, and the refusal names the open earlier items; reordering the same plan into canonical buckets runs unchanged. |
| EX-21 | An activation whose every bucket is closed while a criterion of the goal is unmet is recorded as failed, and no checklist state can mark it accepted. |
| EX-19 | Two lanes for two different projects can exist in one process without interference: the lane is obtained per project, holds no process-global mutable state, and neither activation observes the other's workspace, store or evidence. |

## Deferred

The preceding accepted revision records these scenarios. They are outside first-build qualification.

EX-15
