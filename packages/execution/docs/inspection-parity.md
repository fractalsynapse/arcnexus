# Inspection and activation parity

This intent is for Execution maintainers preparing regressions and reviewers
deciding whether inspection describes the authority and request actually used by
an activation. It records the accepted boundary before behavioral changes for
`execution-inspection-activation-parity`, and updates the evidence scope for
`inspection-current-parity` and the current `inspection-current-evidence` milestone.
The governing obligations are
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

## Production path and existing comparisons

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

The existing [inspection-activation regression](../tests/integration/inspection-activation.test.ts)
adds the production subprocess comparison. Its
[committed generic fixture](../tests/fixtures/inspection.ts) uses real Architecture,
Agent, Execution admission and task preparation, with an explicitly configured
[controlled executable](../tests/fixtures/inspection-provider.ts). For Director,
steward and Reviewer, assertions compare complete received stdin with the prepared
request and check effective model, reasoning, web and working-directory options.
They also check selected purpose and activity text, source labels and the named
placeholders. Reviewer comparisons include the host-retained candidate diff.

The same executable queries production MCP `tools/list`; assertions compare exact
identities, descriptions and schemas with structured request tools and operation
identities and descriptions with the rendered Operations section. Cases include
disjoint steward activities, explicitly empty lists, and cached, disabled and live
web settings independent of the project-tool list. Foreign writes, another
activity's operation and unmapped shell calls are refused, with foreign source
unchanged. Separate cases assert repeatable inspection without model, admission,
upstream, storage or worktree effects, and refusal of changed captured guidance
before provider startup. The suite also invokes the assembled CLI request-parity
and inspection scenarios.

The [activity-tool scenarios](../tests/integration/activity-tools.test.ts) remain
complementary transport and caller-repair coverage with handwritten bindings and
a partial host fixture. They do not replace the production-captured comparisons.
A substituted Agent view, reconstructed prompt or handwritten binding alone
cannot establish assembled parity.

## Current evidence scope

This review evaluates revision `7d04db61627b4e76e0fda4ac1003ab5b26d18e8e`
under run 173's accepted `inspection-current-evidence` milestone. It records
intent before any new behavioral correction. The earlier reviews at
`83acc2f956b3595a2594c6051c3e541928427919` and
`8b369c4fe0ba7bba585fc2530f2e085899edd5c2` remain historical.
The [characterization account](inspection-characterization.md) preserves their
results, original criteria, candidate identities and provider limitations.

Source review finds the controlled native parity and requested-listing
regressions already present. `LocalMcp.listTools` emits the requested response
through the existing observer; activation retains its complete artifact with
component, activity and call identity. The run-138 listing-retention red and its
subsequent correction are historical evidence, not an outstanding defect to
recreate. Characterize current behavior with expected pass. Add red only when
a relevant new behavioral gap is demonstrated.

Comparisons must use identical effective inputs after host enrichment.
`invocationContext` adds completed-round references and registered parent/current
timelines; returning callers also receive retained and newly observed evidence.
Reviewer activation adds its candidate diff. Preserve complete answers, array
order and actual workspace in the comparison. The existing parity helper supplies
an assignment and Reviewer diff, but does not explicitly exercise completed rounds
or returning-caller enrichment. Testing must assess that coverage before deciding
whether additional assertions are necessary. Do not change production enrichment
to make an unenriched expected request agree.

## Comparisons required by the current milestone

| Criterion | Intended comparison and evidence gap |
| --- | --- |
| `inspection-request-parity` | Run the production admission/Agent/Execution subprocess scenarios for Director, steward and Reviewer. Compare complete stdin and effective invocation options against the shared prepared request using identical enriched inputs. Independently assert full selected purpose, procedure, source labels and named placeholders. Compare complete rendered CLI input/options with structured inspection. Current source coverage exists; current applicable observations and enrichment coverage must be established. |
| `inspection-activity-authority` | Compare actual MCP tools/list names, exact descriptions and schemas with inspection for populated, disjoint and explicitly empty activity bindings. Check foreign and unmapped refusals without unauthorized effects. Read complete requested response artifacts through registered evidence, checking call identity, selected activity and ordering. No request must produce no listing. Existing listing-retention assertions cover these cases; obtain or justify applicable current observations. |
| `inspection-effects-and-policy` | Establish repeatability without model calls, admission, upstream, storage or worktree effects. Compare cached, disabled and live provider web options independently of populated/empty project tools. Preserve normal guidance discovery configuration and refuse changed captured guidance before provider startup. Controlled file reads and configuration establish visibility and adapter policy; authoritative real harness discovery remains a separate unavailable observation unless actually exposed. |
| `inspection-evidence-accuracy` | Map each measure to tracked assertion anchors, actual status/log and relevant source, authority, candidate and environment identities. Include applicable owner format, lint, types, build and tests. Separate controlled subprocess receipts, configured-provider records, live inference, native confinement, CI and independent acceptance. Do not promote source coverage, skipped cases or unrelated review criteria into proof. |

Run 158's completed-round report cites run 147's passing repository checks at the
evaluated revision, tree `faddf36c0ba3e3ba4dac1f108577b97c50585085` and PR 721.
Its independent criteria concern recovery and publication. The accepted run-173
plan therefore requires criterion-linked parity characterization rather than
treating that summary as parity acceptance. Reuse remains possible when the host
establishes matching relevant inputs, resolved parameters, authority and environment.

## Provider observations and remaining limitations

The controlled executable receives actual stdin, argv and MCP messages and reads
approved guidance bytes. It establishes transport, file visibility and absence
of discovery-disabling configuration, not real Codex interpretation or selection.
The retained [research report](../../../.arc/research/execution/00ffe9d0f3fd962bb54eb21db01bbae6521269e7c2b4e4c1fb1953bcb86fd761.md)
and run-138 clarification distinguish prepared host requests from an independent
complete model-received context receipt. The latter and authoritative automatic
AGENTS/skill discovery tied to approved bytes were unavailable in those streams.
The later host clarification supplies operator-observed Codex version and image
identity; preserve that provenance instead of calling it a provider receipt.

Inspect available current configured-provider request, invocation, listing and
event artifacts through the existing journal. Compare identical effective inputs
where supported and record precisely what each artifact establishes. A prepared
tool array is not a requested tools/list response. An empty binding is not proof
that a real provider requested an empty listing. A model statement or explicit
read of guidance is not authoritative automatic discovery. Unexposed provider
internals remain unknown; do not manufacture receipts, paste guidance into the
request, alter grants or replace the shared request builder.

Keep engineering base, approved architecture source, prepared candidate worktree
and verification checkout distinct. A documentation checkpoint secures these
intent records; it is not behavioral acceptance. Bulk logs and transcripts remain
outside source. This activity records no new software or configured-provider pass.
Testing and Implementation establish applicable observations, and the host alone
performs assembled verification and delivery through
[Workflow](../../workflow/contract.md) and [Delivery](../../delivery/contract.md).
