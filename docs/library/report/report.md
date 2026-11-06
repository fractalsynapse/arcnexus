# Execution report

The CLI retains machine-readable `report.json` and readable `report.md` outside the
candidate workspace. Markdown identifies the execution, objective, status, workspace,
base revision, failure when applicable, and command count, and points to evidence.
JSON includes observed changed paths and Git change kinds. Markdown includes a
`## Changed files` section listing each captured path and its Git change kind,
sorted by path in ascending, case-sensitive string order regardless of input order.
Paths are rendered as literal text, including Markdown punctuation, HTML, and line
breaks. Absent or empty changes produce `No changed files observed.`

Markdown also includes `## Outcome` with the captured workflow outcome and
`## Activities` with each captured activity/status pair. These sections use only
fields already present in the execution record; records without workflow fields
render safely without `undefined` or `null` text. The report does not inspect
target files or mutate the record or its arrays. Existing report fields, changed
file ordering, and JSON evidence are preserved.

`## Initialization` presents captured initialization evidence as readable labeled
lines: component, model, routing outcome, summary, selected owners with their
reasons, and outstanding questions. Missing historical initialization values say
`unavailable`. This summary uses only the execution record and does not replace
the JSON evidence. The following `## Execution progress` section continues to
show stage, current command, checklist, last verified progress, warnings,
cancellation, and configured limits.

`## Operations` summarizes captured operation results with each operation id,
`passed` when its captured `exitCode` is zero and `failed` otherwise, its
`durationMs`, and log path. Absent or empty operation history produces exactly
`No managed operations recorded.` `## Managed services` lists each captured
service id, status, and `endpointClosed` boolean. Absent or empty service history
produces exactly `No managed services recorded.` Both summaries use only captured
record fields and leave the records unchanged.

## Captured test selection

The report lists mandatory test suites captured in each component definition under
`resolvedAssignment.context`. Each entry shows the captured component id, source
path, test level, and SHA-256, sorted by source path in ascending, case-sensitive
string order. Rendering reads only the captured assignment context and does not
inspect test files or reorder the captured arrays. When historical records have no
captured test selection, the section says `unavailable`. An explicitly captured
empty suite list says `No tests captured.`

## Interpreting test and qualification evidence

For a test run, read the total together with passed, failed, and skipped counts.
The total is not the number of passing cases: skipped cases did not execute and
provide no passing evidence. A process can exit zero when every executed case
passes even though qualification cases were skipped; zero therefore does not show
that those skipped cases passed. Check the selection and skip reasons as well as
the exit status.

Evidence categories answer different questions:

- Deterministic tests exercise defined scenarios reproducibly, often with controlled
  fixtures. They show the covered behavior under those conditions.
- Native enforcement checks exercise real host controls, such as process, permission,
  or isolation boundaries. They show those controls in the tested environment.
- Live model qualification records an actual model-driven run through the intended
  workflow. It shows end-to-end behavior for that run and configuration.
- CI evidence shows the configured checks passed for a particular revision in CI.
  It does not establish live model behavior or native enforcement unless those checks
  actually exercise them.

These categories are complementary. Deterministic tests cannot establish live
qualification; live runs do not replace repeatable regression coverage; and neither
a local check nor another evidence category substitutes for CI on the revision
being assessed.

## General execution projections

The execution report JSON at `report` is a projection of one durable run. `run.id`
identifies that task or workday run; `run.mode` is `task` or `workday`, and the
summary also carries its objective, status, creation time, and selected evidence
fields. `assignments` is the run's separate work list. Each assignment has its own
`id`, `owner`, objective, status, dependencies and evidence. An owner can therefore
have multiple assignments in one run; count assignments, not distinct owners.

`counts.ready` and `counts.waiting` count assignments in those exact statuses.
`counts.verified` counts assignments whose status is `completed`, after owner
delivery verification. They are queue and delivery counts, not goal-completion
proof. In task execution, the host assesses the assembled candidate against the
whole objective after all assignments are completed; the run becomes `completed`
only when that assessment supplies `goalEvidence`. A completed worker turn or its
checklist is a worker claim, not independent verification. Verified owner delivery
is separate from both that claim and whole-goal completion.

`run.data.candidateRevision` identifies the candidate revision retained with the
run. `run.data.candidateLocation` is the captured candidate workspace path when
available. These fields identify a candidate; the path alone does not prove its
contents remain unchanged or integrated. Owner verification evidence is retained
as `verifiedEvidence`; whole-goal evidence is separately retained as `goalEvidence`.
A retained candidate is ready for caller review/integration, not already integrated:
the caller owns integrating it into the source checkout.

Detailed current-run `report.json` evidence records the run identity and mode,
ordered events and requests, source observations, and per-assignment identity,
status, milestones, delivered revision, verification and matching execution-record
observations. A worker's completion summary is not substituted for these host
observations. When historical records lack these newer fields, report them as
unavailable. Do not infer success from missing evidence or rebuild historical
evidence by reading mutable target files; preserve historical report readability.

Configured limits shown by legacy execution-progress reports are observations, not
proof that general task/workday execution enforces them. The general execution
interface does not accept work budgets; obsolete budget settings are rejected.
This does not waive cancellation, process supervision, output limits, permissions,
or independent host checks. Optional legacy execution-profile limits remain unset
unless explicitly selected.

General execution remains in qualification. The qualification record retains live
workday, lifecycle and self-development evidence, while the three-owner task gate
and remaining migration work still prevent phase-three readiness. Deterministic
tests do not substitute for the outstanding live demonstration.
Implementation references for these projections are
`src/library/report/execution-report.ts` and
`src/library/report/execution-evidence.ts`; assignment and run fields are defined
in `src/library/coordination-store/execution-types.ts`. Captured report checks are
`report-format`, `report-lint`, and `report-tests` in the report component
definition; `tests/library/execution-runtime/acceptance/verification-coverage.test.ts`
covers separate owner and whole-goal verification. The qualification status is
recorded in `docs/plans/general-agent-execution-qualification.md`.

## Coordination evidence

Reports summarize planned/actual/corrective turns, implementation attempts, elapsed
time, captured usage and its completeness/accounting basis. Supplied prompt bytes
and provenance references describe host-supplied context, not complete effective
Codex context. Host command results and independent acceptance remain distinct from
agent findings, uncertainty, boundary requests and caller interventions. Missing
historical fields say unavailable; they are not interpreted as zero or none.

For report assignments, obtain `report-format` feedback before interpreting
`report-lint` size results. Neither operation changes files. Captured verification
checks formatting and lint before expensive repository tests; the focused report
regression remains verification command 2. A formatting failure must be repaired
within report scope, not hidden by compressing expressions onto fewer lines.

### Investigation evidence

Research and review assignments receive `assignment.evidence` through their
host-bound MCP connection. Read `artifact=manifest`, then the advertised artifact
names, following `nextOffset` until `complete=true`. Pages use the same content
hashes, character offsets and maximum page size as `verification.evidence`.

The host captures other assignments in the same run, including checkpoint bytes,
checked-edit transaction journals, observed tool requests/results and managed
operation state. Director decisions, feedback and caller clarification accompany
the capture. Content remains pinned when original files subsequently change.
Missing records, journals and logs are explicit evidence gaps; an absent journal
alone does not prove an edit was never attempted. Worker observations remain
separate from trusted host checks.

The tool accepts artifact names and page bounds, never filesystem paths, owner
identities or run overrides. Foreign records and unsafe aliases are rejected.
Investigation evidence grants no write authority, does not declare an uncertain
operation completed and cannot make an unsafe checkpoint resumable.

Invalid evidence requests return bounded corrective rejections through the same
capability. An unknown artifact, including an identity quoted from another tool's
observations, grants no access: read the current capability's manifest and use its
advertised names. Malformed arguments likewise return a rejection without content.
A subsequent valid request can continue on the same connection. Invalid capability
routing, corrupted pinned content and host execution failures remain fatal; these
are not converted into ordinary client mistakes.

Independent verification repins the exact investigation artifacts referenced by
completed `assignment.evidence` observations. The current execution index includes
`verificationArtifact` names from its own manifest alongside the original observed
artifact identity and hash. Manifest observations also include `verificationArtifacts`
for their immediate entries, including artifacts the worker never opened. Reads validate the originating run and assignment,
regular private file identity and content hash. Missing retained content is an
explicit gap; foreign identities, aliases and hash mismatches fail capture.
Historical verification snapshots are not recursively expanded. An invalid tool
request remains a rejection in observations, never a claim of pinned content.

## Evidence read sizes

The shared evidence capability lets agents select a positive integer read length.
ArcNexus imposes no maximum page length. Optional offset/length paging remains
available, and omitted lengths use the default page size. Requests past the end
of an artifact return only its remaining content with honest `nextOffset` and
`complete` metadata. Invalid identities, offsets and malformed lengths still fail;
read size never grants access to another artifact or changes its captured hash.

Execution views retain every assignment's observed status and evidence, including
request-only work disconnected by an explicit director retirement. The `required`
field distinguishes current goal obligations from that retained history. Ready and
waiting counts cover required work; retirement never counts as verified delivery.

## Retained invocation diagnostics

The report exposes retained command diagnostics through the existing assignment
evidence paging capability. Each diagnostic includes the record, assignment,
invocation, and operation identities; observed exit status; canonical resolved
invocation context; and complete combined stdout/stderr captured in the invocation
log. Diagnostics include failed operations even when immediate command output was
truncated or the operation is absent from the worker command list.

A diagnostic is usable only when its invocation matches the captured record, run,
assignment, and operation. Missing logs, missing status or context, uncertain
results, foreign references, and unsafe paths remain explicit evidence gaps or safe
rejections; they never imply success. Historical artifacts and invocation identities
remain unchanged. The reader uses the existing immutable evidence paging path, with
no second reader, execution authority, or total read-size quota.

## Canonical execution evidence

Direction, steward investigation, independent verification and publication consume
the same captured execution facts and artifact assembly. The capture includes run
identity, retained caller input with caller attribution, assignment state, correlated
inbox requests and observed execution records. A consumer must not rebuild a smaller
copy that silently omits those facts. Candidate/authority identity and unavailable
historical evidence remain explicit; exposing input never accepts its claims.

Consumers add only their distinct responsibilities: direction annotates validated
continuation eligibility, investigation exposes checked-edit/checkpoint artifacts,
and verification adds the candidate patch and acceptance assessment. These additions
do not replace the common execution capture or introduce another reader or store.
Historical retained artifacts remain readable without rewriting their content.

Connected acceptance exercises capture through the actual consumer capability and
its advertised artifacts. Testing a projection and a manually assembled pager
separately does not establish that the production handoff preserves its evidence.
