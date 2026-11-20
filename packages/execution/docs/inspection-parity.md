# Inspection and activation parity

This intent is for Execution maintainers preparing regressions and reviewers
deciding whether inspection describes the authority and request actually used by
an activation. It records the accepted boundary before behavioral changes for
`execution-inspection-activation-parity`. The governing obligations are
[Execution EX-6, EX-16 and EX-24](../contract.md#acceptance-scenarios),
[Architecture ARC-9, ARC-13, ARC-18 and ARC-24](../../architecture/contract.md#acceptance-scenarios)
and the [Agent interface](../../agent/contract.md#public-interface).
This note changes no contract or captured authority.

## Accepted behavior

Director, steward and Reviewer use production Architecture and Agent to prepare
one complete request string. For identical captured revision, actor, component,
activity and supplied task inputs, inspection and activation must agree on the
entire input and resolved invocation options. Preserve full acting purpose and
selected activity instructions, source labels, contract references and applicable
standards. Inspect names unavailable inputs as `<assignment>`, `<goal>`,
`<milestone>`, `<acceptance>`, `<evidence>` and `<worktree>`; the worktree is
an invocation option rather than prompt text. With complete activation inputs,
no placeholders remain. Comparisons supply the same enriched assignment, goal,
evidence and workspace to both paths rather than comparing different task data.

Rendered inspection contains the same input as structured inspection's
`request.input`, and its invocation header represents `request.options`.
Repeated inspection is stable. Inspection performs no model call, upstream
effect, task admission or worktree creation.

The selected activity's captured operation IDs and exact tool descriptions must
agree across the rendered Operations section, structured request tools and
activation's MCP `tools/list`. Compare the resolved schemas and parameters too.
Disjoint activity bindings stay distinct. An explicitly empty operations list
advertises no project tools; it cannot inherit another activity's tools.
Foreign and unmapped calls are refused before handler effects. Inspection is an
audit view, never an additional grant.

Built-in web access is independently controlled by the execution provider.
Exercise provider settings with both populated and empty project-tool lists;
neither inspecting nor exposing project tools changes that setting. Approved
AGENTS files and skills remain available through normal harness discovery.
Do not paste another selected copy into the request or relax captured-guidance
validation to make a fixture pass.

## Production path and uncovered comparisons

[Agent.prepareRequest and activate](../../agent/src/index.ts) delegate to
[Architecture's request builder](../../architecture/src/request.ts).
The builder resolves activity operations once, uses their descriptions in the
request and tools, and keeps model, reasoning, web policy and cwd in options.
[Actor activation](../src/activation.ts) supplies current task context, validates
guidance and passes the prepared tool list to LocalMcp.
[NativeObservation](../src/native-observation.ts) retains the prepared request
and invocation evidence; the [native adapter](../src/codex.ts) sends the input on
subprocess stdin and translates options to argv/configuration.
[Guidance validation](../src/host-config.ts) checks native discovery files against
the capture and refuses target Codex configuration outside the trusted binding.

Existing [CLI request-parity coverage](../../../apps/cli/tests/integration/request-parity.test.ts)
compares rendered and JSON inspection with production Agent preparation, checks
placeholder substitution and observes unchanged Git status, worktrees and plan
storage. The [inspection scenarios](../../../apps/cli/tests/integration/inspect.test.ts)
cover selected activity content, source references, repeatability, required
component/activity positions and special actors. These remain the assembled CLI
regression entry points.

Those comparisons do not observe bytes received by a native subprocess for every
actor. The [activity-tool scenarios](../tests/integration/activity-tools.test.ts)
exercise real MCP transport and refusals with handwritten bindings and a partial
host fixture; they do not compare production-captured inspection with activation.
A substituted Agent view, reconstructed prompt or handwritten binding cannot
establish the missing assembled parity.

## Evidence required for completion

| Criterion | Distinguishing observation |
| --- | --- |
| `parity-exact-native-request` | Realistic committed generic capture, production Architecture and Agent, and actual native subprocess receipt for Director, steward and Reviewer. Compare complete stdin bytes and effective options, selected context, source labels and named withheld inputs. |
| `parity-captured-activity-tools` | Production activation's MCP tools/list matches inspection identities and exact descriptions for the same activity, including disjoint and empty lists. Attempt foreign and unmapped calls and observe no handler effects. |
| `parity-provider-policy-guidance` | Native argv/configuration records independent web settings with populated and empty tool lists. Preserve approved guidance discovery and refusal of mismatched captured guidance. |
| `parity-current-inspection-evidence` | Current rendered/JSON parity, repeatability and absence of inspection effects, plus applicable Execution quality and assembled CLI observations tied to candidate identities. |

A controlled executable receiving actual stdin, argv and MCP messages establishes
a deterministic subprocess/transport boundary. It does not establish live model
behavior or real harness guidance discovery. Native/provider evidence names the
actual executable and version, runtime, captured authority, source/candidate,
options, status and complete logs. Live inference, host confinement, CI and
independent assembled verification remain separate evidence categories. Missing
executables, skipped cases and unavailable prerequisites remain explicit gaps.

Keep engineering base, approved architecture source, prepared candidate worktree
and verification checkout distinct in fixtures and reports. Record each observed
status and retained artifact against the candidate it assessed; a later edit does
not turn an old observation into current evidence. Bulk transcripts remain in
external task storage through the existing journal, not source.

At this documentation step, the source review is anchored to captured authority
revision `83acc2f956b3595a2594c6051c3e541928427919`. The references above identify
existing coverage and the comparisons still required; no fresh behavioral,
native, quality, CI or assembled pass is claimed. Testing and Implementation
must establish the criterion-linked observations before the host's assembled
verification. Recovery and final publication continue through
[Workflow](../../workflow/contract.md) and [Delivery](../../delivery/contract.md).
