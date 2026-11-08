# Self-development MVP architecture

Accepted architectural direction, November 7, 2026, superseding the fresh-task envelope of
the same date and every earlier phase-two gate. This records intended behaviour. The
current runtime does not yet implement it, and nothing here is claimed as delivered.

## Why this plan exists

Nine days of effort produced 83 merged pull requests, 245 open issues, 37k lines of runtime
source and 40k lines of tests — and one delivery made by ArcNexus itself, which the
operator's own record calls "an assisted recovery, not a clean cycle." The measured run
failure rate was 26–37%, roughly 87% of runtime code was lifecycle plumbing rather than
engineering work, and one real attempt cost about 22 hours of wall time and 50 GB of state.

The conclusion is not that the goal is wrong. It is that the loop was built with too many
places where a small change can be rejected, too many copies of the same fact, and too many
states that each require a rescue path. This plan removes them.

## Target architecture

Six concepts, replacing the current sixteen entity kinds and their mirrored projections.

| Concept | Responsibility | Replaces |
| --- | --- | --- |
| Project | repository, package root, knowledge directories, machine bindings | platform, package, composition profile, environment, portfolio materialization, workspace members |
| Component | purpose, objectives with measures, constraints with measures, owned paths, role and profile references, standards | the same, at one schema version |
| Milestone | one accepted outcome: kind, single owner, acceptance, five Steps with checklists, status, evidence | assignment, plan, proposal, direction record, contribution, candidate, delivery, publication, receipt |
| Execution | one steward activation against one Step in one workspace | activation, session, turn, attempt, checkpoint, stage machine |
| Evidence | append-only events plus artefacts: diff, command results, verdicts, measures | report.json, timeline.jsonl, events.jsonl, activities.jsonl, four command projections |
| Request | a link from a milestone to existing accepted work owned by another component | inbox, dependency admission, retirement, cycle detection, fan-in/out |

**One store.** A single SQLite file per project plus an append-only event table. Reports are
derived on read and never co-written. Git remains the only holder of revision identity.

**One process, one lane.** The CLI is the host: no daemon, socket, readiness probe, host
lease or retained supervisor. One sequential lane per project; the plan is the queue.

**One gate.** The assembled candidate runs the milestone's checklist once, then one
independent read-only reviewer assesses it against the acceptance ids and the Focus measures.
No per-owner rerun, no separate delivery verification pass, no second goal assessment.
Evidence is reused by input digest instead of being recomputed and then cached.

**One route.** Branch → push → staging pull request → CI and required review → merge, with
the merge identity recorded. No promotion subsystem, no simulated upstream twin, no
external-effect ledger, no receipt store. Simulation survives only as the invariant it
protects: a test that a simulated lane cannot reach a real upstream.

**Six states.** `planned`, `active`, `prepared`, `verified`, `delivered`, `closed`, plus
`failed` and `cancelled`. A run that cannot proceed ends at `blocked: awaiting <named gate>`
with its branch, workspace and evidence retained. Resuming is a new execution reading the
recorded position. Pause, resume, recovery, promotion-resume, lease reclamation and
settled/retained/uncertain handling are removed rather than replaced.

**Capability model, kept.** Checked edits remain the only write route, with ownership scope,
current-Step authority, symlink and alias rejection, and content-hash conflict detection.
Idempotency comes from the expected hash alone: no transaction identifiers, proposal
references or edit journals.

**Context bounded by construction.** The director receives a component index (id, purpose,
objectives, constraints) and requests a full definition when it needs one; a steward
receives instructions, its component, its milestone and the standards for its activity.
Both are capped at roughly twenty thousand characters. Rules that were prose prohibitions
move into runtime enforcement.

## Ownership

- One accountable owner per milestone. The director shapes the milestone to fit an existing
  owner; when none fits, it emits a `component` milestone proposing the new owner and stops
  for the architect's acceptance. Agents create stewards only as proposals.
- Read access is the whole project; write access is the owner's declared paths.
- An owner's write set includes `CHANGELOG.md` and its own documentation, so a single-owner
  change does not become multi-owner coordination by policy.
- Ownership follows responsibilities that change together, not directories. Target five to
  nine owners for a project of this size; a component may own several paths.
- Out-of-scope need becomes a `Request` that links to accepted work, and the requester
  continues work that does not depend on the answer. The director converts it into the
  preceding milestone.

## Activities, profiles and standards

The five Steps are the activity vocabulary; there is no separate stage machine. Each Step
selects the activity, the activity selects the execution profile (`model`, `reasoning`,
`webSearch`, operation categories), so documentation and design can use one model,
implementation another, and review the independent reviewer's profile. Research is a
capability available in every Step through its profile, and becomes a deliverable only when
a checklist item names it.

Standards stay. They are short shared rules attached per activity — at most six per activity
and about 150 words each — and are the only mechanism that propagates a lesson between
stewards. The promotion path is `.arc/learning/` proposal, then architect acceptance, then
`.arc/architecture/standards/`, then inherited by every steward performing that activity.

## Task and workday

`arcnexus task run "<goal>"` means: work toward this outcome until it is met, released and
verified, or until it is stopped. `arcnexus workday` means: pursue self-directed work from
component purposes, objectives, constraints and requests, for a bounded session with a clean
shutdown and a resumable position.

Both are one loop. A directive differs only in **goal source**, **termination policy** and
**position**, where the workday adds an owner rotation cursor. Build tasks first; keep those
three as the only seam. Nothing in the target architecture assumes a single project, so
running several efforts at once is a deployment concern rather than a scheduler.

## Release verification

`verify-release` is a milestone kind, not a re-run of the checklist. It takes the release
identity, reads the delivery policy declared in architecture, and runs the project's live
checks against what is actually deployed — pipeline status for the release, deployment
health, and live acceptance — recording measures and writing the learning record that feeds
the next cycle's guidance and skill milestones. Projects differ by data, not by code.
Agents never merge main, tag or publish: those are named human gates in the plan.

## What is removed

- Configuration versioning: the migration engine, legacy schema readers, generated
  `migrated-*` operation identities and their tests. Historical evidence stays readable as
  data in application storage without executable adapters.
- Duplicate state projections, the reconciliation code that exists to keep them aligned, and
  the per-command evidence fan-out.
- Recovery, retained-host, promotion, lease, cleanup and evidence-retention subsystems whose
  states no longer exist.
- The simulated upstream twin and the second publication engine.
- The paged-evidence subsystem, replaced by bounded context.
- Breadth that the MVP does not exercise: workday scheduling, experiments and campaigns,
  portfolio multi-package materialization, and the interface layers. Deferred, not deleted
  as concepts — each keeps a place in the model so it can return without a new subsystem.

## Ordered batches

Component contracts are finalized and locked first, in
[`docs/interface/`](../interface/README.md): project, then foundation, then the CLI gateway,
then one library contract per component, then release. A locked contract's acceptance scenarios
are the specification the batches below must satisfy. **Project replaces the platform and
package pair**, so batch 5 renames that vocabulary rather than adding to it.

Each batch is a real delivery through the existing loop, ends with a merged staging
revision, and reports its simplification ledger.

1. **One store, one projection.** Collapse the mirrored JSON state into derived reads;
   delete the reconciliation path.
2. **One process.** Make the CLI the host; remove the daemon, socket, leases and readiness
   ceremony. Cancellation and evidence retention stay.
3. **One gate.** Single assembled verification plus one independent reviewer; remove
   re-verification passes, characterization checkpoints and the second assessment.
4. **One route.** Remove promotion, simulated providers, receipt stores and the twin
   publication engine; keep the simulation-isolation invariant test.
5. **One schema, one plan.** Delete versioning and migration, relocate the executable
   architecture source to `.arc/architecture/`, introduce milestones, plans, the plan
   template, per-activity standards and learning, and re-cut ownership to five to nine
   owners.

## Acceptance

One fresh real goal, given as a prompt, delivered by ArcNexus on one machine with no
operator hand-edits and no container: the director generates a plan from the template, one
owner works the five Steps, the checklist runs on the assembled candidate, the independent
reviewer records its verdict, the staging pull request merges, and the plan is updated with
status, evidence references and measures.

Recorded measures per cycle: wall time, model turns, added and removed lines, net change in
stores, states, owners and subsystems, and every `blocked` or `failed` outcome with its
cause. The target for the first qualifying cycle is under sixty minutes of wall time, under
two gigabytes of state, and a net concept delta of zero or better.

Three consecutive clean cycles remain the reliability rule, applied to this reduced path as
a measurement of it — not a gate stacked on the current one. An unexpected execution
failure, a manual state repair or a bypassed check ends the sequence; an expected failing
regression assertion and a deliberate negative test do not.

## Deferred

Recovery of historical runs, promotion of old deliveries, simulation release and promotion
qualification, self-directed workday qualification, portfolio and cross-repository work,
OpenAPI and MCP gateways, and the React interface. Deferred work is deferred, never claimed
complete.
