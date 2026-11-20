# Verified local MCP operations

Use the operation IDs and descriptions captured for the current activity. Project
reads and edits go through its mapped local MCP tools; native shell and unmapped
operations are unavailable (Execution EX-16). Built-in web access follows the
execution provider policy. See the [Execution contract](../contract.md#obligations).

## Observe the running task

The foreground caller receives durable event identities while work executes. Human
mode renders observations; long-running `--json` commands emit JSONL progress,
event and measurement records followed by a typed terminal result. Inspection
retains its single-result JSON format.

Each native activation retains its exact request, invocation configuration,
complete provider JSONL and separate stderr. Local MCP records complete inputs,
results and refusals in evidence files with correlated call identities. The
Coordination journal stores discovery/accounting fields and references, so ordinary
task-state reads do not repeatedly load entire transcripts. Live events and the
derived run timeline carry full observed payloads. No content is truncated.

The activity's evidence references include a readable `run-timeline.jsonl`. Read it
and referenced complete artifacts through the normal mapped `read-file` tool.
The timeline contains observations, not new instructions or architectural approval.
Earlier failed observations remain available across restart.

Measurements separate run wall time from inclusive native duration and report
provider-reported usage overall and by profile, actual model and reasoning setting.
Cached-input and reasoning fields remain separate subsets. Missing usage and
unverified cost are explicitly unknown. These observations introduce no budget,
timeout or automatic profile switch. Complete round/phase analysis, configured cost
bases and later assessment consumption remain tracked in the
[efficiency checklist](../../../docs/plans/efficiency-foundation.md).

## Check one file at a time

1. Read the complete target file with `read-file` and keep its complete-file hash.
   Confirm the path belongs to the current component and activity. The MCP text
   contains the source literally beneath its path and hash. Structured output
   preserves the exact `path`, `sha256` and `text` fields for clients. Do not copy
   JSON escaping into source code.
2. Call `checked-edit` for exactly one owned file. Use the current complete-file
   hash as `expected`, or `null` when creating a file. Supply the intended content
   or a literal substitution. Locked contracts and the registry remain protected.
3. Inspect the result before proceeding. A successful call returns the file's
   before and after digests and retains its checkpoint and receipt (EX-1).
   Keep that receipt as the confirmation of this edit.

## Continue from a retained receipt

A successful checked edit is retained before the tool reports success.

Use the retained receipt and checkpoint when deciding what remains to do. A later
refusal does not invalidate an earlier successful file. Continue with the next
independent owned edit instead of rewriting or resubmitting confirmed work
(EX-14). On restart, the host reconciles the retained branch and checkpoint;
an identical checked-edit request returns its retained receipt without repeating
the write (EX-17).

Rerun the exact original goal from the same staging revision so the host can find the retained task.

Keep the existing application storage so the journal can restore the answer and file receipt.

An abrupt process exit can leave the task worktree on disk. Leave it in place and rerun the exact goal.

ArcNexus checks the retained issue branch, removes the abandoned worktree, and creates a fresh worktree for the retry.

The Reviewer reuses the same candidate and captured check results during citation repair.

Cite evidence paths exactly as the host supplied them, including their full directory names.

## Correct a refusal

If a later path is refused, correct only that request or ask its owner for help.

Read the diagnostic. An ownership refusal names the path and captured owner
(EX-3); it grants no additional authority. Correct an erroneous path within your
scope, or use `request-supplier` to ask Direction for the owner's contribution.
For a stale hash, reread that file and correct the request against its current
contents (EX-2). Preserve earlier successful edits and the refusal evidence.
An independent owned edit can proceed without replaying the refused request.

A literal substitution needs one nonempty, unique `transform.replace.before`
anchor. An empty anchor is refused without changing the file. To replace a whole
file, use `path`, its current `expected` hash and the actual replacement `content`,
omitting `transform`. This uses the same checked edit and checkpoint path; it
does not bypass ownership, stale-hash or protected-file checks.

Cancellation stops managed descendants and records one terminal result (EX-8).
The host preserves checked edits and evidence before removing the task worktree;
preservation alone does not establish acceptance. Assembled verification and
independent review remain host operations.

If staging advanced after the task branch was secured, see [prepared checkpoint recovery](prepared-checkpoint-recovery.md).

## Failed checks during correction

The host returns the exact failing diagnostic, exit status and complete log
reference to the calling activity. The same steward corrects its existing
milestone and reruns the required check, without invoking Direction for ordinary
local repair. Explicit cross-owner escalation and independent final rejection
use Direction. The steward reads the latest failed-check log first and retains
earlier findings as history.

A diagnostic already sent for correction holds on repetition. TAP numbering,
source positions and temporary worktree paths do not establish a new failure.
For other command formats the retained output supplies the comparison. The full
original log remains available as evidence. Workflow does not reopen a host-held
repeated check as another review supplier request. See the
[Workflow recovery scenarios](../../workflow/contract.md#acceptance-scenarios).
