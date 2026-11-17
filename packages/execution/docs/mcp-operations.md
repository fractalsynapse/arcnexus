# Verified local MCP operations

Use this guide when an activity applies a checked edit and a later request is
refused. It follows [Execution EX-1–EX-4, EX-14, EX-16 and EX-17](../contract.md#acceptance-scenarios).

## Check one file at a time

Inspect the selected activity's captured operations and owned roots before acting.
Local MCP admits only mapped operations with valid arguments and prerequisites;
another activity's tools grant no authority. Native shell is unavailable. The
execution provider separately controls built-in web access.

Read the target with `read-file` and use its complete-file SHA-256 as `expected`
in `checked-edit`. Each call handles exactly one owned file. Use `expected: null`
only to create a file; use `content: null` to delete one. Locked contracts and the
registry remain protected. Wait for the result before making the next edit.

## Use the retained receipt

A successful checked edit is retained before the tool reports success. Keep its
receipt, before/after digests and checkpoint reference as evidence of the confirmed
edit. Use `read-file` to inspect retained evidence when resuming. A later refusal
does not undo that success: continue from the retained result without rewriting or
resubmitting the successful edit. If an identical request is replayed after restart,
EX-17 requires returning its retained receipt without repeating the write.

## Correct a refusal

Read the diagnostic and retain it alongside the successful receipt. An ownership
refusal names the requested path and its captured owner; it grants no write
authority. If a later path is refused, correct only that request or ask its owner
for help through `request-supplier` and Direction. For stale content, reread that
file and use its current complete-file hash for the corrected request.

For example, after a guide creation succeeds, an unrelated CLI path can be refused.
Keep the guide and its receipt. Leave the CLI file unchanged, then read an
independent owned README and submit its link edit in a new checked-edit call.
Neither the refusal nor a supplier request widens the active scope.

Cancellation retains checked edits and evidence under EX-8 and EX-17. Resume from
the retained position and checkpoint. Confirmed edits alone do not establish
assembled acceptance: the host performs assembled verification and obtains the
independent review before delivery.
