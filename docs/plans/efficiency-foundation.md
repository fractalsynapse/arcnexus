# Efficiency foundation for continuous refinement

Status: implementation checklist requested by the architect on 2026-11-19.
The architect approved exact amendment `cb6a431032a9` and delegated application and
implementation. Its contract and registry bytes have been applied and verified
against the manifest. This document records
engineering work, not a hand-authored Director plan or delivered capability.

Continue the [self-development qualification](self-development-mvp.md). The end
condition remains three consecutive successful live Plan → Architect → Run rounds
with useful approved refinement and staging delivery. Main and releases remain
separate. This checklist supersedes continuing the retained delivery against its
known missing capabilities; retain its checkpoints and failed observations.

## Observed problem and desired behavior

The retained quality-check prerequisite has not reached staging. Its latest
attempts, parent 95 and child 96, are inactive and ended at a named architecture
hold. The old activity map does not grant the checks needed to finish the new
check implementation. Repeating that invocation without changing this boundary
cannot resolve the hold. Existing local regressions and green bootstrap CI are
useful evidence, but are not qualification rounds.

The catalog at `2522d2ec46a6759e007b8be389829143be0fafcf` contains 18 components,
94 model activities and one host activity. Component purposes range from 46 to 91
characters. Activity instructions are generally a sentence, with a few additional
sentences for special actors. The request builder includes the complete purpose of
every other component in its index. Expanding purposes without correcting that
index would repeat every long purpose in every activation.

Codex output is retained, but execution currently accumulates process output and
decodes the final answer after completion. The foreground CLI forwards coarse
progress. It does not expose a complete structured live timeline. Research
reports and exact tool diagnostics must remain complete; reducing their content
is not the efficiency correction.

The corrected lifecycle loads one resolved architecture at admission and after
each accepted architecture update. Agents receive detailed, component-specific
operating instructions, the operations that can accomplish their work, and access
to the run's observations. Completion checks provide immediate feedback. A live
timeline makes cost, delays, handoffs, repairs and progress inspectable throughout
the run. Optimize successful outcomes and reliability using measured time, tokens
and profile-specific cost, without introducing quantitative budgets or caps.

## A. Establish the authority transition and simplify the retained work

Execution order: settle A, expose the existing event stream and measurements from
E/F before another long live attempt, implement B/C through that observable path,
complete D and the remaining E/F requirements, then perform G. These are coherent
contributions to the existing lifecycle, not separate orchestration subsystems.
Do not continue a live run with a known invalid fixture, missing required operation,
unresolved authority transition or a result that its current evidence cannot support.

- [x] Read current contracts, catalog, production request builder, process adapter
  and CLI output path; enumerate every component and activity.
- [x] Confirm that the retained parent and child are inactive; do not launch an
  unchanged attempt while the known operation-authority hold remains.
- [x] Preserve the final retained branch/checkpoint identities and complete failed
  evidence. Compare outstanding work with this checklist, rather than rebuilding
  already completed contributions or making historical repair a qualification gate.
  Run 96's local and remote `638-task` both end at
  `5f9710773f76967ef45b9fb2f048cf49deb8536f`. A verified Git bundle and terminal
  outcome receipt are retained in external application storage as
  `638-run96-terminal-checkpoint.bundle` and `638-run96-terminal-retention.json`.
- [x] Review and apply the [exact contract/registry amendment](../../packages/architecture/docs/proposals/README.md).
  Project PRJ-4, Architecture ARC-7/8/17/22 and Execution EX-18/25 currently freeze authority for the whole
  task. Replace that task-wide freeze with recorded adoption of approved model
  versions within the existing run. Align Workflow, Direction, Coordination,
  Verification, Agent and CLI references at the same time. Workflow stays proposed.
- [x] Include typed operation parameters, activity completion requirements and
  full event streaming in the same reviewed public-boundary amendment. Preserve
  ownership, exact guide approval, checked edits, independent review and cancellation.
- [ ] Reconcile approved but unapplied quality batch `303689eed95a` with this
  amendment. Preserve its approval and prerequisite evidence. If its exact bytes or
  baseline must change, present that change explicitly rather than silently
  rebasing the approval or activating an unavailable handler.
- [ ] Reduce the retained quality implementation to necessary file/test selection,
  observed checks and conservative evidence reuse. Unknown inputs cause a fresh
  check. Foundation is not a continuous dependency-analysis service. Remove
  superseded classifiers, duplicate check-selection policy and redundant wrappers.
- [ ] Remove the incoming `qualityRuntime` warning-count override; reuse the
  existing semantic lint rule and the accepted-limits log. Do not reintroduce caps.
- [ ] Record the named bootstrap capability and its removal/reuse ledger. Combine
  related fixes into coherent deliveries instead of repeated tiny PR/check cycles.

Acceptance: approved operations can become usable in the retained run at a recorded
boundary once their implementation is available. No candidate edit can approve
itself. There is one orchestration path, journal and project writer.

## B. Resolve and reload one integrated architecture

- [ ] Use Architecture's existing loader and shared request builder as the sole
  resolver. Compose project, component, role, activity, operation, profile,
  standards and approved host bindings into one validated model with source provenance.
- [ ] Specify merge rules once: recursively merge permitted object properties;
  scalar values and explicitly supplied arrays replace defaults. Empty arrays
  remain empty. Do not concatenate permissions or silently inherit activities.
  Ownership and authority remain explicit. File deletion is an explicit approved
  proposal action, not an accidental consequence of a missing value.
- [ ] Reload at every new run and after every successfully applied approved
  architecture update during a run. Use the accepted source and exact approval,
  never arbitrary candidate files as the source of new authority.
- [ ] Finish or cancel an in-flight activation before adoption. Validate the new
  model and handler availability, record the transition, and regenerate the next
  activity's context, Team view, MCP grants and completion checks together. An
  individual invocation retains its identity for reproducibility; the run advances.
- [ ] Revalidate pending work, retained checkpoints, ownership and affected check
  evidence under the new version. Preserve original acceptance and failed results.
  Retain unaffected evidence. Return incompatible changes to Architecture with an
  exact diagnostic; never continue with a partly updated model.
- [ ] Record any needed runtime adoption at the same safe boundary. Approved
  declarations alone do not load missing code or activate absent tools.
- [ ] Remove redundant frozen-catalog projections and raw whole-file ownership
  comparisons. Compare actual ownership through the canonical Team/model resolver.
- [ ] Test same-run addition of an implemented check, removal/change of an operation,
  changed ownership, explicit empty lists, rejected/stale approvals, restart during
  adoption, unavailable handlers and inspect/activation parity after reload.

Acceptance: a real approved architecture update changes what the next activity can
see and execute in the same logical run, without operator database repair or
retroactively changing the authority used for a completed activation.

Implemented bootstrap boundary: Execution now applies/adopts approved guides at its
existing workspace setup and activity checkpoint calls, with no added Workflow
hook, lock, store or recovery service. The committed candidate is captured through
the normal Git loader. Adoption retains exact approval, validates bindings and
handler/command availability, revalidates pending activities and checked owners,
and records the transition before switching the next request. Original engineering
and approval baselines remain separate from active authority. Complete answers are
reused across adoption. [The adoption reference](../../packages/execution/docs/architecture-adoption.md)
describes this implementation and its availability-versus-acceptance distinction.
Focused generic Git/SQLite regressions pass, including a real confined operation.
The live retained delivery and qualified same-run adoption remain unproven; the
broader merge/provenance and runtime-adoption checklist items stay open.

## C. Parameterize operations and declare activity verification

- [x] Extend the existing operation declaration with typed named parameters and
  defaults. Support relevant existing selectors, including owner, test tags and
  levels, paths and native-test selection, according to the actual command API.
- [x] Resolve defaults → explicit component overrides → explicit activity binding
  overrides. Preserve parameter provenance. Host-supplied identity values are
  authoritative; model-supplied values are accepted only where the declaration
  explicitly permits them. Missing/unknown parameters and invalid types name the
  precise binding and field in their diagnostics.
- [x] Interpolate declared values into executable arguments as data. Lists expand
  to argument lists; strings remain individual arguments. Reuse the current owner
  argument resolver. Do not introduce a shell, expression language, script generator
  or separate operation engine. Parameters do not rewrite executable, confinement,
  ownership or network policy outside their approved declaration.
- [x] Add an activity `verification` declaration referencing its resolved operation
  bindings. Define each operation and its parameter values once; the completion
  declaration refers to that binding instead of restating its command/configuration.
- [ ] Make required applicable operations run before activity completion. Testing
  can establish an identified expected-red assertion; record that assertion and
  its cause, rather than treating any nonzero exit as an acceptable red. Later
  implementation and self-review require the affected passing observations.
- [ ] Keep inapplicability explicit: no suite does not waive format/lint/types/build;
  disabled native tests do not establish a native pass. Host-required assembled
  checks remain mandatory and independent of local activity claims.
- [ ] Include resolved parameters, declared relevant inputs, environment, architecture
  and runtime identity in recorded checks and evidence-reuse decisions. Do not
  infer reuse when relevant input coverage is unknown.
- [ ] Declare real Execution-owned native/provider operations through this same path.
  Demonstrate the real command, provider, confinement, request/result and diagnostics.
- [ ] Rewrite each component/activity's operation and verification bindings alongside
  its instructions. Ensure documentation/editing activities can produce valid
  formatted files, Testing can observe the intended red, Implementation can run
  its necessary checks, and self-review can inspect actual current results.
- [ ] Prove different components/activities reuse one operation with different test
  tags; also cover empty selections, nested cwd, array arguments, invalid overrides,
  literal metacharacters, mandatory failures, restart and changed-parameter cache misses.

Acceptance: a component can select its actual test strategy declaratively without
copying a command implementation or depending on Foundation to approve routine work.
Check failures return complete diagnostics to the responsible activity immediately.

## D. Rewrite component purposes and every activity prompt

Use the [prompt practices and authoring template](../../packages/architecture/docs/prompt-practices.md).
The architect requested substantial prose with targets of at least 4K tokens per
component purpose and 6K per model activity's instructions. Record these as human
authoring targets; do not turn them into runtime rejection, truncation or padding.
Measure authored and resolved text with the identified tokenizer when available,
not a guessed characters-to-tokens ratio. Report unmeasured counts honestly.

- [ ] Approve the practices, template and representative rewritten prompts as one
  guide batch before rolling out the complete catalog rewrite. Preserve detailed
  component-specific content and reuse shared protocols from their authored source.
- [ ] For each purpose, explain the component's reason for existence, consumers,
  public service, responsibilities, collaboration boundaries, data/lifecycle,
  constraints, characteristic failure modes, measures and evolution strategy.
- [ ] For each model activity, author detailed paragraphs covering mission, inputs,
  method, exact available operations, realistic evidence, expected output, completion
  requirements, repair/escalation routes and concrete good/bad scenarios.
- [ ] Include complete originating findings, successful edit receipts, supplier and
  research answers, current check observations and run-log access in activity context.
  Fix the existing finding-propagation path tracked in #660; do not add a second store.
- [ ] Design realistic fixtures around the actual public contract and assembled
  record shape. Explain filesystem layout, owner metadata, nested cwd, configuration,
  confinement and native availability. Avoid fixtures that manufacture a pass by
  bypassing the production boundary or by skipping the behavior under test.
- [ ] Make Foundation's purpose broad shared technical strategy and reusable tooling.
  Revisit dependencies when a concrete wall or new capability requires it. Use
  conservative checks, rather than speculative exhaustive dependency analysis.
- [ ] Give Director and Reviewer independent, detailed decision instructions;
  distinguish them from a steward planning or self-reviewing its own contribution.
- [ ] Treat research as optional, component-owned learning with complete readable
  reports. Long instructions and reports are valid; no previews or size ceilings.
- [ ] Fix the compact component index before expanding purposes: include identity,
  authored short summary and source reference; include the acting component's full
  purpose once. Make other full purposes readable through ordinary file operations.
- [ ] Render complete selected instructions through inspect and activation using
  the same builder. Show source labels and architecture identity. Let Codex discover
  AGENTS.md and skills, and verify the delivered guidance reaches the real harness.
- [ ] Deliver approved standing/activity instructions through the installed
  provider's supported instruction channel, keeping task input and observed logs
  distinct. Inspect and record the actual channel/content; a heading saying
  "system prompt" inside a user message is not proof of instruction priority.
- [ ] Review every entry below for purpose, each activity's instruction text,
  operation bindings, verification and representative behavioral evidence. A box
  closes only when that component's complete set is rewritten and verified.

| Done | Component specification | Activities requiring individual review | Specific emphasis |
| --- | --- | --- | --- |
| [ ] | [project](../../.arc/architecture/components/project.yaml) | research, documentation, testing, implementation, review | Durable intent, owner-free goals, guide/result separation. |
| [ ] | [foundation](../../.arc/architecture/components/foundation.yaml) | research, documentation, testing, implementation, review | Broad tooling strategy, actual selectors, conservative reuse. |
| [ ] | [cli-app](../../.arc/architecture/components/cli-app.yaml) | research, documentation, testing, implementation, review | Live human/JSONL rendering, terminal questions and cancellation. |
| [ ] | [agent](../../.arc/architecture/components/agent.yaml) | research, documentation, testing, implementation, review | Central actor interface, complete instructions and observations. |
| [ ] | [team](../../.arc/architecture/components/team.yaml) | research, documentation, testing, implementation, review | Sole roster and ownership resolution across model versions. |
| [ ] | [architecture](../../.arc/architecture/components/architecture.yaml) | updating, research, documentation, testing, implementation, review | Integrated resolution, exact approval, live adoption and validation. |
| [ ] | [commands](../../.arc/architecture/components/commands.yaml) | research, documentation, testing, implementation, review | Transport-neutral structured lifecycle and event subscription. |
| [ ] | [workflow](../../.arc/architecture/components/workflow.yaml) | research, documentation, testing, implementation, review | Local recovery, canonical position, Plan → Architect → Run. |
| [ ] | [direction](../../.arc/architecture/components/direction.yaml) | planning, research, documentation, testing, implementation, review | Initial sequencing, explicit escalation, final rejection. |
| [ ] | [planner](../../.arc/architecture/components/planner.yaml) | planning, research, documentation, testing, implementation, review | Human objectives, owner-free goals, measured prior findings. |
| [ ] | [execution](../../.arc/architecture/components/execution.yaml) | research, documentation, testing, implementation, review | MCP checks/edits, checkpoint recovery, native events and metrics. |
| [ ] | [coordination](../../.arc/architecture/components/coordination.yaml) | research, documentation, testing, implementation, review | One journal/writer, ordered events, replay and durable cursors. |
| [ ] | [collaboration](../../.arc/architecture/components/collaboration.yaml) | research, documentation, testing, implementation, review | External-effect identity, issue/PR reconciliation and links. |
| [ ] | [verification](../../.arc/architecture/components/verification.yaml) | research, documentation, testing, implementation, review | Applicable observations, truthful expected red, independent verdict. |
| [ ] | [reviewer](../../.arc/architecture/components/reviewer.yaml) | assessment, research, documentation, testing, implementation, review | Complete evidence, useful lessons, rejected criteria and costs. |
| [ ] | [delivery](../../.arc/architecture/components/delivery.yaml) | research, documentation, testing, implementation, review, release (host) | Verified staging, uncertain publication, host operation contract. |
| [ ] | [manager](../../.arc/architecture/components/manager.yaml) | research, documentation, testing, implementation, review | Guidance consistency, skills discovery, no duplicate policy. |
| [ ] | [release](../../.arc/architecture/components/release.yaml) | research, documentation, testing, implementation, review | CI parity, delivery records and separate production authority. |

The host-only release activity receives a complete host lifecycle specification,
operation mapping, verification and failure behavior. It must not acquire a model
profile or a fabricated system prompt simply to fill an inventory row.

## E. Capture and stream the complete execution timeline

- [ ] Extend the existing journal/evidence path and observer. Retain raw harness
  events plus host context and tool records; derive the timeline and metrics from
  those records. Do not introduce another telemetry database, logger framework,
  task scheduler or competing source of truth.
- [ ] Record event identity, sequence, timestamp, parent/correlation identity, run,
  round/phase/task, milestone, component, activity, effective profile/model,
  architecture and runtime identity. Associate updates with their original event/item.
- [ ] Record the exact request and invocation configuration before activation, all
  exposed harness messages/item updates, tool calls and complete results/refusals,
  stdout/stderr, usage, errors, cancellations and final responses as they arrive.
  Preserve unknown event types and malformed raw output for diagnosis. Capture
  everything the provider exposes; explicitly identify fields it does not expose.
- [ ] Keep raw credential values out of invocation construction and records. Preserve
  complete project content and ordinary tool evidence in private application storage.
- [ ] Correlate harness tool events with local MCP requests, operation starts/ends,
  edit receipts/checkpoints, check observations, answers, research, rewinds,
  escalations, approvals, model adoption and GitHub effects. Do not double-count a
  tool merely because both harness and host observed it.
- [ ] Stream the same ordered observations immediately through Commands. Human CLI
  output identifies who is acting, what is happening, the outcome and its evidence.
  Long-running `--json` output becomes JSONL events ending with a typed result;
  `inspect --json` remains one read-only result. Record this CLI change in the amendment.
- [ ] Handle UTF-8 and JSON record boundaries, stderr separation, cancellation,
  terminal errors and restart without losing the acknowledged prefix. Use ordinary
  stream backpressure without dropping events, truncation, polling-only final
  output, a new buffer quota or a new work timeout.
- [ ] Give every model activity mapped read-only access to this run's timeline and
  complete retained artifacts, including relevant previous attempts. Keep evidence
  marked as observations, never instructions or approval. Reuse existing complete
  file reads and journal provenance checks; no paging/chunked file API.
- [ ] Evaluate the Codex SDK against the installed provider and required flags with
  a real parity check. Prefer its typed streaming interface if it preserves all
  necessary behavior. It wraps the CLI, so switching alone does not create missing
  observations. Keep one production adapter, not parallel SDK and CLI lifecycles.
  Include the configured instruction channel and complete event coverage in that
  evaluation, not just final-response parity.
- [ ] Verify the real provider path emits useful events before completion, records
  tool results and usage, handles an unknown event, and leaves a complete reviewable
  record after interruption. Do not promise hidden provider internals or fabricate them.

## F. Continuously measure and optimize time, tokens and cost

- [ ] Continuously update totals for the whole invocation and breakdowns by round,
  phase, task, component, activity and execution profile. Preserve both the profile
  alias and resolved provider/model/settings used for that activation.
- [ ] Record wall-clock start/end, elapsed time to date and operation durations.
  Attribute model/provider time, checks, tool work, handoffs, retries, approvals
  and publication where observable. Distinguish inclusive from exclusive durations
  so nested intervals are not summed twice. Show approval wait separately from
  active engineering time while retaining both in total elapsed time.
- [ ] Record provider-reported input, cached input, cache-write input, output and
  reasoning usage where present, at turn and activation scope. Preserve the raw
  provider accounting semantics; do not add subset fields twice. Missing usage is
  unknown, not zero. Measure prompt/artifact bytes separately from actual tokens.
- [ ] Resolve profile-specific cost against a verified dated pricing source or
  configured billing basis. Keep the pricing/model identity with the estimate;
  distinguish estimates from billed cost, subscriptions and unavailable pricing.
  Do not hardcode stale rates or derive dollar claims from token counts alone.
- [ ] Report cost and time of failures, repairs, repeated no-change activations,
  repeated checks, Direction calls and successful staging delivery. Link each
  aggregate back to its records. Compare meaningful outcomes and quality as well
  as raw throughput, without treating fewer tokens as automatic success.
- [ ] Feed measured findings and previous optimization results into every later
  Plan and Architect assessment. Agents use the live log to avoid redundant work;
  implementation/profile/prompt changes record a hypothesis and the observed
  before/after outcome. Preserve model quality, acceptance and human-approved
  profile choices. Architectural changes retain their approval boundary.
- [ ] Make this an ongoing loop responsibility, not a one-time audit. No automatic
  token/time budget, usage ceiling, timeout, report cap or unapproved profile switch
  follows from measurement. [Accepted limits](../../.arc/architecture/accepted-limits.md)
  remains the sole approval log for actual quantitative limits.

Acceptance: while a real task runs, a human can see elapsed work, current actor,
profile usage and attributable cost where known. Afterwards the complete timeline
explains the result and where effort went. The next round demonstrably uses it to
choose or evaluate a useful efficiency correction.

## G. Verify the integrated path, then qualify refinement

- [ ] Record intent, establish focused public regressions and observe the relevant
  failing cases before implementing behavior changes. Use meaningful fixture
  assertions and keep native/simulated/provider evidence distinct.
- [ ] Assemble architecture reload, operation parameters/completion, logging and
  the full prompt catalog before repeating expensive integration campaigns. Run
  focused checks during construction and refresh only evidence affected by edits.
- [ ] Apply formatting, lint, TypeScript, ownership/specification/guidance checks,
  relevant built-program tests, real native confinement and current-head CI.
  Required assembled checks remain mandatory; report each category separately.
- [ ] Demonstrate one platform-led task using the corrected prompts and checks:
  ordinary failure repairs within its milestone, complete answers and edits are
  reused, an approved model update is adopted, events stream live, and one PR
  reaches staging. No operator source/DB repair or weakened acceptance.
- [ ] Finish `refine` through the existing Workflow/Coordination lifecycle, preserving
  the previously approved standalone commands, approval and restart behavior.
- [ ] Run production `arcnexus refine --rounds 3`. Invoke Planner, Architect and
  Director for every approved goal in each round. Demonstrate approved guide
  refinement, useful implementation and later consumption of earlier findings.
- [ ] Retain a report linking assessments, exact approvals, runtime/model versions,
  complete event timelines, repairs, issues/PRs, checks and staging commits. Include
  elapsed time, tokens and cost attribution overall and per profile, and comparisons
  that show whether efficiency improved. Execution-path corrections restart the
  qualification streak; historical assisted attempts do not count.

## Completion evidence

At checklist creation, no behavior above is claimed implemented or qualified.
Documentation validation is separate from executable checks, hosted CI, native
observations and live acceptance. Mark each box only with the relevant observed
evidence; keep failure and operator-assistance history intact.

The first implementation batch applies the exact approved contract amendment and
connects native/host observations to durable journal identities, complete readable
timeline files and human/JSONL output. One event-derived projection reports live
elapsed time and provider usage by execution profile, model and reasoning setting.
Complete raw messages and MCP payloads stay in evidence files; ordinary task-state
reads use references. Missing usage and unverified pricing remain unknown.

Local evidence for this batch: build, strict TypeScript, lint, formatting and
specification/ownership/guidance checks pass; 379 native-enabled built-program
tests pass with no failures or skips. The observed failing regressions and check
logs are retained in application storage. A real read-only Director observation
(run 97) then used the production provider, read real project sources through MCP,
and returned a valid plan: 44.3 seconds wall time, 87,083 reported input tokens
(69,632 cached) and 1,745 output tokens. Its complete timeline, exact request and
provider results are retained outside source. Cost remains unknown. It made no
source changes and earns no delivery or qualification credit. That batch's
`0e4da679` passed [CI](https://github.com/fractalsynapse/arcnexus/actions/runs/44646556705).

The next operation batch uses one resolver for inspection, execution and check
identity. It supports typed scalar/argv-array parameters with provenance and
enforces required passing checks even when the model omits them or predicts red.
Its 53 focused built-program cases pass, including a real confined argv/cache
test. [Operation configuration](../../packages/architecture/docs/operations.md)
describes this boundary. That batch did not include test-selector support or
activate unapproved catalog declarations. The subsequent adoption batch passed
394 native-enabled built-program cases and
[CI at b41c162c](https://github.com/fractalsynapse/arcnexus/actions/runs/44653859480).
The catalog/prompt rewrite, broader architecture merge/provenance, complete
cost/phase analysis and refinement remain outstanding. The live streak remains 0/3.

The shared test command now accepts declared tag/level and literal path selection,
with explicit native-test opt-in. Its metadata reader validates literal fields
against catalog/path ownership without executing tests, and loads TypeScript only
when discovery is needed. Existing suites now declare their metadata; the incorrect
CLI owner label was corrected. The selected native integration command passed
28 tests with no skips. Empty selections fail explicitly. This supplies the real
command API for operation parameter overrides; new active catalog mappings still
need exact guide approval.

The assembled selector batch passes all 400 native-enabled built-program tests
with no failures or skips, plus build, lint and formatting. Its explicit native
selection refuses disabled execution rather than reporting skipped native cases
as a native pass. These checks remain separate from real platform-led staging
delivery and the three-round qualification.
