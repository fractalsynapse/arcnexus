# Assignment-bound command diagnostics

Engineering activations use the existing `assignment.evidence` capability to discover current-run intent and, when available, read retained command diagnostics. The host binds diagnostic reads to the current assignment, run, and retained record. Worker-provided references do not select another record or grant execution permissions.

Read the manifest's `invocationDiagnostics` entry, then fetch only the invocation artifacts it advertises through the same evidence paging capability. Each invocation retains its identity, status, exit code, resolved context, and complete combined output. Missing, mismatched, or unsafe retained data is reported as unavailable evidence.

Continuation preserves the assignment's evidence route and invocation history. Read diagnostics from the retained invocation; do not rerun the command to recover output. Intent discovery, evidence history, and diagnostics remain in the same capability.
