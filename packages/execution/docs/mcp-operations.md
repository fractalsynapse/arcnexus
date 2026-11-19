# Local MCP operations

Use the operation IDs and descriptions captured for the current activity. Project
reads and edits go through its mapped local MCP tools; native shell and unmapped
operations are unavailable (Execution EX-16). Built-in web access follows the
execution provider policy. See the [Execution contract](../contract.md#obligations).
These mappings constrain host operations available to the activity. Ordinary public
APIs used by authored code are not restricted to MCP tool names.

## Check one file at a time

1. Read the target with `read-file`. Keep its complete-file hash, even when the
   returned text is a bounded range; read further ranges if needed to understand
   the change. Confirm the path belongs to the current component and activity.
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

Cancellation stops managed descendants and records one terminal result (EX-8).
The host preserves checked edits and evidence before removing the task worktree;
preservation alone does not establish acceptance. Assembled verification and
independent review remain host operations.

If staging advanced after the task branch was secured, see [prepared checkpoint recovery](prepared-checkpoint-recovery.md).

## Observe and repair a check

The following is the intended caller-level recovery behavior for EX-22 and EX-23;
documentation alone does not establish implementation or qualification.

Invoke the check through the current activity's captured local MCP mapping. The
host executes only its captured confined command and returns the actual exit
status, exact diagnostic and immutable log reference before the caller continues.
No shell, unmapped command or raw model-response operation is accepted. There is
no deferred native check queue or queued-check reply exception.

The current activity is responsible for its assigned work, even when no
`localRepair` field is present. Read an observed failure's log, make any necessary
single-file checked correction within scope, then invoke the mapped check again
in the same activation. Refusals preserve previous receipts. A check expected to
fail succeeds as evidence when its actual result meets that original expectation;
do not replace an expected-failure assertion with an expectation of success.

Every unresolved observation and its original expectation remain durable.
Completing a response, omitting a check, passing another check or requesting a
different expectation cannot resolve it. Reuse completed evidence when the
captured operation, expectation, relevant inputs and environment still match;
do not execute the unchanged command again. An affected checked edit, including
an accepted supplier contribution, invalidates that reuse. Historical diagnostics
remain immutable when a new observation satisfies the original expectation.

Optional clarification, research and supplier inbox requests remain available
after an observed check. Their handoff, interruption and restart preserve the
diagnostic, unresolved expectation, single-file receipts and complete answers.
A completed check interrupted before the activity finishes remains an observation;
an interrupted command without a completed result cannot count as passing evidence.
Cancellation still stops descendants and retains one terminal result (EX-8).

Ordinary operation failures return to their caller without a Director call or a
new correction milestone (Direction DI-7). A self-review finding may return
`kind: repair`, the earliest affected applicable `activity` and the exact
`reason`. Workflow persists that rewind within the same milestone. `localRepair`
is optional context for this route; read its evidence when supplied. Only explicit
escalation needing another responsibility or authority, or final independent
rejection, invokes Direction. Original ownership, captured operations and
acceptance remain unchanged.

Compare repeated diagnostics with relevant inputs and checked progress. An
unchanged failure without progress retains an actionable hold before another
identical automatic attempt. TAP numbering, source positions and temporary paths
alone do not establish a new failure. Distinct failures or changed inputs can
continue correction. See the
[Workflow recovery scenarios](../../workflow/contract.md#acceptance-scenarios).

## Native invocation attribution

Before invoking the provider, the common native boundary records the actual
request input byte count, acting component and activity, and captured selected
model and profile in the existing task journal. Count the bytes of the actual
submitted input, including multibyte text, rather than characters or a prompt
estimate. Use this same boundary for Director calls and local repair invocations.
The pre-invocation record survives provider failure or interruption and supports
cost auditing alongside retained request and result evidence (EX-24). No separate
metrics store is introduced.
