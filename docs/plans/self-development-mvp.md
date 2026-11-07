# Reliable self-development MVP

Accepted architectural direction, November 5, 2026; implementation and qualification
remain work to do. This is the current phase-two scope and acceptance contract.
It supersedes the broader gates in the historical managed-lifecycle plan and linked
execution/configuration plans. The simplification policy and reliability threshold
are authored once in [AGENTS.md](../../AGENTS.md#simplification-and-reliability).

## Supported envelope

One platform, one sequential execution lane and the fixed container volume mount in
the [deployment recipe](../release/container-qualification.md).
Tasks and workdays are different intake policies for the same coordinator, assignment,
verification and delivery process. The real director chooses eligible component
stewards; ordinary inbox dependencies can activate others. No prescribed team size,
parallel scheduling infrastructure or alternative simulation execution engine.

Use existing component definitions and straightforward platform/package composition.
Architectural intent and operations each have one authored source. Keep necessary
local attachment and managed repository discovery; defer transactional edits across
multiple repositories, arbitrary relocation of unfinished runs, broad portfolio/CRUD
conveniences and interface expansion. The fixed mount is the deployment contract;
volume persistence and restart recovery at that mount remain required.

Keep component ownership as the sole file-write authority, host-controlled checked
edits, independent verification, supervision/cancellation and isolation of simulated
upstream effects. Agents cannot grant themselves permissions or change their own
acceptance baseline. Removing frozen-supervisor requirements does not remove these
trust boundaries or allow reported failures to be rewritten as successes.

## One process

1. Accept intent through task or workday intake and record actionable work.
2. Let the director/stewards select work within component authority. Persist inbox
   requests and required delivery milestones through the existing coordination store.
3. Execute each assignment in its own development branch/worktree from staging.
   Stewards choose their engineering activities and files. The host enforces actual
   authority, safe checkpoints and the applicable verification obligations.
4. Assemble and independently verify the candidate using one evidence bundle and
   reader. The same independent assessment covers engineering criteria and task-goal
   readiness for integration; the director routes actionable corrections.
5. Use one publisher route: verified development branch → staging PR → policy-allowed
   integration. Simulation supplies isolated Git/upstream providers to this same
   route. Promotion submits the verified changes to it under current live authority;
   it does not create another engineering, verification or release algorithm.

Independent engineering acceptance precedes publication. The original goal remains
visible to the reviewer, but future host integration/release receipts cannot be
prerequisites for accepting engineering work. The publisher must still observe and
record those outcomes before reporting lifecycle completion. This is a sequential
handoff, not a waiver of publication requirements or another model assessment.

Source and runtime storage remain separate. Keep observed commands, outcomes, edits,
reviews and delivery references in application storage. Every consumer uses the same
paged evidence service; no inline copies of large artifacts or private-path-only proof.
Use the existing store, operation executor and reporting services. Consolidate their
callers and delete obsolete alternatives; do not add a new framework around them.

Recovery uses the installed runtime after the host reaches a safe checkpoint or
managed execution has stopped. Record the runtime transition, validate ownership,
acceptance, candidate and pending-operation state, then continue through the same
scheduler. Keep the existing run when compatible. An incompatible checkpoint gets an
explicit migration or honest blocked result, not an automatic fresh run or blind
operation replay. Historical evidence remains readable; frozen executable copies and
parallel executable compatibility paths are not required. Do not hot-patch executing
processes or let a worker modify its supervising code.

Verification has one service. Engineering uses owner-scoped checks; assembled delivery
uses the required repository checks. Reuse completed evidence when its source,
authority, operation definition and relevant environment inputs are unchanged. An
agent's earlier check cannot accept a later changed candidate. Provider-required CI
and reviews still apply. Behavioral changes retain meaningful regression evidence; do not manufacture a
red-before-every-edit ritual. Research, documentation and refactors use their
appropriate checks.

## Implementation order

- Establish this contract and reconcile conflicting active guidance. Pause work that
  belongs to deferred scope, retaining its edits and evidence.
- Unify evidence capture/retrieval and engineering/goal verification. Remove duplicate
  prompt payloads and promotion-specific evidence assembly; exercise real handoffs.
- Replace frozen-runner recovery with one normal checkpoint/restart path. Consolidate
  run control and remove superseded executable recovery variants after migration.
- Route preparation, engineering checks, delivery checks and promotion through the
  same operation/verification services. Reuse valid evidence instead of repeating work.
- Reduce the supported deployment and composition paths to this envelope. Keep one
  active development lane and one publisher route; retire bypasses as their callers
  migrate. Avoid mass deletion of useful implementations without checking callers.
- Qualify the resulting lifecycle, then use it to deliver small subsequent increments.

Implement related removals and migrations together, with focused tests for trust and
recovery risks. Assemble the simplification before long integrated checks. Readiness
comes from observed behavior, not the number of deleted files or new abstractions.

## Dependent contributions and assembled verification

Accepted November 6, 2026; implementation tracked in #312. Related engineering
contributions may complete as one assembled delivery instead of requiring each
owner's partial candidate to pass independently. This removes the deadlock where
an implementation awaits a regression test that cannot pass without that same
implementation.

A prepared contribution is not verified delivery. Each steward retains its own
branch, checked edits, component ownership, plan and observed checks. Within a
related contribution group, prepared dependency work may unblock engineering;
outside that group, the existing verified-delivery milestone remains required.
The host reconciles attributed snapshots against the current verified candidate,
runs captured checks and independent review on the combined result, and advances
the verified candidate and all contributing delivery receipts atomically only
when their criteria are satisfied. Failed checks, conflicts and missing evidence
retain the contributions and return actionable findings through ordinary correction.
They never promote a partial candidate or fabricate a delivered dependency.

Use the same reconciliation, operation executor, evidence capture, verifier and
publisher for one or several contributors. Do not introduce another scheduler,
publication route or shared worker write authority. Keep uncertain operation and
interruption recovery explicit; repeated completion cannot deliver twice.

## Qualification before expansion

Apply the consecutive real-cycle threshold in AGENTS.md to this supported process.
Each counted cycle must deliver a useful ArcNexus improvement through real direction,
engineering, applicable tests, independent verification and the canonical staging
workflow. Record exact revisions, outcomes and artifacts outside source. No scripted
model, manual repair, discarded failed attempt or alternate publishing script can
stand in for a successful cycle.

Across qualification, exercise task and self-directed workday intake, a real inbox
dependency, safe pause/resume, and restart with unfinished work at the fixed mount.
Keep native source-write and simulated-upstream enforcement evidence separate. At
least one useful simulated delivery must go through fresh live verification and the
real staging workflow. Real main merges, tags and package publication remain human
controlled. Qualification does not require an arbitrary number of participating owners.

Do not repeat unrelated suites for each counted cycle. Reuse valid infrastructure and
check evidence; repeat affected qualification when the process or its assumptions
change. Deferred features are explicitly deferred, never reported as passed. Once the
supported process is reliable, phase-three gateways expose these same application
services and feature growth proceeds in small agent-delivered increments.
