# Execution CLI migration

Issue #106 finishes the normal-interface migration in #78. Engineering execution
uses the project host, durable assignment scheduler and task director. Workday
policy supplies stewardship turns to that same host.

Task and workday execution now supports package targeting, retained identity
controls and read-only resource queries. The [execution contract](../../library/execution-runtime/execution.md)
defines the current command behavior; local prompt and argument-free workday
shorthand remain available when context is unambiguous.

Top-level `status` and `follow` now reject with replacement guidance for
`workspace get <id>` and `workspace get <id> --follow`.

Legacy component `run`, manifest `workday run`, `task plan` and `task legacy-run`
return an input error explaining the replacement before creating a workspace or
calling a model. Historical workday/proposal and worker report inspection remains
read-only. Top-level `prepare` and `cleanup` also reject with guidance for the
package-aware workspace commands; their separate gateway execution path is removed.

Active campaigns use schema version 3: prompts and expected terminal outcomes,
with project declarations supplying owners, profiles and verification. Retained
version-1/2 manifests may be inspected for historical evidence; executing them
requires migration and cannot invoke the retired recursive two-owner runner.
Historical reports retain their original interpretation and are never hydrated as
new scheduler state.

Migrate useful scenarios, not old quotas: success and correction, rejected/unknown
dependencies, captured verification failures, pending operations, scope enforcement,
cancellation, stable supervising code and honest evidence labeling remain covered.
Low-level steward and host-check characterization can exercise their public session
API directly. Shared-engine acceptance proves multi-owner delivery and CLI behavior.
Do not retain an executable fixed-participant scheduler to keep obsolete tests green.

Bundled live examples must select the general configured fixture or an explicitly
bound clean configured target. Earlier fixed-revision qualification manifests are
historical evidence recipes; they are not ready-to-run instructions for new modes.
No scripted campaign counts as a live gate.

Retired test contracts and their replacements:

| Earlier contract                                           | Current coverage                                                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Fixed requester/recipient recursion and parking            | Execution-runtime scheduler, inbox, continuation and workspace candidate suites                            |
| Per-owner active budget and correction quota               | Historical readers retain fields; no-budget execution and progress-diagnosis suites cover current behavior |
| Explicit proposal acceptance and two-owner routing         | Prompt CLI, direction evidence, director recovery and verification coverage suites                         |
| Legacy campaign success/correction and external acceptance | Prompt campaign, assignment host-check/regression suites and independent verification suites               |
| Legacy campaign cancellation and supervisor integrity      | Prompt cancellation, host-loss, runner-snapshot and campaign integrity tests                               |

Permission, immutable-authority, captured-test, real regression, operation and service
checks remain session characterization tests through a test-only subprocess entry.
Historical workday SQLite, proposal integrity, campaign inspection and report-checker
tests remain. Retiring a legacy outcome is not permission to remove the corresponding
current failure-mode coverage or weaken any captured live acceptance source.

## Package-aware architectural inspection

`arcnexus inspect <package> <component> [prompt]` resolves a registered package
from any working directory. Without a prompt it presents captured ancestor context,
effective owner policy, standards, public API, observed relationships and operation
identities. With a prompt it adds a planning preview, not an accepted assignment or
invented acceptance criteria. `--activity research|document|design|implement|review|release`
labels the requested context; a prompt defaults to implementation context.

Inspection never starts a host, invokes a model, prepares a workspace or grants write
or publication authority. A component outside the selected package, empty supplied
prompt or unsupported activity fails. The architecture library owns this read service
so later gateways can use the same contract. The temporary `inspect ... --project`
adapter remains for qualification callers until their migration; it cannot accept the
new activity option or ambiguously combine the two forms.

`workspace prepare <package> [--json]` prepares a registered package from any
working directory through the shared workspace service. Package references follow
portfolio resolution; command recipes, bindings and source revisions are resolved
under the hood. Success returns a workspace resource and exit 0; a retained failed
preparation returns 1, invalid input/preflight returns 2, and cancellation returns 130. An active repository host prevents preparation rather than allowing concurrent
repository mutation. Retired preparation options cannot select an alternate execution path.

## Scripted campaigns

`experiment run` no longer executes any manifest version. Use `test inspect/run
--component experiments` for deterministic campaign assertions. Those tests still
exercise the built task command; their orchestration is compiled only with tests.
Historical `experiment inspect` remains read-only. Use `task run --simulate` or
`workday start --simulate` for real-agent isolated lifecycle learning.

`workspace get <id>` includes captured execution progress: observed operation,
checklist claims, host verification evidence and cancellation state. Historical
missing fields remain unavailable; recorded old limits are evidence, not active
budgets. Reads do not start a host or load mutable source. Revision tokens change
when retained timeline progress changes, including updates between report saves.
Raw model turns, bindings and full event payloads remain outside this resource.

## Caller cancellation during host acquisition (planned)

Issue #285 carries the CLI caller's existing AbortSignal through task pause,
resume, stop and answer controls, retained workday controls, and delivery publish
and promote controls that acquire a host. Ordinary host acquisition receives the
same signal. Task submission and workday start retain their existing signal path.

SIGINT or SIGTERM interrupts readiness waiting promptly through the existing CLI
cancellation handling and exit code 130. Cancelling the wait leaves the detached
host's lifetime independent of the terminal. It does not introduce an execution
deadline or automatically cancel unrelated retained work.

Controls pass optional trailing signals through the execution-runtime public
interfaces, preserving answer payloads and expected-revision positions. A control
is dispatched once after readiness; an uncertain mutation response remains an
error and is never automatically replayed by the CLI. Read-only retained queries
continue to use their existing resource path.
