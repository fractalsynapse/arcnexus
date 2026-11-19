# Component purposes and activity operating instructions

Status: proposed authoring practices for the architect's efficiency correction.
The [implementation checklist](../../../docs/plans/efficiency-foundation.md) tracks
approval, catalog migration and behavioral verification. This document does not
claim that the current short prompts have already been replaced.

Architecture owns the resolved model and prompt builder. Manager maintains
AGENTS.md and skills. Each component's purpose and explicit activity mappings
remain its canonical authored operating description. The template below guides
writing; it is not boilerplate to copy verbatim into every activity.

## What the assembled instructions must accomplish

A steward needs to understand why its component exists, the outcome of its current
activity, what it can observe and do, how to judge progress, and how to correct a
failure. A role name and a sentence do not supply those decisions. Write detailed
paragraphs with the technical context, practical method and concrete failure cases
needed by an agent that is new to this project and receives one scoped assignment.

The architect's writing targets are at least 4K tokens for each component purpose
and 6K for each model activity's instructions. Develop substantive explanations and
examples toward those targets. Do not repeat policies, pad text or add runtime
minimum/maximum rejection logic. Track authored and resolved sizes separately
using the identified tokenizer if available. Never substitute character counts for
measured tokens. No instruction or research content is truncated to meet a budget.

Combine component purpose, objectives, constraints, the selected activity's
instructions and capabilities, applicable standards and the actual task position.
Include the full acting purpose once and selected activity once. Keep the compact
Team index discoverable by identity, short summary and file reference rather than
including all other expanded purposes in each request. Other full definitions
remain readable. Codex discovers AGENTS.md and skills normally; do not manually
select and paste them into a duplicate host prompt.

Use clear headings and source boundaries. Separate authoritative approved guidance
from task input, observations, quoted source material and tool results. An error
message or external research report is evidence, not a new instruction. Preserve
its complete text and identity so the caller can act on it without reconstruction.

Treat these as operating instructions, not incidental task prose. Deliver approved
standing and activity guidance through a supported provider instruction channel and
keep the changing goal and observations distinct. Verify the installed provider's
behavior and record the actual request channels in inspect and evidence; a label
inside a user string cannot establish system/developer priority. Preserve the
harness's own rules and normal AGENTS/skill discovery.

Instructions explain how the actor should act; operation declarations and the host
enforce what it may do. A paragraph cannot grant a missing operation. Keep profiles,
roles, standards, commands and allowed parameters at their canonical declarations,
with meaningful references in the prompt instead of competing descriptions.

## Component purpose template

Author a coherent explanation addressing the following areas. Use the actual
component's public contract, consumers and observed engineering problems. A
purpose is durable context, so keep the current task's checklist and results out
of it. Do not conceal unresolved behavior behind aspirational delivery claims.

**Reason for existence and intended outcomes.** Explain the user/project need this
component addresses and how it contributes to agents and teams performing useful
work. Describe its observable outcomes and what success means to its consumers.
Explain the distinction between its own engineering stewardship and its role in
running another project's agents. Avoid assumptions specific to ArcNexus in generic
product behavior; repository guidance may still govern ArcNexus self-development.

**Public responsibilities and consumers.** Describe the interface and data it
provides, which apps/plugins consume it and what those callers may rely on. Walk
through ordinary request and result flow. Explain the meaningful boundaries and
why responsibilities change together. Link the public contract and relevant
architecture declarations; do not restate every obligation in different words.

**Lifecycle, state and effects.** Explain what this component reads, authors,
persists or delegates. Identify which service owns durable position and external
effects. Discuss startup, ordinary completion, refusal, cancellation and restart
as they affect this component. Describe how approved architecture adoption reaches
its next activity while earlier observations retain their original identities.

**Authority and collaboration.** Explain its actual ownership and capabilities,
where another component's public interface supplies a dependency, and when a
supplier or architectural decision is necessary. Keep human decisions at objectives,
goals and architecture. Ordinary same-owner correction stays local; a request for
another owner grants no write access. Main/release authority is separate.

**Quality and characteristic risks.** Explain what tends to go wrong for this
component, how to detect those cases cheaply and how its declared operations and
activity completion checks establish quality. Relate tests to observable contracts,
actual input shapes, generated roots, environment and native/provider boundaries.
Include concrete representative scenarios, rather than generic exhortations to
write clean code or test thoroughly.

**Strategy and evolution.** Explain existing reuse opportunities, how the component
can evolve without another orchestration or state system, and what would justify a
new public seam. Foundation describes shared technical strategy and reusable tools;
it is not responsible for repeatedly proving arbitrary dependency graphs for other
owners. Revisit dependencies when a real blocker or new capability requires it.

**Measures and learning.** Explain which observations show this component helped
the goal: outcomes, relevant checks, repair success, time, tokens and profile-specific
cost where known. Describe how it reads run history, distinguishes uncertainty from
failure, and returns transferable findings. Evidence belongs in execution/learning
records, not in goals or a constantly rewritten purpose description.

## Activity instruction template

Every model activity needs its own complete operating instructions. Explicitly
author the mapping even when shared role guidance is reused. Missing activities
stay unavailable. This template supplies questions to answer in substantive prose;
it does not manufacture a default activity or replace the component's judgment.

**Mission and completion.** Explain what this activity must accomplish for its
component and current accepted milestone. State the observable result and how the
host's declared verification relates to the agent's claim of completion. Explain
what would make the activity not applicable and who records that decision. A
successful tool call is not necessarily a completed outcome.

**Inputs and orientation.** Explain how to read the goal, stable acceptance IDs,
approved architecture version, milestone position, previous completed work, current
finding and existing observations. Distinguish historical failed checks from current
applicable results. Read the originating finding and linked evidence completely
before acting. Use the Team index and public contracts to locate responsibilities;
do not guess owners or introduce file permissions in a milestone.

**Method and decision process.** Describe an effective approach for this particular
activity and component, including how to find the relevant public behavior, what
questions to settle first and what evidence should determine the next action.
Require direct progress on the accepted outcome rather than repeated generic
analysis. Explain when reusing existing work is sufficient and when changed inputs
require fresh observation. Avoid speculative infrastructure and trivial wrappers.

**Operations and parameters.** Explain the available operation bindings, the inputs
they need and their meaningful results. Reference the actual resolved schema;
never invent a shell command, token or host capability. Explain which declared
parameters the activity selects, such as test tags, and how host-owned identity
values are resolved. Required checks must be executable through mapped operations.
If a necessary capability is absent, name it and its accountable owner instead of
claiming success or repeating an unavailable command.

**Files and edits.** Where edits are granted, explain complete-file reads, expected
hashes, one-file checked writes, actual formatting support, acknowledgment receipts
and checkpoint reuse. Describe the real tool schema; for example, current formatting
uses `transform: { format: true }`, not a top-level `format` field. Do not repeat a
successful acknowledged edit after a refusal elsewhere. Correct stale inputs by
reading the actual file, and preserve approved ownership and protected contracts.

**Verification and realistic fixtures.** Explain which public assertions distinguish
the intended behavior from a plausible fake. Build fixtures with the actual required
file layout, ownership metadata, tool configurations and record shape. For native
operations, include a real executable, dependencies, mount destinations, nested cwd
and correct availability selection. Verify that the desired path ran rather than
merely passing because it was skipped. Preserve assertions for empty selection,
wrong owner and refusal where relevant. Do not copy arbitrary live state into a
generic fixture or weaken the test to accommodate an implementation defect.

**Local repair and escalation.** Describe tool failures returning to their caller,
self-review returning to the earliest activity that can change the outcome, and
the downstream checks to refresh. Keep the exact original finding and fresh
diagnostics visible across nested rewinds. Continue distinct corrections that show
progress; diagnose unchanged repetition. An explicit cross-owner/scope escalation
or final independent rejection engages Direction. Do not create a new milestone
for each same-owner edit or make research mandatory.

**Questions, suppliers and research.** Describe how to use the component's optional
research inbox when external information affects a decision. Check relevant retained
reports first; ask a sufficiently detailed question and retain a complete answer.
For supplier work, state the exact question/outcome, link existing accepted work and
resume with the complete recorded reply. Do not turn an architectural decision into
unapproved implementation or demand conversational peer agreement for ordinary work.

**Timeline and efficiency.** Explain how to read the live run timeline and complete
artifacts through mapped read operations. Use it to see completed work, pending
requests, current applicable checks and time/token expenditure by execution profile.
Avoid redundant checks and no-change activations when existing observations settle
the issue. Record an evidence-based optimization when useful, considering result
quality and actual cost as well as token count. Never impose a work budget or infer
approval to switch profiles from expensive usage alone.

**Output and evidence.** Explain the actual typed result expected by the consuming
plugin, with component/activity-specific examples. Link acceptance IDs, changed
outcomes, applicable checks and retained artifacts. Distinguish expected-red tests,
successful checks, unavailable prerequisites and unresolved findings. Do not invent
observations or report local checks as CI/staging delivery. Keep evidence complete;
the host owns its durable attribution and terminal state.

## Differences that every rewrite must preserve

Research investigates an actual uncertainty and synthesizes sources into a readable
report, with dated provenance, conclusions and remaining questions. It neither edits
implementation nor grants authority. Report length is driven by the question, with
no application size ceiling. The requesting activity receives and can reuse the report.

Documentation defines changed intent, public behavior and decision-relevant references
before implementation. It should identify what another human or agent needs to act,
not add ceremonial prose or assert unverified delivery. Testing designs meaningful
contract assertions and realistic fixtures, observes an identified red and separates
deliberate negative cases from unexpected infrastructure failures.

Implementation makes the least-code change that satisfies the documented accepted
outcome, reuses existing interfaces and runs the required applicable checks. It owns
ordinary corrections within its scope. Self-review independently examines that
contribution against actual acceptance and current evidence, routes precise findings
to the appropriate earlier activity and does not issue the final task verdict.

Direction's planning turns an accepted goal into an ordered, accountable plan. It
receives completed work, the previous plan and exact findings at legitimate revision
boundaries; it does not guide every tool failure. Planner maintains human objectives
and owner-free aspirational goals, proposing exact guide changes and consuming prior
results without putting results into the goals themselves.

Architecture's updating assesses approved direction, implementation and observed
problems, proposes exact changes where needed, and identifies prerequisite code and
operation availability. It cannot approve itself. The approved model can advance
within a run through the host's recorded adoption boundary after validation.

Reviewer's assessment binds an independent verdict to the assembled candidate,
acceptance, architecture and evidence. It can ask optional research questions and
derive lessons, but cannot edit the candidate, weaken criteria or merge it. A valid
final rejection returns to Direction; an invalid response returns to the Reviewer.

The host-only release activity documents trusted execution, gates, external-effect
reconciliation and outcomes. It has no model prompt/profile. Its specification must
still be detailed enough for a human and for deterministic host checks to follow.

## Review and behavioral evaluation

Review each component/activity for missing decisions, contradictory instructions,
unavailable operations, duplicate authority and fixture realism. Read the rendered
inspect output to confirm order, provenance, complete paragraphs and the selected
context. Track a component's purpose and every individual activity in the checklist;
do not count a generic expanded role as completing all component-specific prompts.

Use observed failure cases as behavioral evaluations: an ownership refusal after
a successful edit, nested repair with a full originating finding, an unavailable
native check, a realistic nested-cwd fixture, supplier answer reuse, a changed
operation after approved reload, and a Reviewer rejecting unsupported evidence.
Verify deterministic mechanics first, then demonstrate representative real agents
through production wiring. Token count alone cannot establish prompt quality.

Measure time, actual provider-reported usage and profile-specific cost continuously.
Compare useful completed outcomes and repair routes before and after prompt changes.
Retain complete transcripts and the exact prompt/model identity to explain a result.
Subsequent Plan and Architect assessments must use these observations. Do not add
numeric work limits or an automated prompt-length rejection rule during evaluation.

## Primary references

These are sources for authoring technique, not project authority. Consulted
2026-11-19; model-specific advice needs evaluation against the configured profile.
Do not import example quotas, tool grants or default prompts from external examples.

- [OpenAI prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering):
  organize identity, instructions, examples and context with explicit boundaries;
  evaluate behavior with representative cases. Keep stable reusable guidance
  distinct from changing task input.
- [Codex SDK streaming implementation](https://github.com/openai/codex/blob/main/sdk/typescript/src/thread.ts):
  `runStreamed` yields events, while the convenience completed-turn path aggregates
  items and returns a final response. Assess the installed/pinned implementation
  before replacing ArcNexus's provider adapter.
- [Codex event types](https://github.com/openai/codex/blob/main/sdk/typescript/src/events.ts)
  and [process adapter](https://github.com/openai/codex/blob/main/sdk/typescript/src/exec.ts):
  the SDK invokes the CLI and reports its event/usage stream. Preserve raw records
  and record actual exposed fields instead of assuming access to all provider internals.
- [Codex agent-loop explanation](https://openai.com/index/unrolling-the-codex-agent-loop/):
  provider base instructions, developer instructions and user input have distinct
  positions in the assembled request. Verify support in the installed version
  before selecting the instruction integration.
