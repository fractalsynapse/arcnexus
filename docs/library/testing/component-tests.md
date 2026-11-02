# Component test selection

Use `arcnexus test inspect report --project . --json` to see the source suites,
compiled paths, metadata and hashes selected from the working checkout. Inspection
reads literal registrations; it does not import test modules, prepare an environment,
or invoke a model. Component roots and the shared profile come from captured HEAD.
Untracked regular suites under those roots are visible; symlink traversal is rejected.

For minimal v5 definitions, discovery derives test files from owned paths and captured
classification rules; no leaf repeats test directories. Containers contribute the
inherited profile without becoming test owners. The Node convention maps a package's
`tests/` tree into the profile output root, preserving paths below `tests/`. Both
captured and newly created suites use the same ownership and classification checks.
Unsupported source layouts fail with a diagnostic rather than selecting no tests.

Use `arcnexus test run report --project .` to prepare and execute that selection.
Omit the component to select all declared suites. Filters intersect:

```text
arcnexus test inspect --project . --level integration --category regression
arcnexus test run report --project . --tag deterministic --tag fast
```

Each repeated tag must match. A required selection containing no suites is an error,
not a passing test run. Unsupported profiles and malformed metadata are errors too.

## Suite structure

A maintained test file has one literal registration and a cohesive scenario class:

```typescript
import { registerSuite } from '../../../../dist/library/testing/suite.js';

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic'] });
```

The import depth depends on the file's location. Node's ordinary `test` declarations
still invoke the class's scenario methods; registration does not replace the runner.
Keep helpers in `support/`, where discovery does not report them as suites.

Use the owning component's `unit/`, `integration/`, `acceptance/`, or `regression/`
directory. Regression identifies why a suite exists; its registration separately
states the unit, integration, or acceptance level. A file with different testing
levels should be split so selection has a useful meaning.

## Preparation and evidence

New test profiles use schema version 2: `preparation` entries reference a shared
`operation` and retain their `purpose` (`production` or `tests`); `run` names the
shared finite test operation. Command definitions exist only in the operation
registry. The host resolves `selectedTestFiles` to the validated compiled suite
paths and `testOutputRoot` to the captured profile output root. Every preparation
and runner invocation uses source-read-only confinement and retains its captured
definition, context and output through the common operation executor. Required
verification remains a separate checkpoint from an engineering test invocation.

The captured test profile authorizes its preparation and runner references without
requiring duplicate component usages. Missing references, incompatible
profiles, services in finite checkpoints and mixed old/new test profiles fail before
execution. Repeated equivalent preparations run once per test checkpoint; changing
candidate inputs requires a new checkpoint. These rules also apply to test code and
package hooks: generated output is writable, maintained source is not.

Confinement qualification also requires retained stdout and stderr sentinels. A
successful exit without diagnostic transport is insufficient. On the tested Linux
runtime, Node socket-backed stdio inside the restricted sandbox can become a generic
`Writable` stream that discards output, while direct descriptor writes work. Confined
commands therefore preload a host-owned Node compatibility module that restores only
these inherited stdout/stderr descriptors. The preload is read-only and also applies
to Node subprocesses. Finite commands additionally receive host-opened regular output
descriptors because Node's test coordinator initializes its reporter before preloads.
A diagnostic-size watchdog retains the existing output limit; source/network
restrictions and cancellation supervision remain in force.

The shared Node profile declares preparation operation references and the compiled output
root. The service runs preparation once, then invokes Node with the selected compiled
files. `npm test` first builds the production service, then delegates to it with the
production preparation step marked caller-prepared. It does not recursively invoke
itself. Existing `npm run test:<owner>` commands are compatibility delegates.

Each invocation retains `result.json` and bounded command logs under the ArcNexus
state directory's `test-runs/`. Results include the captured revision, selected source
hashes, preparation commands, exit codes, durations and evidence paths. Cancellation
stops supervised processes and retains partial evidence. No default execution timeout
is introduced. Exit codes are 0 for success, 1 for preparation/test failure, 2 for
invalid input/selection, and 130 for cancellation.

Test execution accepts only minimal components and version-two operation profiles.
Historical inline profiles remain inspectable for migration but cannot execute through
a second unconfined runner. Independently captured acceptance and frozen regression
checks remain mandatory; selectable suites do not replace them.

Assignments capture suite identities and the shared profile's original bytes and
hashes before preparation. Final host checks reject deletion or selection-metadata
changes to captured mandatory suites; newly discovered suites may add coverage.
Captured frozen regression contents remain separately enforced. The test CLI also
accepts an explicit `--timeout-seconds` through shared cancellation; omitting it
leaves execution unbounded and cancellable.

The npm compatibility entry point prints retained command output before its JSON
summary so CI failures include the actual diagnostics. The public `--json` CLI keeps
stdout machine-readable. Selection reports distinguish unchanged, modified, and
added source suites; only profiles belonging to selected suites are prepared.

JSON results include a bounded excerpt from the latest command, with a truncation
flag and the complete retained log reference. Declared operations therefore deliver
actual compiler/test diagnostics to the steward without requiring access to the
private report directory. A caller-configured timeout is a failed execution; explicit
cancellation remains exit 130.

### One authority for profile execution

A captured test profile authorizes its referenced finite runner and preparation
operations for the testing service. Components do not repeat those references in
`operations` merely to make the profile usable. Component operation usages still
control agent tools and mandatory assignment lifecycle checks independently.

The testing service resolves the actual validated suite selection before expanding
runner arguments. A component may inherit test conventions before it owns a suite;
that must not trigger an empty runner invocation during catalog loading. Referenced
operations must still match the owner's repository, role activities and execution
profile categories, use supported finite definitions, and obey captured output and
source-read-only confinement policies. A missing reference fails before dispatch.

CLI inspection and run output project selected suites, profiles, resolved operation
steps and captured owner identities. They do not repeat the complete effective
component catalog. Retained test and operation evidence preserves the full captured
authority used for execution; reducing console output never narrows verification
or changes the selected command context. The npm compatibility runner uses the
same projection.

ArcNexus’s declared test operations invoke the test runner directly through the
shared executor. They do not recursively invoke the test CLI from inside a managed
operation. Preparation is expressed as operation prerequisites. The CLI remains the
caller-facing selection path. Repository-wide verification uses the compiled test
file pattern as a literal Node argument, preserving the project working directory
and shell-free argument handling. Node 22 documents this supported
[glob argument form](https://nodejs.org/download/release/v22.22.1/docs/api/test.html#running-tests-from-the-command-line).

The shared three-owner host fixture uses minimal executable configuration too.
Its platform supplies role, profile, reading and verification once; each executable
owner has disjoint maintained ownership, including future directories. Deterministic
model responses remain scripted, while sandbox requests delegate to the installed
native runtime so the same source-read-only operation path is exercised. This is
controlled acceptance coverage, never a substitute for live model qualification.
Legacy catalog fixtures remain confined to tests that explicitly characterize old
inputs until their callers have migrated; they must not define the general host path.

General-host suites carry the `native-host` tag and require an explicit
`ARCNEXUS_TEST_CODEX` executable for their v5 sandbox path. The normal confined
component run reports these cases skipped: a read-only operation cannot delegate
another kernel process scope. Caller qualification selects the same suites with
`arcnexus test inspect --tag native-host`, then runs the compiled cases from its
own delegated scope. This adds no product execution bypass and grants the tested
workers no additional source permissions. Report the confined and native results
separately; skipped native cases are not qualification evidence.

Assignment planning characterization now uses minimal fixture authority too. Ordinary
scripted engineering writes pass through `source.edit`, and shared regression checks
run under the installed native confinement adapter. The fixture records two checked
transactions for specification and implementation and uses stable operation IDs for
expected-red evidence. Scripted model responses are deterministic test inputs; they
are not live model qualification. Remaining legacy session scenarios are migration
work, not an alternate public execution mode.

The workspace fixtures now use minimal authority for both standalone and composed
preparation. Dependency cancellation waits for observed command output, then checks
retained child invocation evidence; it no longer uses an execution deadline as its
cancellation mechanism. Native-host selection includes these cases explicitly.

Assignment fixture migration preserves observable engineering and protection checks
while retiring obsolete caller quota behavior. The old workflow test requiring an
explicit attempt allowance is removed because that feature is intentionally retired.
The minimal limits suite instead demonstrates 25 successful operation calls and a
fourth implementation attempt; progress cases retain diagnosis and termination of
unchanged failures. Historical profile inspection remains read-only coverage.
