# Review the complete component instruction rewrite

This is the complete authoring proposal for checklist D, in
[draft PR #673](https://github.com/fractalsynapse/arcnexus/pull/673), tracked by
[issue #672](https://github.com/fractalsynapse/arcnexus/issues/672).
Rewritten text is in the actual component YAML files. This guide is not another
set of component definitions. The proposal is unmerged and unadopted. Stop for
human feedback before activation or another live test.

## Actual specifications

Each file starts with its complete `purpose`. Its `activities` map contains
individual instructions, role, profile, operations, standards and verification.
All components have separately rewritten research, documentation, testing,
implementation and review procedures. Additional activities are identified below.

| Component                                                                       | Particular decisions to review                                                                                                |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [Agent](../../../../../.arc/architecture/components/agent.yaml)                 | Selected request, inbox continuation, complete answers and acknowledged effects.                                              |
| [Team](../../../../../.arc/architecture/components/team.yaml)                   | Canonical discovery, ownership collisions and unmanaged resources.                                                            |
| [Architecture](../../../../../.arc/architecture/components/architecture.yaml)   | Additional updating activity; integrated capture, exact proposals, protected bytes, installed handlers and approved adoption. |
| [Workflow](../../../../../.arc/architecture/components/workflow.yaml)           | Local repair, causal rewinds, genuine escalation and complete retained child history.                                         |
| [Direction](../../../../../.arc/architecture/components/direction.yaml)         | Additional planning activity; initial/revision schemas, canonical acceptance and real supplier dependencies.                  |
| [Planner](../../../../../.arc/architecture/components/planner.yaml)             | Additional planning activity; exploration versus human objective, real service tests and owner-free aspirations.              |
| [Reviewer](../../../../../.arc/architecture/components/reviewer.yaml)           | Additional assessment activity; exact citations, response repair, final rejection and learning.                               |
| [Execution](../../../../../.arc/architecture/components/execution.yaml)         | Provider wiring, scoped MCP, native fixtures, checkpoints and crash recovery.                                                 |
| [Coordination](../../../../../.arc/architecture/components/coordination.yaml)   | Existing writer/store, reopen proof and distinct findings/answers across attempts.                                            |
| [Verification](../../../../../.arc/architecture/components/verification.yaml)   | Applicability, typed selectors, assembled checks and evidence reuse.                                                          |
| [Commands](../../../../../.arc/architecture/components/commands.yaml)           | Transport-neutral SDK, complete forwarding and one delegated lifecycle.                                                       |
| [CLI app](../../../../../.arc/architecture/components/cli-app.yaml)             | Inspect parity, JSONL, pre-admission refusals and subprocess/signal evidence.                                                 |
| [Collaboration](../../../../../.arc/architecture/components/collaboration.yaml) | Host-controlled effects, unavailable versus absent and moved-head refusal.                                                    |
| [Delivery](../../../../../.arc/architecture/components/delivery.yaml)           | Additional host-only release procedure; production assembled record, engineering base, one PR and uncertain effects.          |
| [Foundation](../../../../../.arc/architecture/components/foundation.yaml)       | Broad reusable strategy, literal test metadata and scoped checks without dependency ceremony.                                 |
| [Manager](../../../../../.arc/architecture/components/manager.yaml)             | Source/scope guidance, resource references and ordinary harness discovery.                                                    |
| [Release](../../../../../.arc/architecture/components/release.yaml)             | Canonical CI tooling, truthful evidence and separate production authority.                                                    |
| [Project](../../../../../.arc/architecture/components/project.yaml)             | Durable direction, honest checklists and meaningful document-only validation.                                                 |

## One authored source for common method

The existing single-string builder combines the selected component activity,
its [role](../../../../../.arc/architecture/roles/) and explicitly selected
standards. Common procedure is authored once in
[the Agent operating protocol](../../../../../.arc/architecture/standards/agent-operating-protocol.md).
Component-specific paragraphs cover its actual boundary, fixtures, decisions,
operations and repair. Inspect labels each source separately.

All ten roles have rewritten instructions, including distinct Director, Planner,
Architect and independent Reviewer decisions. The host-only
[release-engineer procedure](../../../../../.arc/architecture/roles/release-engineer.yaml)
has no model profile. Delivery's host activity does not select the Agent protocol.
No provider channel, loader, schema or runtime implementation was added. Codex
continues to discover AGENTS.md and skills normally.

[Prompt practices](../../prompt-practices.md) describes the writing method without
copying a template into every activity.

## Observed authoring measurements

At catalog commit `b4308901`, the existing Architecture service assembled all
**94 model activities** without a model call or task admission. All **18 purposes**
and the remaining **one host procedure** are rewritten.

Using **tiktoken 0.14.0 / o200k_base**:

- Purpose: **4,004–4,150 tokens**.
- Resolved activity procedure excluding purpose: **6,115–12,907 tokens**.
- Component-specific activity portion alone: **163–6,282 tokens**.
- Complete request including purpose and other context: **11,734–20,563 tokens**.

The resolved procedure includes activity-specific text, selected role instructions
and selected standard documents. Shared method is authored once; the measurement
does not imply each individual YAML field contains 6K tokens. These are authoring
observations, not provider billing or runtime size gates. Nothing is truncated.
Per-activity counts and complete rendered requests remain in application storage
under `672-inspections`, alongside `672-mapping-audit.json`.

Static validity and length do not establish improved agent judgment. That requires
later authorized live evaluation after human review.

## Preserved boundaries and remaining gaps

Structural comparison preserves ownership, profiles, activity roles, operations,
verification and all other component fields except purpose, instructions and
selection of the shared protocol. Locked contracts and registry are unchanged.

Planner planning lacks `request-research`, and Planner has no declared
`.arc/research/planner` ownership root. Its instructions acknowledge the gap
rather than promising an unavailable path. A mapping correction can follow this
review. Native/provider operation completion remains an open checklist item;
prose is not its implementation.

The retained refine implementation attempt ended held before staging. Its branch,
checkpoint and failed evidence remain retained. Qualification is **0/3**. The new
procedures address observed failures: demanding finished Implementation during
Testing, testing only a fake Planner method, losing distinct retained history,
and requesting an unavailable self-rewind instead of fixing owned tests in place.

Review the component-specific text with its role and shared protocol for decision
quality, unnecessary repetition and agreement with actual operations. Feedback
precedes adoption and further live testing.
