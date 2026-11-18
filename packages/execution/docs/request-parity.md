# Inspection and activation request parity

This records intended behavior for `activation-request-parity` before behavior
changes. It implements [Execution EX-6](../contract.md#acceptance-scenarios)
and the locked [Architecture obligations and ARC-9/ARC-13](../../architecture/contract.md).
The [Agent proposal's AGT-2](../../agent/contract.md) describes the shared consumer
view. These references retain their existing status; this intent changes no lock,
registry, captured authority, operation definition or acceptance criterion.

## One request and three actor cases

Inspection and live activation consume the same Architecture-owned request builder
through the public Agent boundary. Do not add an Execution-specific prompt builder.
Rendered and structured inspection must describe the exact request and invocation
options that activation would use for identical inputs.

Acceptance `adapter-request-parity` requires these production activation cases:

| Actor | Selection | Required supplied task context |
| --- | --- | --- |
| Director | Captured director component and planning activity | Goal and complete planning assignment, milestone, acceptance and evidence inputs |
| Steward | One captured owner and explicitly selected steward activity | Goal, full assignment, current milestone and Step, acceptance and evidence inputs |
| Reviewer | Captured verifier component and assessment activity | Goal, full assessment assignment, milestone, captured acceptance and complete authorized candidate/evidence references |

For each case, compare the inspected shared Agent request with the prompt actually
received at the Codex subprocess boundary through production activation wiring.
Comparing two builder calls or only a prepared request does not establish this
observation. Keep the capture (including revision and approved guidance),
actor/component/activity selection and complete task inputs identical. Supply the
same worktree path as the working directory. The task inputs include `assignment`,
`goal`, `milestone`, `acceptance`, `evidence` and `worktree`; retain supplied
nested data rather than substituting summaries.

Assert prompt equality byte for byte, without trimming, whitespace rewriting,
section removal or broad normalization. Separately compare effective model,
reasoning effort, built-in web policy, working directory and mapped tool bindings,
including descriptions and argument schemas, at the process boundary. Model
settings remain invocation options. Harness transport may encode these settings,
but must preserve their effective values and captured authority.

Assertions must establish that the request carries the selected activity's
instructions, role, standards, observations and capabilities, captured operations,
source labels and supplied task data. Source labels identify the project capture,
task input origin, selected component/activity, role, operation definitions,
standards, contract references and compact component index where applicable.
Other activities' definitions must not leak into the selected request. Director
and Reviewer remain read-only; a steward receives only its current activity's
captured operations.

When task inputs are unavailable to inspection, expose named placeholders for
`<assignment>`, `<goal>`, `<milestone>`, `<acceptance>`, `<evidence>` and
`<worktree>` as applicable in the structured result and corresponding rendered
request or invocation options. These are EX-6's declared differences for live-only
data, not permission to ignore differences when complete identical inputs are
supplied. Supplied empty collections remain supplied values.

Inspection remains local and read-only: it makes no model or harness activation,
task admission, host startup, upstream call, write, state or worktree creation.
The CLI-owned inspection milestone establishes rendered/JSON equality and absence
of effects through its own public path; it consumes this activation evidence
without duplicating request construction.

## Native guidance and confinement

Acceptance `native-guidance-preserved` implements Architecture's obligation:
“The request builder leaves their discovery and selection to Codex.” Keep normal
project directive and skill discovery in the harness activation environment.
Do not embed directive or skill bodies in the model request or disable native
discovery to make prompt comparisons pass. The host must still validate approved
guidance against the captured revision before activation.

Preserve local MCP operation mediation, captured bindings, owner and current-Step
checks, stale-hash and lock refusals, and host confinement under Execution's
obligations, EX-2 through EX-5, EX-14 and EX-16. Built-in web access remains an
Execution-provider policy distinct from mapped project tools. Cancellation retains
EX-8's single terminal outcome and stops managed descendants; parity work grants
no new operation or lifecycle path.

## Evidence and limits

The retained planning transcript `8-1-codex.jsonl` supplied with this activity
identifies the evidence gap in
`apps/cli/tests/integration/request-parity.test.ts`: its prepared Director
comparison alone does not observe subprocess payloads for all three actors.
It records planned work, not passing parity or native-discovery evidence. The
earlier `run:6` referenced by that plan covers recovery criteria and repository
checks, not this goal's request-parity measures.

First characterize the existing production path with Execution-owned integration
regressions and retain the mapped owner-suite results. Keep wiring unchanged
where characterization passes. Before correcting a demonstrated behavioral
divergence, retain a failing public regression. Correct only Execution-owned
behavior; route foreign-owned defects through Direction to the accountable owner.

Deterministic executable fixtures can establish exact subprocess input, invocation
settings and the harness configuration/environment they observe. They can check
that directive and skill bodies are absent from the shared request and that
captured-guidance validation and operation confinement remain enforced in their
exercised cases. A fixture substituting for Codex cannot establish that installed
Codex actually discovers and selects that guidance.

Report an observed installed-Codex activation separately, identifying the installed
version, candidate/revision, actor/activity, approved guidance and retained
observations of directive and skill discovery. Live inference, native confinement,
hosted CI and staging integration are separate evidence categories. Any unavailable,
skipped or unobserved native or live requirement remains explicitly outstanding;
fixture passes cannot discharge it.

The operator-provided native observation in `32-3-clarification.json` is external
evidence for commit `398d3651c8680a5914745c855003bc183dcc6a46`, tree
`eb8d7da2dc7a14e270a02ce10ea743b2742f82a1` and capture
`8544905fb43f7742f672931e8e5df75e310ea75d`. It reports installed
`codex-cli 0.166.0-alpha.6` identity, production `HostTask.activate`, successful
directive and skill catalog discovery, and nonzero live inference. Its probe
assignment is separate from the exact-input parity fixture. Retain this observation
without attributing it to another candidate or capture; matching guidance hashes
alone do not establish identity. Native evidence for the accepted candidate remains
open unless a retained matching observation or explicit host identity confirmation
connects these records.

For every observed check retain candidate identity, relevant inputs/environment,
exact exit status and readable evidence outside maintained source. Preserve failed
observations alongside later results. This documentation activity claims intent
only and requests no executable check. The host owns subsequent queued checks,
assembled verification, independent assessment and delivery; completing this
document does not establish either engineering criterion as passed.
