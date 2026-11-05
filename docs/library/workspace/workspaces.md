# Managed workspaces

Supported host: Linux/POSIX, Node 22.13 or newer within Node 22, and Git.
Build with `npm ci && npm run build`; invoke `node dist/cli.js`.

`arcnexus workspace prepare <package>` resolves a registered package and creates
an application-owned branch and linked worktree at its selected committed authority.
The source must be clean. Its checkout and branch remain unchanged.
`arcnexus workspace cleanup <package> [--workspace <id>]` removes only eligible
inactive workspaces without source changes or unknown ignored files. Branches,
reports and unfinished assignment evidence are retained. Repeated cleanup is safe;
there is no force-discard option. The retired top-level `prepare` and `cleanup`
commands return replacement guidance.

State lives in `state/` inside the configured project volume, or the explicit
nonempty `ARCNEXUS_STATE_DIR` directory. To inspect historical state, select its
original root with that override; changing the volume never migrates evidence.
Records and logs live under `runs/<id>`; candidates under `workspaces/<id>`.
Preparation, cleanup and the execution host share the canonical repository lease,
including linked Git worktrees. Process exit releases that SQLite ownership;
retained records still preserve interrupted or uncertain operations. Do not remove
lease databases or blindly replay commands after interruption. State is private
to the current OS user.

## Shared-operation preparation

Environment schema 4 contains repository composition only:

```yaml
schemaVersion: 4
workspace:
  primary:
    id: app
    repository: https://example.invalid/app.git
  dependencies: []
```

Version-five components inherit `operations` usages. Preparation runs their captured
`preflight` operations followed by `setup`, expanding fixed host context inputs and
ordering prerequisites. Identical resolved operations run once per checkpoint.
Generated-output roots come from those operation definitions; environment setup
recipes and duplicate output-root declarations are rejected. Mounted repositories
receive their own captured owner context and retained operation evidence.

The installed confinement adapter must prove source and configuration-home writes
are denied before setup executes. Setup can write only its declared generated roots
and private temporary storage. Run intent is flushed before dispatch; uncertain
operations are not automatically replayed. Cleanup derives disposable outputs from
immutable operation definitions and retains the original reports.

Shared preparation, refresh, test preparation and verification use the same operation
executor under version-five checked engineering. ArcNexus's own declarations now
use this configuration family. See the [real engineering qualification](../assignment/checked-engineering-qualification.md).

The workspace acceptance suite is being migrated to minimal component fixtures and
native confinement. It must preserve preparation, cancellation, parent-loss and
cleanup evidence coverage. A setup script attempting a maintained-source write must
fail before the contents change; its failed workspace may then be cleaned safely.
Generated directories may already exist when an operation starts.

Historical environment and report readers remain available for evidence inspection.
Assignment and operation adapter retirement is tracked separately in the implementation
plan; workspace preparation itself has no legacy recipe execution branch. New execution has no time or operation budgets.
Test watchdogs bound qualification processes, not valid application work.

Records capture configuration, base, source, branch, timestamps and operation results.
Full stdout/stderr is retained in invocation logs. Failed and cancelled workspaces
remain available. SIGINT exits 130; invalid/preflight input exits 2; operational
failures exit 1. Successful preparation exits 0 and prints the workspace record.
Cleanup refuses changed tracked files, untracked files and unknown ignored files
(including secrets). It deletes only declared ignored generated outputs with the
worktree. Concurrent external edits during cleanup are unsupported; stop editors
and builders first.

Git worktree operations follow the [Git documentation](https://git-scm.com/docs/git-worktree).

## Evidence-preserving cleanup contract

Cleanup must retain `report.json` and `report.md` byte-for-byte, including the original
status, finish time and elapsed duration. Removal metadata belongs in a separate
`cleanup.json` in the run directory. CLI cleanup output preserves the run status and
adds `cleanupStatus: "removed"`; cleanup must not invoke execution finalization.
Repeated cleanup leaves both reports and removal metadata unchanged. If a new file,
directory or symlink occupies a previously removed path, refuse to delete it.
Legacy records already marked `removed` are accepted only when the path is absent;
they cannot reconstruct evidence overwritten by the earlier implementation.

Removal writes `cleanup.json` atomically with `cleanupStatus: "removed"` and
`removedAt` (an ISO timestamp). This lifecycle receipt is separate from execution
evidence and is not rewritten on retries. An absent legacy workspace succeeds
without creating a receipt or changing its existing reports.

## Final execution-family retirement (#109)

The final retirement slice makes the maintenance `prepare` command and the public
workspace library require environment schema 4 and minimal component authority before
creating a candidate. Historical records remain inspectable and cleanable; reopening
them must not execute their inline setup or prerequisite recipes. Primary and dependency
preparation use only captured shared operations. A retained legacy preparation record
must be rejected before creating a worktree or launching a child.

Execution deadlines are retired from preparation as well as task/workday execution.
`prepare --timeout-seconds ...` returns invalid input before starting work. SIGINT and
host-loss supervision remain available; the test runner's explicit watchdog is separate.

## Registered package preparation

`workspace prepare <package> [--json]` resolves a registered qualified package
(or an unambiguous short reference) independently of the caller's directory.
The shared `WorkspacePreparation.prepare(target, signal)` service accepts captured
`source`, `base` and `packageId`, resolves local bindings, and prepares the existing
application-owned workspace through the captured operations. It does not create an
engineering assignment or start an execution host.

Preparation acquires the same canonical repository lease used by project hosts.
An existing host or concurrent preparation causes a refusal before worktree
mutation. Source must be clean. The response is the workspace resource projection,
with retained evidence and a terminal `prepared`, `failed` or `cancelled` status.
Failures and cancellation preserve the workspace and operation evidence; they do
not authorize cleanup or replay. The service releases its lease after finalization.
Existing workspace list/get commands inspect the resulting receipt.

This command uses the current application state location. Relocated-volume
identities and migration of the legacy cleanup command remain separate work.

## Package-scoped cleanup (#195)

`workspace cleanup <package> [--workspace <id>]` resolves registered package context
outside a checkout and delegates to the shared workspace cleanup service. Without
an ID it considers the package's captured workspace receipts; with an ID it rejects
unknown or differently owned workspaces before removal. Historical receipts without
captured package membership are never assigned to a package by guessing.

Cleanup holds the canonical repository lease, checks expected resource revisions
when supplied by application callers, and reuses the existing durable removal intent
and receipt. It removes only eligible disposable workspaces. Retained assignments,
unfinished work, changed source, unknown outputs and active managed resources remain
protected. A package-wide result reports each removed or preserved workspace and
returns an unsuccessful result when any selected resource must be preserved.
An absent workspace without a completed removal checkpoint, or a failed cleanup
with a retained removal intent, requires attention. A remaining directory alone
does not prove that an interrupted removal preserved the complete workspace.

Original execution reports and timeline evidence remain available after removal;
repeated cleanup validates the removed path rather than silently accepting a new
occupant. Source repositories are never removed. Cleanup neither releases delivery
retention nor repairs relocated records. The legacy standalone spelling remains
only while its existing fixtures and campaigns are migrated to this service.

## Shared dependency preparation (#268)

Dependency preparation is a host responsibility at task/workday setup. The director,
engineering stewards, independent verifier and publisher share the resulting
read-only dependencies while retaining separate source branches and build outputs.

The existing install operation remains the single command definition. Its optional `dependencyInputs` list names the repository-relative files that
determine dependency preparation; its existing generated
output roots identify what may be shared. Matching preparation is reused within the
same execution environment. Changed inputs, recipe, machine bindings or runtime
require a new installation, never mutation of one already in use. The host and
preparation executor use the same installed-runtime fingerprint.

Preparation uses the existing supervised executor and retains the original invocation.
Only successful, settled preparation is reusable. Recovery preserves uncertain
installation evidence instead of claiming readiness or replaying it. The host materializes the completed installation into each worktree using
copy-on-write copies where supported, retaining the original preparation receipt.
This avoids dependency-path symlink exceptions and writable shared aliases.
Prepared roots are read-only to both agents and operations; a changed dependency
input prepares a replacement before engineering continues. Build products stay local
to the source worktree. No test or verification result is reused by this mechanism.

This is implementation intent; qualification must prove actual reuse, invalidation,
interruption handling and write denial before it is reported as delivered.
