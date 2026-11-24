# Inspection parity characterization

## Resumed Testing at revision fe55cd8

Run 187 resumes issue 728, branch `728-task`, with engineering base and captured
authority `fe55cd8ec28f25383f30822479c4b8ef8ecd32a7`. The host records recovery
from run 185 at sequence 142871 and checkpoint
`4a0e579a39038e7d2f491e780e588cacdce665d4` at 142873 in
`187-1-run-timeline.jsonl`. The original accepted criteria and completed
Documentation remain retained. The following run-185 and older sections retain
their original revision-specific meaning.

All artifact names in this section resolve in the registered evidence directory
for task `44c36124967005da7c9255e1c839803f6d37789a00cf257bfe2816208ff56c9b`,
indexed by `187-2-retained-evidence-963dbc2930a5b4015c7d4d855927348b5bbea05e8f2735a41723f2093a976aa6.json`
and the continuing run timeline. Complete mapped reads supplied the source,
provider artifacts and logs below; bulk transcripts remain outside source.

### Current characterization

The existing parity, listing, activation, LocalMcp and provider source hashes
still match those identified in the run-185 account. The complementary
[activity-tool suite](../tests/integration/activity-tools.test.ts) has SHA-256
`19a7e6b3e467142f95ac102830747a7255dd1837ccdae019dcfd769d62ea1b7c`.
Its handwritten bindings and partial HostTask characterize MCP transport,
validation and caller repair; the production-captured fixture supplies the
stronger parity comparison. No assertion or product code changed in this activity.

Because recovery advanced the base and authority, matching individual source
files was insufficient to reuse run-173 results. Testing obtained a fresh
expected-pass `owner-tests` observation against the recovered candidate.
`187-51-owner-tests.log`, SHA-256
`90dd6d5adb8f3013f4d6caa3d9f2d3211dd4d4f95ffbb547beb5efc54897a157`,
returned status zero in 39093 ms. Sequence 143020 records check-input identity
`dc991d5ca2f8b2a0f7584fbdd362fe4b8a7913995b9a2f30b3cc4e73b82d4250`.
Lines 2268–2273 report 269 tests, 253 passes, no failures and 16 skips.
The interrupted `185-220-owner-tests.log` contains build startup only and
establishes no behavioral result.

| Measure | Current observed assertions |
| --- | --- |
| `inspection-request-parity` | Log lines 1041–1132 pass the complete rendered/structured CLI and actual controlled subprocess comparisons for Director, disjoint steward activities, empty bindings and Reviewer. `assertSelected` independently requires authored purpose, selected procedure and source labels. The named-placeholder/no-effects case passes at 1145. At 1164, `returningContext`, `retainedIndex` and `taskSection` compare complete multiline answer, assignment, milestone, acceptance and ordered evidence before whole-input equality. Completed-round inputs are authored independently and exclude an unregistered report. |
| `inspection-project-authority` | `assertTools` compares actual HTTP MCP names, exact descriptions and schemas to prepared inspection and rendered Operations. The matrix checks disjoint/unmapped refusals and unchanged foreign bytes. Lines 1173–1197 pass complete retained requested listings for populated, disjoint and empty activities, with exact response, call identity, activity and journal ordering; no-request cases prohibit fabricated observations and handler effects. |
| `inspection-effects-provider-policy` | At 1145 inspection preserves complete output, Git status, worktrees and absence of storage while throwing sentinels guard activation, admission and upstream calls. The matrix independently checks cached web with tools, disabled web with tools, and disabled/live web with empty tools. `assertInvocation` checks actual argv/cwd, approved guidance bytes and absence of discovery-disabling flags or pasted guidance. Changed guidance is refused before native request creation at 1151; the assembled CLI scenarios pass at 1157. |
| `inspection-evidence-quality` | Complete controlled diagnostics retain stdin, argv, cwd, fixture executable, fixture capture revision, Node v22.23.5, MCP responses and exact refusals. They establish actual subprocess transport and file visibility, not real Codex inference, automatic guidance selection or enforcement by Codex of the supplied permission flags. The 16 skipped native scenarios supply no confinement proof. |

These assertions reject dropping context from both request paths, losing or
reordering returning evidence, inheriting another activity's tools, stale tool
metadata, fabricated listings and coupling web policy to project grants. Current
characterization demonstrates no new uncovered behavioral requirement, so no red
or new regression is manufactured. Historical intended red remains historical.

The required quality operations also returned actual status zero:
`187-106-owner-format.log` (sequence 143185),
`187-109-owner-lint.log` (143193),
`187-112-repository-types.log` (143201) and
`187-115-repository-build.log` (143209). Complete logs identify owner-scoped
TypeScript formatting/lint, repository strict types and build. Their resolved
commands, selections, expected-pass scope and input identities are in the timeline.
These observations precede this evidence-only Markdown update; unchanged executable
and fixture bytes support reuse, subject to the host's mandatory applicability
validation for the resulting checkpoint.

### Configured-provider comparison and unavailable observations

Testing read each complete prepared request, invocation and requested listing:

| Selected activity | Request / invocation / listing | Listing call and timeline sequence |
| --- | --- | --- |
| Direction/planning | `185-2` / `185-5` / `185-6` | `35bc7f65-54f0-4228-8e33-9d9307781a0a`, 142200 |
| Execution/documentation | `185-92` / `185-95` / `185-96` | `5e2a0dc1-3ac8-4568-875f-98be48ec4ea4`, 142473 |
| Execution/testing before interruption | `185-186` / `185-189` / `185-190` | `d077b7d7-6791-4c2d-a596-afba471a2803`, 142766 |
| Execution/testing after recovery | `187-3` / `187-6` / `187-7` | `edda0fde-7024-4e30-bea6-ec87029c2c19`, 142885 |

Request, invocation and listing suffixes are respectively
`-native-request.json`, `-native-invocation.json` and
`-mcp-observation.json`. For each row, removing only internal `handler` from
the complete prepared tool array produces exact equality with the actual
`tools/list` response, including descriptions, schemas and order. Journal
metadata supplies the selected activity attribution. All four are populated
bindings; they establish neither a real-provider empty listing nor Reviewer
listing. The run-185 rows retain their original `cd5c2b30` authority, while
nativeStarted sequence 142881 identifies the recovered `fe55cd8` activation.

Invocations identify `/usr/local/bin/codex`, gpt-6.1-sol, medium reasoning,
live web policy, disabled shell/unified-exec and a required local project MCP
endpoint. The timeline identifies profile gpt-sol and host Node v22.23.5.
These are configuration observations, not proof of web use or an independently
received full model context. No fresh Codex version receipt is present in these
artifacts; the older operator-observed version remains separately attributed below.

Complete reads of `185-3-codex.jsonl` and `185-93-codex.jsonl` expose
thread/turn starts, item starts/completions and turn completion. Their item types
are agent messages and MCP tool calls. `185-187-codex.jsonl` has 32 records
and no turn completion; its interrupted stream is preserved rather than called
a successful provider turn. All three corresponding stderr artifacts are empty.
None exposes authoritative automatic AGENTS/skill discovery or a complete
model-received context receipt. A prepared host envelope is not that receipt;
the controlled executable provides the independent stdin comparison. No live
empty-binding, Reviewer or automatic discovery observation is inferred.
The accepted plan explicitly requires these unavailable fields to remain unknown,
rather than requiring fabricated provider evidence.

Implementation can consume this passing characterization and precise provider
classification without recreating historical red. Independent assembled acceptance,
hosted CI/review, staging delivery and live qualification remain host responsibilities.

## Review at revision cd5c2b30

This account supports maintainers and reviewers assessing run 185's
`inspection-current-assessment` milestone at
`cd5c2b30e596d8da2ad3c9024cf00a6e6ee35ec1`. The accepted plan is retained
in `185-1-run-timeline.jsonl`, sequence 142460, task
`44c36124967005da7c9255e1c839803f6d37789a00cf257bfe2816208ff56c9b`.
Its initial readable index is
`185-91-retained-evidence-d2cfd8ca34cb4ae89d87f63166c6d4133cf1f88081be08bbf524eba4bd505151.json`.
Registered artifacts remain outside source and are read through mapped file access.

The [intent](inspection-parity.md) and this review reflect current source before
behavior changes. The shared Agent/Architecture builder, activation enrichment,
native observation, adapter, guidance validation and LocalMcp were inspected.
The locked EX-6/EX-16 and ARC-9/ARC-13/ARC-18/ARC-24 boundaries support the
requested account; no contract change or authority expansion is needed.

### Existing coverage and historical observations

The current [parity suite](../tests/integration/inspection-activation.test.ts)
already contains `enrichment`, `liveContext`, `returningContext`,
`retainedIndex` and `taskSection`. Its SHA-256 is
`a556a23d714e68ed9222c36b9472dec2838537dd9b5e4502654a26de6849cb14`,
matching the final run-173 account. The controlled
[provider](../tests/fixtures/inspection-provider.ts) likewise retains
`d91ba5a398742169a5d7c6b9b2d585ca59beb404688c427831b087bfa1c552db`.
The matrix supplies a registered completed-round report and timeline for every
actor and excludes an unregistered report. The returning caller independently
compares complete assignment, milestone, acceptance and ordered evidence, including
a whitespace-preserving multiline answer, prior observations, a retained index
and a distinguishable new observation, before the whole-input comparison.
The original run-173 Documentation handoff's enrichment gap was resolved in
Testing. It is not a missing assertion at this evaluated revision.

The [listing suite](../tests/integration/inspection-listing.test.ts) retains
SHA-256 `c62a0c1e87dd7f4afe3365e014f5c1b4f699fdb9f829a32145126ab91649e99b`.
Current activation and LocalMcp hashes are respectively
`de2435c9cebcc5991ae53983154fb13603793c47735aea7a08bd484152b0b28a`
and `0374073cec864afc11d9382bf431fff8a80f59395efce24ac9bf124c1fafc3f5`.
These match the prior documented sources; a file match alone is not a reuse
decision for all dependencies, captured authority, parameters or environment.

Complete mapped reads during this documentation review reexamined
`173-563-owner-tests.log` and `173-1-run-timeline.jsonl`, retained under task
`69522e511245ab8e4416a6fe34091d5a0a3344a2a6faebfa00a098f6fd660c44`.
The log SHA-256 is
`b52dd2656eab522e34706b54800b00eb505ce42372b948810951a77050ae57ea`.
The host recorded status zero at sequence 136839 with check-input identity
`0965fe5c69ba2a292cfa818492b48258a21a665381c77f0189fd86d37e72533d`.
It reports 269 tests, 253 passes, zero failures and 16 skips, including complete
actor/CLI parity, returning-caller parity and requested/unrequested listings.
The run-173 sections below identify the tested checkpoints and exact assertion
excerpts. These are historical controlled results, not fresh run-185 execution.

The complete historical quality logs were also reread:
`173-551-owner-format.log`, `173-554-owner-lint.log`,
`173-557-repository-types.log` and `173-560-repository-build.log`.
The host timeline records status zero at sequences 136806, 136814, 136822 and
136830 respectively. These establish their original selections and results.
This activity neither reruns them nor declares them applicable to the new
candidate. The historical failed assertions, formatter/lint diagnostics and
run-138 listing-retention red remain below with their original interpretation.

### Current acceptance and remaining observations

| Current measure | Tracked assertions and remaining observation |
| --- | --- |
| `inspection-request-parity` | `assertSelected`, `assertInvocation`, native actor matrix, complete CLI cases, named placeholders and returning-caller scenario in the parity suite. Establish applicable complete rendered/structured and actual confined subprocess input/options results for Director, steward and Reviewer using the already authored enriched inputs. Run-173 passing assertions are available for a justified reuse decision; source presence is not a current pass. |
| `inspection-project-authority` | `assertTools`, refusal/foreign-byte assertions and listing suite `assertRetained` compare exact identities, descriptions and schemas, populated/disjoint/empty grants, complete registered responses, call identities, selected attribution and native-span ordering. No-request cases and throwing dispatch sentinels prohibit fabricated listings and project effects. Establish current applicability or obtain fresh observations. |
| `inspection-effects-provider-policy` | Repeatability/no-effects, native policy matrix, `assertInvocation` and changed-guidance refusal cover inspection without model, admission, storage, worktree or upstream effects; cached/disabled/live web options independent of tools; approved file visibility and unchanged discovery configuration. Establish applicable results at these boundaries. Keep skipped confinement and unexposed harness internals distinct. |
| `inspection-evidence-quality` | Testing classifies applicable controlled and configured-provider artifacts. Implementation records actual current or justified reused owner format/lint/tests and repository types/build status, logs and input identities. The host alone supplies assembled verification, independent acceptance, required hosted CI/review and staging delivery for the exact candidate. |

The run-185 plan explicitly distinguishes the supplied run-183 checkpoint
verification from criterion-linked parity evidence. Repository-wide success for
different criteria does not establish unexercised parity or live behavior.
Testing should characterize existing behavior with expected pass; only a
demonstrated uncovered behavioral requirement calls for new red. Implementation
corrects demonstrated defects and preserves passing behavior otherwise.

### Provider provenance and document validation

The retained [provider research](../../../.arc/research/execution/00ffe9d0f3fd962bb54eb21db01bbae6521269e7c2b4e4c1fb1953bcb86fd761.md)
was consulted. Its missing tools/list-retention finding predates the run-138
repair. Run-173 configured-provider records below already document populated
requested listings; do not revive that defect or infer real empty/Reviewer
listings from prepared arrays. Current Testing must classify relevant retained
request, invocation, requested-listing and event artifacts through the journal,
naming actual source/candidate, runtime and settings and what can be compared.
No new configured-provider comparison is claimed by this documentation review.

Controlled executable receipts establish actual transport and approved-file
visibility. Prepared real-provider requests and invocation artifacts establish
host preparation and settings. Neither supplies an independent complete
model-received-context receipt or authoritative automatic guidance-discovery
record unless the provider exposes one. The historical operator-supplied Codex
version/image retains that provenance. Unexposed provider internals remain
unavailable observations, not required new event types assumed to exist.
Preserve normal discovery and captured-byte validation without pasting guidance
into the prompt, adding another invocation path or changing project/web grants.

Documentation validation inspected source facts, assertion anchors, local links
and agreement with the current accepted plan. This prose-only contribution
changes neither product behavior nor tests, runs no software checks and claims
no assembled readiness. Its checked-edit receipts identify the resulting
documentation checkpoints; the evaluated base/authority above and historical
tested candidates remain distinct. All remaining software/provider observations
and host acceptance retain their normal activity boundaries.

## Historical review at revision 7d04db61

The following run-173 handoff, Testing and Implementation records preserve their
original criteria and results. References to “current” in those records mean
that run's identified candidate. Its initial enrichment-gap description records
what Documentation requested then; the subsequent Testing observations resolve
it and are the current source baseline described above.

This account supports maintainers and reviewers deciding which observations
apply to `inspection-current-evidence` at
`7d04db61627b4e76e0fda4ac1003ab5b26d18e8e`. Run 173's accepted plan is
recorded in `173-1-run-timeline.jsonl`, task
`69522e511245ab8e4416a6fe34091d5a0a3344a2a6faebfa00a098f6fd660c44`.
Its initial complete artifact index is
`173-83-retained-evidence-64baea19ec58d9d2a1e82ceac756d1780f7bf6ed6e8e7fd6ff1ca490a1cdd50a.json`.
Read registered references through the mapped read operation; an index alone
does not establish the contents of a response or check log.

The documentation review inspected the shared Agent and Architecture request
path, activation enrichment, guidance validation, native observation, LocalMcp
and the tracked parity/listing assertions. It also consulted the retained
Execution provider-evidence research and completed-round report
`158-2-refinement-round-1.md` (SHA-256
`97f30806693a11052cb4f1075a11a8b780295d5d4ef1344d94702d7c500b6717`).
That report cites run 147's repository checks at the evaluated revision, tree
`faddf36c0ba3e3ba4dac1f108577b97c50585085`, PR 721, against recovery and
publication criteria. This is reported broad verification, not a newly inspected
criterion-linked parity log or independent parity verdict.

| Measure at Documentation handoff | Exact tracked assertion anchors | Observation requested at handoff |
| --- | --- | --- |
| `inspection-request-parity` | [inspection-activation.test.ts](../tests/integration/inspection-activation.test.ts): native activity matrix, `context`, `assertSelected`, `assertInvocation`, `readProbe` and complete CLI inspection cases. | Current complete subprocess input/options and rendered/structured observations for every actor. Assess completed-round, registered timeline and returning-caller evidence coverage against `invocationContext`; the current helper explicitly supplies assignment and Reviewer diff, without explicit completed-round/returning-caller cases. |
| `inspection-activity-authority` | Same suite: `assertTools`, refusal assertions and unchanged foreign file. [inspection-listing.test.ts](../tests/integration/inspection-listing.test.ts): `assertRetained`, populated/disjoint/empty matrix and no-request cases. | Applicable actual MCP response comparisons and complete registered response artifacts with call identity, component/activity and native-span ordering. Current source already contains the listing retention repair; no new retention red is presumed. |
| `inspection-effects-and-policy` | Same parity suite: no-effects/repeatability case, web-policy activity matrix, `assertInvocation` and changed-guidance refusal. | Current controlled observations for these assertions. Preserve the distinction between approved file visibility/configuration and authoritative harness discovery. Examine available current configured-provider artifacts without inferring unexposed context. |
| `inspection-evidence-accuracy` | This account and [intent](inspection-parity.md), linked source anchors and host journal receipts. | Add actual current status/logs, candidate and check-input identities, quality results and any justified reuse. Record unavailable real-context/discovery receipts and skipped native cases explicitly. Independent verification, CI and delivery remain host observations. |

The Testing observations below supersede this handoff's pending observations.
Reviewed source identities at Documentation provide comparison anchors, not passing checks:

- `inspection-activation.test.ts`: SHA-256 `345b3a22b04e23cdfebee6f7bdc2be717f5d8a86e6fc1c11fc4e9c7a47cb5e90`.
- `inspection-listing.test.ts`: SHA-256 `c62a0c1e87dd7f4afe3365e014f5c1b4f699fdb9f829a32145126ab91649e99b`.
- `src/mcp.ts`: SHA-256 `0374073cec864afc11d9382bf431fff8a80f59395efce24ac9bf124c1fafc3f5`, matching the historical run-138 repaired file.
- `src/activation.ts`: SHA-256 `de2435c9cebcc5991ae53983154fb13603793c47735aea7a08bd484152b0b28a`.

Matching one file does not establish unchanged dependencies, environment, operation
selection or authority. Testing should characterize existing behavior with
expected pass, retain ordinary failures and repair their actual cause; add
behavioral red only for a demonstrated new gap. Implementation should preserve
passing behavior unless current observations identify an owned correction.

Run-138 controlled results and owner quality logs below retain their original
base, candidate, check-input identity and criteria. They are historical observations
documented by that run, not checks newly executed or all reread during this
documentation activity. The retained research was consulted as historical
evidence; its statement that tools/list was unretained predates the repair below.
Do not revive that resolved defect or erase its original red.

The run-138 clarification's unavailable complete received-context and authoritative
guidance-discovery receipts remain recorded limitations of those observations.
Its installed version/image statement is operator attribution. No current
Reviewer, empty-operation real-provider listing or discovery receipt is inferred
from that history. The earlier oversized report read failure is also historical:
this activity neither repeats it nor assumes the current read mapping has the
same range support. No missing report contents are inferred from a reference.

Document validation for this contribution consists of checking current facts,
source anchors, local links and consistency of the current criteria with the
accepted plan. No behavioral correction or software check was performed in this
documentation activity. The host determines evidence reuse and assembled
acceptance after the remaining activities.

## Testing observations for run 173

Testing characterizes existing behavior with expected pass; it changes no product
code and claims no new behavioral red. Engineering base and captured authority are
`7d04db61627b4e76e0fda4ac1003ab5b26d18e8e`. Documentation finished at
`1ff975274ea5f75bfaadf8408164d64a38d41590`. The final tested source checkpoint is
`47fa89c994a832a285d569049fb41b5d56d0c5d1`, journal sequence 136308.
The test file SHA-256 is
`a556a23d714e68ed9222c36b9472dec2838537dd9b5e4502654a26de6849cb14`;
the controlled provider SHA-256 is
`d91ba5a398742169a5d7c6b9b2d585ca59beb404688c427831b087bfa1c552db`.
The evidence-only update containing this account follows that tested checkpoint.

The initial current characterization, `173-200-owner-tests.log`, passed 252 of
268 cases with zero failures and 16 skips. Source review demonstrated an enrichment
coverage gap. The existing activity matrix now supplies a registered timeline
and an explicitly authored, registered completed-round report to the real SQLite
journal, independently constructing the identical effective inspection context.
A second round with an unregistered report must remain absent. The matrix still
covers Director, steward, Reviewer, disjoint activities and both empty-tool policies,
including the independently retained Reviewer diff. This fixture establishes
request consumption of explicit journal records, not production of a real
refinement round or live model reasoning.

A returning-caller scenario adds an explicitly captured question operation to its
isolated fixture before admission. The controlled executable invokes that mapped
operation; the host answers with distinguishable multiline text, including leading
and trailing spaces, and records a distinct new observation. Foreground snapshots
identify artifacts allocated before each native request without reading its payload
as the expected input. `returningContext` constructs the expected assignment and
ordered evidence; `retainedIndex` checks the complete index against those original
artifacts and reads every reference. Assertions compare the exact assignment,
acceptance, milestone, evidence order and complete subprocess stdin with shared
Agent preparation. Dropped answers, missing rounds, reordered references,
lost pre-return observations, duplicate returns and unregistered reports cannot
satisfy these comparisons. No transcript is recursively copied into a later prompt.

The final complete observation is `173-408-owner-tests.log`, SHA-256
`8c963fd9be0ea7b7487432ef52e10f46c2601196549168a6d6f5df7f3313f308`.
It returned actual status zero at journal sequence 136350, check-input identity
`404fe850435b224e6e2312844cd8fd06c1bec9de894edca0b35e5b30beb0cd6c`.
Lines 2268–2273 report 269 tests, 253 passes, zero failures and 16 skips.
The skips remain unavailable native evidence, not passing confinement scenarios.

| Current criterion | Exact assertions and current retained observation |
| --- | --- |
| `inspection-request-parity` | `inspection-activation.test.ts`: `enrichment`, `liveContext`, `assertSelected`, `assertInvocation`, native activity matrix and complete CLI cases. Log lines 1041–1132 pass complete input/options comparisons for all actors and empty/disjoint activities. Lines 1163–1169 pass the returning caller and retain its complete controlled receipt. `context` includes the real Reviewer diff. Named placeholders and no-effects inspection pass at 1145; assembled CLI scenarios at 1157–1162 include seven passes and no skips. |
| `inspection-activity-authority` | `assertTools` compares names, exact descriptions and schemas with actual HTTP MCP responses and rendered Operations; refusal assertions preserve exact foreign bytes. `inspection-listing.test.ts` `assertRetained` compares complete registered response artifacts, call identity, selected attribution and native-span order. Lines 1173–1197 pass populated, disjoint, empty and unrequested cases. Throwing dispatch sentinels reject project-handler effects during listing. |
| `inspection-effects-and-policy` | The activity matrix and `assertInvocation` compare cached, disabled and live web options independently of project tools, and approved file visibility without pasted guidance. Repeatability and no model/admission/upstream/storage/worktree effects pass at 1145. Changed captured guidance is refused before provider startup at 1151. These are controlled transport and configuration observations. |
| `inspection-evidence-accuracy` | This section maps current observations to exact tracked assertions, authority, checkpoint, input identity and log excerpts. Complete stdin/argv/cwd/tools/guidance receipts remain in the owner log; configured-provider records below have separate provenance. Host assembled verification, CI and delivery are not claimed. |

Applicable current quality operations all returned actual status zero:
`173-396-owner-format.log` (sequence 136316),
`173-399-owner-lint.log` (136324),
`173-402-repository-types.log` (136332), and
`173-405-repository-build.log` (136340). They assess the full restored source,
including the returning-caller assertion. The host retains their resolved commands,
selection, durations and individual check-input identities in the run timeline.

Preserve the failed observations. `173-259-owner-tests.log` reached the returning
subprocess but its expected assignment placed completedRounds before clarifications,
unlike actual host enrichment. Correcting that fixture's insertion order preserved
the complete byte comparison; it is setup feedback, not intended behavioral red.
Formatting/lint failures remain registered. The checked formatter reported
“Installed project formatter unavailable”; manual source corrections and temporary
declaration isolation diagnosed formatting. Intermediate format-only passes on
partial diagnostic source are not acceptance evidence. All assertions were restored
before the final passing quality and behavioral observations above.

### Current configured-provider observations

Complete mapped reads of `173-2-native-request.json`,
`173-84-native-request.json` and `173-160-native-request.json` retain the prepared
Director/planning, Execution/documentation and Execution/testing requests.
Their invocation artifacts are `173-5`, `173-87` and
`173-163-native-invocation.json`. They record `/usr/local/bin/codex`,
gpt-6.1-sol, medium reasoning, independently configured live web policy, disabled
native shell and unified execution, and a required local MCP endpoint. Timeline
sequences 135079, 135328 and 135567 attribute those activations to the evaluated
revision, profile gpt-sol and host Node v22.23.5. These are host-side preparation
and invocation records, not independent complete received-context receipts.

Unlike the old pre-repair research, current requested listings are retained.
Complete reads of `173-6`, `173-88` and `173-164-mcp-observation.json` compare
exactly with the corresponding prepared tool arrays after removing only internal
handler fields: names, descriptions and schemas all agree. Journal sequences
135083, 135332 and 135571 attribute them respectively to the same selected
activities and preserve their call identities. These configured-provider requests
all have populated bindings; no real empty listing or Reviewer receipt is inferred.
Controlled empty/disjoint and no-request assertions remain the evidence for those
cases. Prepared arrays alone are never reported as requested listing receipts.

No new authoritative real-harness discovery or complete received-context receipt
is established by these artifacts. Current invocation configuration preserves
normal discovery, while controlled subprocess file reads establish only approved
file visibility. The earlier operator-supplied Codex version and image remain
historical attribution, not a newly measured version for run 173. Provider internals
that are not exposed remain unknown. No model claim, explicit skill read or
successful mapped tool call is promoted into automatic AGENTS/skill discovery proof.

## Implementation observations for run 173

Implementation retains the passing product and test behavior. Review of the
shared Agent/Architecture builder, activation enrichment, native adapter and
LocalMcp found no demonstrated product correction. The evaluated architecture
and engineering base remain `7d04db61627b4e76e0fda4ac1003ab5b26d18e8e`.
The candidate before this evidence-only update is Testing's final documentation
checkpoint `628ec305d059d7ca636ae5fddc606c845303c941`; executable assertions
retain the source identities recorded above. The checked-edit receipt for this
account identifies the subsequent documentation candidate.

### Exact assertion and implementation excerpts

These excerpts are from complete mapped source reads, rather than reconstructed
expectations. The criterion table above remains the full assertion mapping.

- `inspection-request-parity`: [inspection-activation.test.ts](../tests/integration/inspection-activation.test.ts)
  lines 221 and 422 both assert
  `assert.equal(probe.input, view.request.input);`. The first covers the
  actor/activity matrix after independent enrichment; the second covers the
  returning caller after separate assignment, evidence, milestone and acceptance
  comparisons. Lines 60 and 63 assert the independent web option and absence of
  discovery-disabling configuration:
  `assert.ok(probe.args.includes('web_search=' + JSON.stringify(options.webSearchMode)));`
  and
  `assert.ok(!probe.args.some((arg) => /project_doc_max_bytes=0|skills.enabled=false/.test(arg)));`.
- `inspection-activity-authority`: the same source at line 35 requires
  `assert.deepEqual(probe.tools, expected);`; `expected` projects each prepared
  tool's name, description and inputSchema. The following assertions compare
  rendered operation IDs and descriptions and require exact refusal diagnostics.
  [inspection-listing.test.ts](../tests/integration/inspection-listing.test.ts)
  independently requires `assert.deepEqual(stored.result, { tools });` and
  registered artifacts with selected component/activity and native-span ordering.
- [activation.ts](../src/activation.ts) preserves returning evidence with
  `...retainedEvidence(task),` and builds completed-round assignment context with
  `assignment: rounds.length ? { ...instructions, completedRounds: rounds } : assignment,`.
  The tests author their round and answer inputs separately, rather than deriving
  expected input from the retained native-request payload.
- [mcp.ts](../src/mcp.ts) records the requested response through
  `this.observe('tools/list', undefined, {` with `call: randomUUID(),`,
  `phase: 'completed',` and `result,`. Its tool projection removes only the
  internal handler; no project handler is dispatched to list tools.
  [codex.ts](../src/codex.ts) separately passes `input,` to the subprocess and
  sets `web_search=` from `options.webSearchMode`.
  [host-config.ts](../src/host-config.ts) compares guidance bytes with
  `readFileSync(absolute, 'utf8') !== capture.source.read(path)` before startup.

### Current observations and applicability

All five mapped Implementation operations returned actual status zero:
`173-551-owner-format.log`, `173-554-owner-lint.log`,
`173-557-repository-types.log`, `173-560-repository-build.log` and
`173-563-owner-tests.log`. These are new observations against the candidate
above, with unchanged executable inputs, captured operation parameters and
configured environment. Complete logs were read through mapped file access.
The host timeline records each resolved command, scope, input identity and status.

The new test log SHA-256 is
`b52dd2656eab522e34706b54800b00eb505ce42372b948810951a77050ae57ea`.
Exact excerpts include
`ok 129 - EX-6: returning caller preserves exact enriched native input`
(line 1164),
`ok 132 - EX-26: retain requested activity tool listing for work/empty`
(line 1185), and
`ok 134 - EX-26: do not fabricate an unrequested listing for work/empty`
(line 1197). Lines 2268–2273 report `# tests 269`, `# pass 253`,
`# fail 0` and `# skipped 16`. Actor matrix and complete CLI comparisons
pass at lines 1041–1132; repeatability, guidance refusal and assembled CLI cases
pass at 1145, 1151 and 1157. The skipped cases still supply no native confinement
proof. This account update changes prose only; subsequent mandatory host checks
determine applicability to the resulting checkpoint.

Implementation reread the complete configured-provider requests, invocations and
actual requested listings identified in Testing's section. Comparing each full
prepared tool array after removing only `handler` against its full response
array yields exact agreement for all three selected activities, including schemas.
For example, `173-6-mcp-observation.json` contains
`"name":"tools/list"`, `"phase":"completed"` and call identity
`7284af13-3575-4a05-8b02-fd8d4bdd7574`; the timeline attributes it to
Direction/planning at sequence 135083.

The current Implementation activation adds `173-457-native-request.json`,
`173-460-native-invocation.json` and `173-461-mcp-observation.json`.
Its complete requested listing also equals the prepared tools after that same
projection. Call `ee442291-c518-4227-abf3-cfa0997acba3` is attributed to
Execution/implementation at sequence 136532; nativeStarted at 136528 records
profile gpt-sol, gpt-6.1-sol, medium reasoning, Node v22.23.5 and the evaluated
architecture. The invocation records `web_search="live"`,
`features.shell_tool=false` and `features.unified_exec=false`.
This is another populated configured-provider listing, not an empty-binding or
Reviewer real-provider observation.

Complete reads of `173-3`, `173-85` and `173-161-codex.jsonl` show
`thread.started`, `turn.started`, `item.started`, `item.completed` and
`turn.completed`; exposed item types are `agent_message` and
`mcp_tool_call`. They contain no authoritative discovery or complete
received-context event. The exact retained host envelope and invocation settings
can be inspected, but no independent full real-Codex stdin receipt exists here
to compare with a replay using identical enriched inputs. The controlled
executable supplies that byte comparison. Normal discovery configuration and
approved-file visibility remain established at their respective boundaries;
automatic real-harness selection and complete model context remain unavailable.
No additional prompt, provider invocation path, project grant or web authority
was introduced. Independent assembled acceptance, hosted CI and delivery remain
outside this engineering claim.

## Historical characterization and run-138 repair

The remainder preserves the prior account. Its uses of “current” refer to the
candidate and observations identified within that historical section; they do
not assert a fresh run-173 pass.

Testing for `execution-inspection-activation-parity` characterizes the existing
production behavior. No product behavior was changed and no behavioral red is
claimed. The governing intent remains [inspection parity](inspection-parity.md).

The [public scenarios](../tests/integration/inspection-activation.test.ts) use
production Architecture capture, Agent preparation, Execution admission, a real
SQLite journal and an issue-numbered Git worktree before activation. An explicit
compiled TypeScript executable receives native stdin and argv and calls the
production LocalMcp HTTP endpoint. Collaboration publication and remote-head
observations are isolated at their public boundary; this is not hosted delivery.

| Criterion | Caller, observable result and discriminating assertion |
| --- | --- |
| `parity-exact-native-request` | Director, steward and Reviewer activate through HostTask and Agent. Compare the entire subprocess stdin to the prepared request with identical enriched inputs, including Reviewer's retained candidate diff. Independent assertions require full purpose, selected procedure, authored source labels and all named unavailable inputs. Dropping context from both paths cannot satisfy those assertions. Native cwd, model and reasoning are checked against resolved options. |
| `parity-captured-activity-tools` | The subprocess calls actual MCP tools/list. Compare operation identities, exact descriptions and schemas with structured inspection and rendered Operations. Disjoint read/list activities and explicit empty activities reject inherited grants. Calls to another activity's operation and shell must return the mapping refusal; a mapped foreign edit must name the captured reviewer owner and preserve the exact original file. |
| `parity-provider-policy-guidance` | Actual argv records cached web with tools, disabled web with tools, and both disabled and live web with empty project tools. Approved guidance and skill bytes remain visible in the native cwd, absent from pasted prompt content, with discovery-disabling flags absent. Changed guidance is refused before a native request artifact exists. |
| `parity-current-inspection-evidence` | Repeat public inspection with throwing model, admission and upstream sentinels; compare complete output, Git status, worktrees and absence of application storage. Execute the existing built CLI request-parity and inspect suites in a separate test process and retain their TAP output, requiring no failures or skips. Those scenarios compare rendered and structured requests. |

The current passing characterization observation is retained by run 120 as
`120-498-owner-tests.log`, through the host's registered evidence path. It includes
complete controlled subprocess observations (captured revision, executable,
Node version, stdin, argv, cwd, discovery, refusals and guidance bytes) and the
assembled CLI TAP output. The host associates the operation with the actual
candidate checkpoint. Earlier observations remain readable: initial fixture
failures involved unisolated Collaboration calls, Git branch display decoration,
cleanup ordering, Reviewer's missing enriched comparison input, the compiled CLI
path and inherited Node test-runner context. They are setup feedback, not red.

## Requested listing retention regression

The run 138 host clarification identifies an uncovered retention defect:
LocalMcp answers tools/list, but only tool calls reach activation's journal.
Add a production admission/Agent/Execution regression that compares the complete
requested response with captured inspection tools, then reads the exact retained
response through the journal's registered evidence source. Exercise populated,
disjoint and explicitly empty activity bindings. Require a nonempty call identity,
selected component/activity attribution and ordering inside the native activation.
A provider that makes no MCP request must produce no listing observation.
Listing alone must never dispatch a project handler. These assertions reject
dropped listings, fabricated empty listings, foreign activity metadata and
description/schema loss; production correction belongs to Implementation.

The new [listing regression](../tests/integration/inspection-listing.test.ts)
uses the existing controlled executable in listing-only and no-request modes.
It registers the normal foreground timeline before activation, then reads durable
metadata and registered response artifacts through HostTask.readFile. A throwing
project-dispatch sentinel detects any handler invocation during discovery.

Run 138 retained the intended red in `138-779-owner-tests.log`: each of
work/testing, work/documentation and work/empty receives the exact advertised
response, but fails “retain the single requested tools/list response” with zero
retained responses instead of one. Both no-request cases pass. Existing
inspection/activation, activity-tool and assembled CLI comparisons still pass.
The whole observation reports 249 passes, these three intended failures and
16 existing skips; skipped native scenarios remain unproven. No production
implementation changed. Initial missing activation inputs and an unregistered
foreground timeline were corrected fixture setup failures, retained respectively
in `138-748-owner-tests.log` and `138-758-owner-tests.log`.

Current required quality observations are `138-782-owner-format.log`,
`138-785-owner-lint.log`, `138-788-repository-types.log` and
`138-791-repository-build.log`, all actual exit zero. Formatter transformation
was unavailable in the managed checkout; literal checked edits corrected source
formatting, with failed formatting observations preserved. Checkpoint identities
and complete logs remain in the host journal; bulk output is not copied here.

Retain the prior passing characterization separately from the new intended red.
Host clarification 138-567 records operator-observed codex-cli 0.172.0 and the
qualification image identity. The configured provider exposes neither a complete
received-context receipt nor authoritative AGENTS/skill discovery tied to approved
bytes. No earlier Reviewer or empty-operation provider receipt was located.
These unavailable observations remain gaps, regardless of controlled test results.

The controlled executable proves transport and file visibility, not live inference
or the real Codex harness interpreting discovered guidance. Existing native
confinement scenarios skipped by the ordinary owner suite remain skipped; this
characterization does not turn those into passes. Hosted CI, live qualification,
independent assembled verification and delivery remain with their normal owners.

## Implementation observation for run 138

Implementation consumes the completed Testing correction and its retained red;
it does not reproduce red against the repaired candidate. The only production
change is [LocalMcp.listTools](../src/mcp.ts): its existing SDK listing handler
now emits the exact response through the existing observer before returning it.
[Activation's localTools](../src/activation.ts) already registers that response
as an immutable artifact and journals component, activity and call identity.
Discovery invokes no project handler and emits nothing when no listing is
requested. No request builder, provider policy or guidance-discovery path changed.

The engineering base and active authority remain
`8b369c4fe0ba7bba585fc2530f2e085899edd5c2`. Testing's last documented
checkpoint is `12b59af7bc293c171f8421e99469697b10b89ae7`.
The repaired code is checkpoint
`f3f7dd26a689292e2b042a1fa94be198fe4870c8`, recorded by run timeline sequence
116877. Its `src/mcp.ts` SHA-256 is
`0374073cec864afc11d9382bf431fff8a80f59395efce24ac9bf124c1fafc3f5`.
These are candidate and authority identities with different meanings.

The current complete owner observation is `138-859-owner-tests.log`,
SHA-256 `d4bd9850574a4c4a7e31b3b2fd2c37a61b46bdef97c2a2087da89537130a9214`.
The host records exit zero at timeline sequence 116886, check-input identity
`83e43843e0e218d6e8da35ce6861d72c2f99188cd246436ca55e2534dcff3109`.
Its summary at lines 2261–2266 reports 268 tests, 252 passes, zero failures and
16 skips. Bulk evidence remains in the registered run-138 directory indexed by
`138-803-retained-evidence-8da1556eda114ca1c758b9b8204d2a61049bc42a56b0c28683f95b7cffae7062.json`;
subsequent artifacts are registered in `138-1-run-timeline.jsonl`.

| Criterion | Current tracked assertion and retained excerpt |
| --- | --- |
| `parity-exact-native-request` | [inspection-activation.test.ts](../tests/integration/inspection-activation.test.ts), `assertSelected`, `context` and native parity cases compare complete subprocess input and options for all three actors. Log lines 1041–1132 record CLI and native comparisons for Director, two disjoint steward activities, two empty activities and Reviewer. Diagnostics retain actual input, argv, cwd, executable and Node v22.23.5. This is a controlled executable receipt. |
| `parity-captured-activity-tools` | The same suite's `assertTools` compares exact names, descriptions and schemas and checks refusal and unchanged foreign bytes. [inspection-listing.test.ts](../tests/integration/inspection-listing.test.ts), `assertRetained`, reads the actual registered response and verifies call identity, selected attribution and journal ordering. Log lines 1166–1190 pass populated, disjoint, empty and no-request scenarios, with throwing dispatch sentinels. |
| `parity-provider-policy-guidance` | `assertInvocation` and the activity matrix compare independent cached, disabled and live provider web options with populated and empty tools. Log lines 1051–1132 cover these configurations; lines 1151–1155 record changed-guidance refusal. Exact approved file visibility and absence of discovery-disabling flags pass; authoritative real harness discovery remains unavailable as described below. |
| `parity-current-inspection-evidence` | Complete CLI rendered/structured cases pass at lines 1041–1132, no-effects/repeatability at 1145, and assembled CLI scenarios at 1157–1162. Nested CLI output reports seven passes, no failures or skips. Applicable quality observations below assess the repaired code. |

Current quality logs are `138-870-owner-format.log`,
`138-873-owner-lint.log`, `138-876-repository-types.log` and
`138-879-repository-build.log`. All returned actual exit zero; timeline sequences
116917, 116925, 116933 and 116941 retain their commands, selection and check-input
identities. The logs identify owner-scoped TypeScript formatting/lint, strict
repository types and repository build respectively. These are fresh observations
after the product change, rather than reuse of the pre-repair green
characterization. A later evidence-only documentation edit does not alter the
tested TypeScript or fixture bytes; the host determines check reuse and final
assembled verification.

### Configured-provider provenance and limits

The retained [research report](../../../.arc/research/execution/00ffe9d0f3fd962bb54eb21db01bbae6521269e7c2b4e4c1fb1953bcb86fd761.md)
maps real Director, Documentation, Testing and Implementation activations to
`138-3`, `138-118`, `138-195` and `138-357-codex.jsonl`, with their matching
native-request, native-invocation and stderr artifacts. These identify
`/usr/local/bin/codex`, gpt-6.1-sol, medium reasoning, live provider web policy
and host Node v22.23.5. Host clarification `138-567-clarification.json` supplies
the operator-observed installed version `codex-cli 0.172.0` for that same running
container, image
`sha256:2b76a765d3e67a0189dac0125b3c81c2bd4260bf9b666531db29599bc734ebd6`.
That operator observation is distinct from a provider receipt.

The Host confirms that those streams expose no complete model-received context
receipt or authoritative normal AGENTS/skill discovery tied to approved bytes.
No earlier real Reviewer or empty-operation receipt was located. The new
retention path makes an actual requested live listing retainable by subsequent
normal activations; this controlled passing suite does not establish that such
a configured-provider listing has already occurred. No empty listing is inferred
from an empty binding without a request. Controlled file visibility is not
reported as real harness discovery, and prepared input is not reported as an
independent real-provider received-context comparison.

The same clarification preserves the separate evidence-read limitation:
`128-2-refinement-round-1.md` remains intact at its registered path (42097089
bytes), but its complete mapped read failed with
“code-mode tool result of 88344772 encoded bytes exceeds the gRPC message limit
of 67108864 bytes”. The current mapping cannot select an ending offset.
No report contents or acceptance evidence are inferred from its index.
A new read-range contract concerns Execution and Architecture and is outside this
listing correction; no cap, truncation or new operation authority was introduced.
The original report and transport failure remain retained.

These observations prepare the owned contribution for host assessment. They do
not claim independent acceptance, hosted CI, staging delivery or a clean live
qualification round. The execution-path change requires renewed qualification
under the existing qualification policy.
