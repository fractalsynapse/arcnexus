# Inspection parity characterization

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
