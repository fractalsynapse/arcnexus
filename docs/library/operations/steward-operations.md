# Steward operations and evidence

Shared operation argument tokens retain their captured definition separately from
each invocation's resolved arguments. Path inputs are anchored to the repository and
resolved relative to the operation working directory. During an assignment, a test
operation discovers current owned suites using captured classification and profile
rules, including newly created regression suites, while enforcing mandatory captured
test identities. Invocation evidence retains the selected source hashes. Candidate
configuration cannot replace the operation, owner or profile. Explicit CLI test
filters retain their validated selection rather than expanding to all owner tests.

Finite shared-operation checkpoints resolve prerequisites before dispatch and execute
each equivalent resolved operation once. Equivalence includes the effective read
boundary as well as command arguments, working directory, outputs and definition.
A new checkpoint re-executes its checks. Host regression checks and engineering calls
use this same ordering; a requested test cannot run against stale generated output
merely because it was selected separately from its preparation prerequisite.

Plans/timeline (#41), declared operations (#42), managed local services/probes
(#45), and selected history/live qualification (#48) are available. Their retained
qualification evidence is linked below.

Version-2/3 definitions select a source-read-only assignment planning turn before
execution. Plans have stable checklist IDs, activity, acceptance criteria, expected
evidence, dependencies and questions. Execution records completed items as agent
claims with evidence; host acceptance is separate. Plan changes cannot widen scope,
waive a checkpoint or authorize publication. Invalid plans stop without retry.

After a separate mandatory initializer, normal changes plan four worker turns;
research/review plan two. Version-1 profiles retain their workflow without a planning
turn. Corrective work requires recorded findings and a concrete repair objective.
Worker turns share one thread and any explicitly captured limits; no default
turn, attempt or execution-time ceiling applies.

`arcnexus status <workspace-id> [--json]` reads current lifecycle, activity,
checklist, elapsed time, configured limits and evidence completeness without taking the execution lock.
`arcnexus follow <workspace-id> [--json] [--after <sequence>]` replays and follows
the timestamped timeline. It exits at finalization; interrupting the viewer never
cancels the worker. Missing historical timelines and incomplete trailing records
are explicitly identified. Observation timestamps describe host receipt, not the
instant an internal model action happened.

Raw SDK events remain unchanged. The normalized timeline records plan revisions,
SDK observations, host checkpoints and final outcomes with run, component, turn,
sequence and artifact references. Reports distinguish agent checklist claims from
host-verified acceptance. Neither reasoning summaries nor instruction inventories
represent complete private reasoning or complete effective Codex context.

The runtime provides fixed, captured operation IDs over an ArcNexus-owned
stdio MCP bridge, at most 24 requested operations per assignment, managed loopback
HTTP service leases, functional probes and explicitly selected historical evidence.
Host operations execute candidate code at the existing trusted command boundary;
they are not complete OS isolation. Publishing and peer coordination remain outside
this contract.

## Declared finite operations (#42)

Version-2 components explicitly list `operationIds`. Definitions under
`architecture/operations/<id>.yaml` declare repository, cwd, fixed command/args,
category, activities, timeoutSeconds (at most 120), generatedDirectories, artifacts,
and prerequisite probes. Version-2 execution profiles permit categories and bound
`maxOperationCalls` (default 24). Assignments may select a subset using operationIds.
Version-1 components grant no operation authority. `validate` checks references;
`inspect` shows captured operations and their trusted-host execution boundary.

The MCP tools `operations.list` and `operations.run` expose the captured catalog.
Run accepts only an operation ID. Requests, including denied executions, consume
budget; listing does not. A nonzero command result is returned as test evidence.
Unknown operations, disallowed activities, input tampering, scope violations and
exhausted budgets terminate the assignment. Operations are serialized. Model-facing
output is limited to 16 KiB; logs to 64 MiB, with explicit limit failures.

Operations use a restricted environment and existing tool bindings. They execute
candidate code on the host, just like captured verification, not in a new OS
isolation boundary. They cannot authorize dependency edits or source mutations
outside the current activity. Host checkpoints still run independently; exploratory
checks cannot replace frozen regression or external acceptance.

The explicitly configured ArcNexus MCP server uses automatic tool approval; the
agent approval policy remains never. Host authorization still checks every call.

## Functional probes and local HTTP services (#45)

Before inference, declared operation probes run through the host route and must
leave source unchanged. The MCP bridge is exercised through its real stdio client.
Probe results retain executable, arguments, configuration, output and timing.
A sandbox `true` check alone is not functional toolchain evidence.

Service operations use a foreground command and a `service` declaration with port
(0 requests an OS-assigned port), readinessPath, expectedStatus and
startupTimeoutSeconds. The host supplies ARCNEXUS_HOST=127.0.0.1 and ARCNEXUS_PORT.
The service announces one JSON line: `{"arcnexusEndpoint":{"host":"127.0.0.1","port":1234}}`.
Readiness requires the owned process group to listen only on loopback at that port
and the declared HTTP status. Fixed-port collisions fail without retry.

`services.start`, `services.status`, `services.logs`, and `services.stop` accept a
captured service operation ID. Only one service may be active. Captured `http`
operations identify serviceId, path and expectedStatus; operations.run performs
the request with bounded output and never follows redirects. Arbitrary URLs are
not accepted. Every service request counts against the existing operation budget.

Leases end at turn completion, failure, cancellation or bridge loss. A detached
supervisor watches its IPC parent connection, terminates the service process group,
and retains an independent resource record. Termination requires both no live group
members and a closed endpoint. Workspace cleanup refuses unresolved resource records.
Hard interruption preserves incomplete assignment evidence; it never resumes work.

The committed HTTP fixture exercises this local protocol without containers,
provisioning, external services, or changes to TreeSeed server setup.

## Selected prior evidence

Version-2 structured assignments may declare `priorEvidence`, an array of
`{path, sourceId, revision, reason}` records. Paths are absolute regular UTF-8 text
files selected by the caller. ArcNexus snapshots their bytes and SHA-256 hashes
before workspace preparation; missing, non-text, duplicate, or collectively
oversized inputs fail preflight. The combined limit is 64 KiB, without truncation.
Source identity and revision are caller-provided provenance, not independently
verified revision claims. Inspection includes exactly the captured content used by
execution. Snapshots live outside the candidate under `prior-evidence/`.

Selected history is untrusted evidence, never additional authority. It is supplied
to planning and subsequent turns with its selection reason and measured byte size.
No whole-thread ingestion, retrieval database, or automatic promotion of findings
into decisions occurs. Reports retain reusable findings and uncertainty with the
run, component and base revision that produced them.

Preparation and cleanup events join the same host-observed timeline as planning,
operations and verification. Operation result artifacts retain hashes and external
paths. Historical reports without these fields remain readable.

## Qualification campaign

Use `scripts/qualify.mjs` with an explicit campaign manifest and a fresh output
directory. Keep the verified supervising build and independent acceptance scripts
outside candidate scope. Run each case once: a reporting improvement, the same
change with a labeled injected implementation defect and one corrective attempt,
a TreeSeed command assignment with pinned read-only dependencies, the local HTTP
fixture, and research using selected historical findings. Preserve failed campaigns
and record interventions. Successful candidates still require caller review and
normal repository integration; a model's checked checklist is not acceptance.

Create a fresh campaign input directory with
The committed `experiments/operations.yaml` supplies case definitions. Provide local
project/tool/revision bindings and run `node dist/cli.js experiment inspect
experiments/operations.yaml --bindings /absolute/bindings.json --json`, then
`node dist/cli.js experiment run experiments/operations.yaml --bindings
/absolute/bindings.json --mode live --output /absolute/new-campaign`.
See [experiment bindings](../experiments/experiments.md) for the complete contract.
The runner must remain unchanged and outside all candidates throughout the campaign.
Fault markers are per candidate workspace, so later campaigns do not silently skip
injection. The campaign does not retry failed cases.

Finite setup, verification and exploratory commands also use a separate supervisor
with a parent-liveness channel. A hard parent interruption aborts the command process
group even when the CLI cannot finalize its report. Partial logs and the incomplete
execution record remain; this does not authorize automatic recovery or cleanup.

The SDK executable launcher also watches the original host process identity and
terminates its Codex process group if that host disappears. It preserves the SDK's
stdio event stream and inserts `--ignore-user-config` exactly as before. A lost
host leaves incomplete evidence, never a successful outcome.

The reporting owner declares a focused built report-test command in addition to
full repository verification. Use that command for the expected-red and captured
regression checkpoints; full verification still runs at baseline and after changes.
This keeps repeated regression checks bounded without weakening integration checks.

Research/review has exactly one execution turn after planning. Source-read-only
means no source edits; it does not prohibit declared test or service operations.
The steward must perform its selected permitted work and update the checklist in
that turn, or report a precise blocker. Activity names are not promises of additional
model turns. Incomplete checklist claims fail rather than silently adding a turn.

Shared checkpoints also cover initializer verification, assignment baselines, final
verification, frozen acceptance and refactor characterization. Each checkpoint orders
and deduplicates prerequisites once; a later checkpoint reruns required checks against
the current candidate. Every completed or failed invocation retains its result even
when a later operation fails.

## Required host operation route

ArcNexus configures its MCP bridge as required: model execution must not silently
start without the declared host-operation tools. Required startup and tool ceilings
remain 24 hours; cancellation still stops managed work. Codex documents the
[required-server and optional startup behavior](https://learn.chatgpt.com/docs/extend/mcp).

Worker prompts identify the `arcnexus` server, operation IDs and tool arguments.
Use `operations.run` for a declared operation rather than copying its command into
the sandbox shell. The host route can build declared generated outputs while source
write authority remains narrow. If tools are deferred, discover the ArcNexus tools
before concluding they are unavailable. Shell failure is not host-operation failure.
A completed behavioral specification must still return its proposed regression
checkpoint; uncertainty about local execution never makes `regression: null` valid.

Finite operation requests are authorized and counted when received, then queued in
arrival order. Multiple valid requests do not authorize concurrent subprocesses:
the host executes one at a time with distinct request identities and logs. A normal
test failure remains feedback; cancellation, bridge loss, or a fatal authority/scope
failure stops active work and prevents queued work from starting. Pending callers
receive their own completed result through `execution.wait`.

Long finite-command excerpts retain startup context, a potential failure diagnostic
window, and trailing output within 16 KiB. The complete log remains a separate
artifact. This is diagnostic selection, not a claim to infer the root cause; callers
must retain and inspect full evidence when the excerpt is insufficient.

Shared service startup and HTTP checks use the same captured definition/context ledger
as command execution. Service startup runs finite prerequisites first and records its
managed lease; status, logs and stop retain that lease identity. Startup remains an
explicit managed service action, not an indefinite lifecycle check. Agent HTTP calls
use their explicitly started lease. A required host HTTP checkpoint owns a fresh lease
for its captured `serviceId`, runs its finite preparation, checks the endpoint and
verifies shutdown in `finally`. That service must be declared in the owner's agent
operations. Host verification never accepts an engineering call as evidence for a later
candidate. Missing service authority, failed startup and uncertain interruption remain
visible failures; no unmanaged command or writable-source fallback is available.

### Confined descendant lifetime

Source-read-only operations must also contain descendants that create a new
session or process group. The installed sandbox launcher does this itself; killing
only its original process group cannot establish cancellation. A private delegated Linux cgroup ties the whole confined process tree to its
supervised launcher, including normal launcher exit and parent loss. The child joins
the group before launching executable work; cleanup uses the kernel group kill
operation, independent of process/session IDs. Unsupported containment fails before
dispatch. Nested PID namespaces were rejected by the installed AppArmor profile;
ArcNexus does not change that machine policy.
Readiness validates listener ownership through that retained process tree, never by
port alone. Source-write enforcement remains the inner captured sandbox policy.

Qualification must exercise detached descendants, cancellation, parent loss and
normal exit using the installed runtime. A closed launcher without a closed endpoint
is unresolved evidence, not successful cleanup. See issue #114 for the observed
installed-runtime escape and its acceptance criteria.

Runtime diagnostic support is captured outside target generated-output trees in
private, read-only configuration storage. Rebuilding a target that is ArcNexus
itself must not mount the active support file inside the output being cleared.
An existing support snapshot with different bytes is an integrity error; candidate
builds cannot replace the active snapshot.

### Disposable output roots

The installed runtime protects special child directories within writable roots.
For validated untracked output roots and private temporary storage, the confinement
adapter explicitly permits their disposable `.agents`, `.codex`, `.aws` and `.git`
children so installers can replace generated contents. It validates child path
segments before granting them. This is derived runtime policy, not authored
component exceptions. Maintained source, its Git metadata and private configuration
remain read-only; generated output cannot become active runtime configuration.

The [named permissions documentation](https://learn.chatgpt.com/docs/permissions)
describes explicit rule overrides. ArcNexus additionally qualifies actual cleanup
and source denial against the installed executable. The observed npm failure and
exact runtime probe are recorded in issue #123; they are not a claim about every
Codex version or platform.

Managed operations allocate a short private temporary directory independently of
the durable evidence path and record that location before execution. Long evidence
roots must not force child Unix IPC addresses beyond transport limits. Retained
records reuse their captured temporary location; uncertain operations remain
non-replayable. Bridge startup rejects an overlong encoded address before binding
and releases its listener and directory whenever startup fails. Test watchdogs
remain finite; these transport safeguards do not impose agent execution budgets.

Network-enabled operations retain read-only access to the canonical system DNS
resolver file when `/etc/resolv.conf` is a symlink outside the runtime’s minimal
mounts. This grants neither access to all of `/run` nor writes to resolver or source
files. Network-disabled operations gain no extra resolver rule. Installed-runtime
qualification covers resolver readability and write denial; successful host DNS
alone does not establish confined network availability.

Agent-available test operations may be declared before an owner has its first
suite. Catalog loading retains their captured definition and pending selected-test
context; it never turns an empty selection into an unrestricted runner invocation.
At invocation, the host discovers current owned suites under the captured profile,
validates mandatory test identities, and expands their paths before dispatch. A
still-empty or missing selection fails before any prerequisite runs. Required host
checkpoints retain eager context validation.

### Inherited project test and lint availability

ArcNexus declares `component-tests` and `component-lint` once as inherited agent
operations. Owners retain only additional required verification or specialized
operations. Test execution resolves current owned suites; owners without a suite
retain pending availability and cannot invoke an empty test selection.

The shared lint command receives captured `ownedPaths` as separate arguments. It
checks owned code and configuration supported by the repository ESLint policy;
non-code ownership paths do not become invented lint targets. Unmatched paths and
ignored documentation/configuration formats are quiet, while actual lint findings
still fail. Lint remains read-only, and source edits use the checked edit tool.
This replaces repeated authored owner directory lists and does not grant source
write authority or remove required host verification.

An unknown or unavailable operation ID is a rejected selection, not an executed
check. The host returns an actionable response directing the worker to
`operations.list`; host-only verification IDs never become agent capabilities.
This pre-dispatch rejection preserves already running authorized work and its
pending observation handle. Repeated identical selections use the existing progress
diagnosis. Real execution failures, cancellation and uncertain operation state retain
their lifecycle behavior. This closes the #139 live failure where a mistaken
host-only selection cancelled an unrelated pending lint operation.
