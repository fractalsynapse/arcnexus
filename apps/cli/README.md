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

Inspection reads the committed project revision, resolves the selected activity,
and prints the complete request from the Architecture builder. The output names
unavailable task fields, including `<goal>`. The [gateway contract](contract.md)
defines the observable behavior.
