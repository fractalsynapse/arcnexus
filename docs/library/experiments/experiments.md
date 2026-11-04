# Acceptance campaigns and historical experiment evidence

Scripted and recorded campaigns run through the test system:

```sh
arcnexus test inspect --component experiments
arcnexus test run --component experiments
```

Their test-only orchestrator invokes the ordinary built task CLI and checks pinned
source, expected outcomes, cancellation and supervising-code integrity. It is not
shipped in the production distribution. Controlled model responses establish
acceptance behavior, not successful real-agent engineering.

For real-agent learning, use `task run "<prompt>" --simulate` or
`workday start --simulate`. These use the normal director, agents, verifier and
publisher with isolated upstream effects. Supply a useful goal; do not prescribe
a starting roster or use a scripted director for live qualification.

`experiment run` is retired for every manifest version. It rejects execution before
reading inputs or creating state. Read-only historical inspection remains available
through `experiment inspect <manifest> --bindings <file> --json`. Existing campaign
reports retain their original schema and evidence labels.

## Historical formats and behavior

The following reference describes historical campaign formats and original execution
semantics. Old `simulation` labels may mean scripted inputs; they are not the current
real-agent `--simulate` environment. Retired execution examples below are historical
reproduction context, not supported commands for starting new work.

## Prompt campaigns

Version-3 campaigns exercise the shared task execution system. Each ordered case
has an ID, project binding, prompt and expected task outcome. Models, eligible
owners, checks and independent review come from the captured package configuration;
cases do not select a fixed requester/recipient pair, model or execution budget.
Explicit `simulation` or `live` evidence labels remain mandatory. A simulation
binding supplies a controlled executable and cannot establish live qualification.

Each project binding pins the clean source checkout's current commit. The campaign
captures local bindings before execution and creates a separate application-owned
clone for each case, preserving the original checkout and prior case evidence.
It invokes the ordinary `task run <prompt>` interface in that clone. The application
host owns supervision and durable candidate evidence. Campaign cancellation sends
normal task cancellation; an already detached project host remains authoritative
if the campaign process itself is lost. Inspect or stop retained project execution
before retrying an interrupted campaign; do not silently replay it.

A completed case requires the expected task status and its corresponding exit code;
verified completion still requires the task runtime's captured host checks,
independent owner verification and director goal assessment. Retain the complete
stream, terminal projection, state directory, candidate reference and captured
source/bindings identity. Snapshot all case inputs before running the first case.
No experiment commits or integrates a candidate into the original checkout.

Legacy manifests and reports remain inspectable. Version-1/2 execution is retired;
version-3 execution is also retired into acceptance support. See the [migration contract](../../gateway/cli/execution-migration.md)
for retained historical inputs and replacement coverage.

The testing library supplies the reusable multi-owner controlled harness used by
runtime and prompt-campaign acceptance. Sharing that fixture preserves identical
SDK, dependency and verification behavior across both entry points; individual
component suites retain their own scenarios and assertions.

## Historical general fixture and campaign example

The bundled `general` fixture is a complete package with three executable owners:
CLI argument handling, greeting construction and name normalization. Its committed
configuration selects engineering and independent direction/review profiles, declares
owner and assembled-package checks, and uses no execution budgets. Materialize its
compiled payload into a clean Git repository, commit it, and provide only local
executable bindings. The normal commands then discover everything from that package.

`experiments/general-live.yaml` is the prompt-only live campaign example. It starts
with the CLI owner and requires service and names to be discovered through persisted
requests. Each supplier is accepted against its own API contract; downstream caller
regressions are not prerequisites for supplier delivery. Real independent verification
and final goal assessment determine completion. The fixture and campaign replace the
fixed two-participant example for new qualification work; older fixture files remain
historical characterization inputs.

# Historical campaign formats

Inspect without preparation or inference:

```sh
node dist/cli.js experiment inspect experiments/operations.yaml --bindings /absolute/local-bindings.json --json
```

Execute once, with an explicit evidence mode:

```sh
# Retired: node dist/cli.js experiment run experiments/operations.yaml --bindings /absolute/local-bindings.json --mode live --output /absolute/new-campaign
# Retired: node dist/cli.js experiment run experiments/simulation.yaml --bindings /absolute/simulation-bindings.json --mode simulation
```

A missing mode is an input error. Inspection reports mode as unselected; it never
selects a paid execution default. Inspection resolves tracked architecture and all
case inputs without creating state. Run defaults to a unique experiment directory
beneath ArcNexus user state; explicit output must be new and outside target repositories.
Exit codes are 0 campaign expectations met, 1 unexpected execution/check failure,
2 invalid inputs/preflight, and 130 cancellation.

## Definitions and local bindings

Version-1 experiment manifests declare `modes` and ordered `cases`. Each case names
an `id`, project binding key, component, assignment file, expected outcome, independent
acceptance commands, and optional attempt limit/fault-injection description/scenario.
A case may pin `base` directly; otherwise its project binding must supply a full
40-character commit. Branch names and implicit HEAD selection are rejected.
Paths in assignments and acceptance are relative to their defining JSON file.
Executable names resolve only through explicit tool bindings; no shell strings or
arbitrary configuration expressions are evaluated. Acceptance may use `{report}`;
assignment host checks may use `{faultMarker}` for a host-owned per-case marker.

Bindings have `schemaVersion: 1`, `runner` (absolute verified built CLI), optional
`codexPath` (required in live mode), `projects` keyed by identity with absolute `path`
and optional pinned `base`/workspace `bindings` file, `tools` mapping executable
names to absolute executables, optional `issues` keyed by case, and `priorEvidence`
keyed by selection identity. A prior-evidence selection supplies absolute path,
sourceId, revision and reason; a case's `priorEvidenceIds` selects those records.
No whole conversation or report is silently imported.

The resolved input includes immutable revisions and input hashes. Before execution,
all assignments, selected evidence, workspace bindings and declared acceptance
artifacts are snapshotted. Later candidate edits cannot redefine them. The supervising
build is hashed before cases, checked before each subsequent case and at completion.
A changed supervisor invalidates the campaign and prevents further executions.

## Simulation and live evidence

`experiments/simulation.yaml` uses only the bundled `single-steward-v1` fixture
contract and fixed success, repair, boundary and failure scenarios. The caller
copies `fixtures/simulation` into an independent Git repository, commits it and
provides that immutable commit in bindings. The application does not initialize,
clone or fetch repositories. Altered fixture contracts are rejected before execution.

Simulation uses a bundled controlled executable through the real SDK, launcher and
bridge. File edits, Git worktrees and host checks are real; agent responses and usage
are scripted and labeled simulated. The bundled four-case example deliberately includes an unexpected execution failure:
its first three cases should pass and its fourth remains failed, so the campaign
returns exit 1. It needs no credentials or inference calls and
cannot satisfy live-model qualification. It does not prove installed Codex sandbox
behavior. No custom scenario language or arbitrary scripted model actions are exposed.

Live mode invokes Luna/medium using existing Codex authentication. It performs the
same bounded workflow and independent checks. Reports distinguish actual model
usage from scripted counters. Expected blocked outcomes need independently checked
owner requests. Unexpected failures remain failures, not accepted simulations.

Cases run once in order. Ordinary failures retain evidence and later cases still
run; cancellation stops the active CLI and subsequent cases. Independent supervisors
stop managed processes on parent loss. Assignments retain any explicitly captured execution limits;
post-run checks have no implicit timeout and retain bounded logs. A hard interruption
leaves an incomplete campaign; no resume, automatic retry or model escalation occurs.

Campaign JSON and Markdown retain mode, revisions, hashes, case reports, usage,
interventions, checks and resource shutdown. Source checkouts and candidate branches
are preserved; no automatic cleanup or integration occurs. Disposable worktrees
protect source checkouts, but declared host commands are trusted and may have host
or external effects. This is not universal OS isolation.

The legacy `node scripts/qualify.mjs <manifest> <output>` remains a compatibility
entry point to the same TypeScript runner. Historical reports remain readable;
legacy evidence is not retroactively labeled simulated or live.

## Phase-two acceptance seed

The guidance steward encounters a proposed metadata rule absent from the checker.
It must name guidance-validation, provide observed evidence, desired behavior and
acceptance conditions, and explain why implementation is outside its scope. Phase
two will deliver the bounded request, owner response, verified validator change and
resumption. This increment records the scenario without implementing cooperation.

A concrete first coordination fixture can propose an optional `references` metadata
list whose repository-relative documentation targets must exist and stay inside the
repository. This is a proposed phase-two rule, not current checker behavior. The
first guidance assignment demonstrates a broken reference, requests that deterministic
rule from `guidance-validation`, and names accepted/rejected fixture examples. It must
stop before editing validator implementation. Phase two succeeds when the owner makes
and independently verifies the bounded checker change, returns captured evidence,
and the original steward resumes and validates its guidance. The architect still
accepts the proposed rule; neither steward grants itself new authority.

See [integrated qualification evidence](../../acceptance/experiments.md) for the completed
live campaign and the separate simulation guarantees.

## Two-owner cases

Version-2 experiment manifests may select `workday` (a manifest path) instead of a
single `component`/`assignment`. Their expected outcome is `completed` or `blocked`.
The resolver captures both participant envelopes and combined checks before the first
case. Execution delegates to `workday run`; it does not implement another scheduler.
Workdays preserve explicitly configured limits; absent limits remain unset.
Each executable case initializes once through its existing runtime entry point.

The fixed `handoff` simulation scenario requires the exact bundled `fixtures/workday`
contract. It uses two scripted threads and real host checks. Live cases omit `scenario`
and use Luna/medium. Both retain explicit mode labels in campaign and workday evidence.
`experiments/workday-fixture.yaml` is the live contract example; the corresponding
simulation manifest demonstrates the same runtime without inference. Local bindings
supply pinned repositories, the supervising build, executable paths and issue metadata.

The real guidance case captures the optional `references` policy before execution:
when present, a nonempty unique array of repository-relative paths to readable tracked
regular files, with no absolute paths, traversal, missing files or symlink traversal.
The guidance owner requests validator implementation, waits for verified delivery,
then updates selected skill metadata and maintenance documentation. Skills without
`references` preserve existing behavior. Independent fixtures remain outside both
owners' authority. The campaign report alone does not authorize integration.

For an expected blocked workday, independent acceptance must validate the escalation.
Model settings are checked for assignments that actually started inference; an owner
that was never activated has unavailable execution settings and usage, not a fictitious
model execution. Its captured profile must still pass workday inspection.

The guidance qualification binds Node/npm explicitly and gives the validator owner
fixed build and guidance-test operations. The steward obtains regression feedback
through the verified host route; direct sandbox output is not substituted for the
host's expected-red evidence. Tool bindings and operation definitions are captured
before each workday, alongside the unchanged references policy.

An omitted experiment-case attempt limit leaves the runtime limit unset. Only an
explicit `maxAttempts` is forwarded to the worker; experiment wrappers must not
introduce an implicit single-attempt quota.

The preceding legacy formats describe archived evidence. They cannot execute
through the current CLI. Filenames ending in `.historical.yaml` retain their recipes.

The shipped general greeting fixture uses minimal v5 components and the same shared
operation model as production tasks. A platform declares engineering defaults and
Astra director/reviewer profiles once; its three executable owners remain CLI,
service and names. The CLI owner also maintains the package's shared scaffolding
and container definitions. Each leaf's own definition is implicitly owned.
Public module entries describe the actual CLI → service → names imports. One
shared package test operation supplies engineering feedback and mandatory host
verification; ordinary `.test.mjs` filenames provide test classification without
per-component inventories. Materialization retains compiled runnable payloads and
requires the declared fixture origin before execution.

The product build clears obsolete compiled fixture payloads before recompiling.
Renaming a maintained test must not leave the former generated test in a newly
materialized package or execute both copies of the same acceptance scenario.

The shipped identity and HTTP campaign targets use the same minimal configuration
family as general. Each has one platform policy declaration, one package identity
and one executable owner of its complete small repository. Public modules remain
explicit; setup, runtime probes and verification are shared operation references.
HTTP service startup stays agent-only and finite syntax checking remains mandatory
verification. Its loopback probe is a referenced prerequisite rather than an inline
recipe. Materialize compiled payloads, declare the fixture repository's origin and
commit before invoking normal task/workday commands. Historical campaign manifests
and evidence retain their original interpretation.

Active prompt campaigns reference the inherited `component-tests` operation and
stable captured regression operation identities. They do not prescribe historical
`verificationIndex` values, removed owner-specific test commands or compiled test
paths as editable source. Historical manifests and their assignment documents remain
unchanged so retained evidence can still be interpreted against its original request.

Prompt campaign capture also retains the primary repository URL from committed
composition authority. A case may clone bytes from a local source path, but resets
that clone's origin to the captured declared identity before normal task preflight.
This performs no fetch or publication and leaves the caller's repository unchanged.
The URL is derived snapshot evidence, not another maintained campaign field (#140).
