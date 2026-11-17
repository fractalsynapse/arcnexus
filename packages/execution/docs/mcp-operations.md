# Verified local MCP operations

Use the operation IDs and descriptions captured for the current activity. Project
reads and edits go through its mapped local MCP tools; native shell and unmapped
operations are unavailable (Execution EX-16). Built-in web access follows the
execution provider policy. See the [Execution contract](../contract.md#obligations).

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
