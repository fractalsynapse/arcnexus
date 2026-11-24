# Recover a prepared checkpoint

This intent is for Execution maintainers implementing prepared-task recovery and
operators deciding whether a retained task can resume after staging moves. It
records the accepted behavior for `prepared-recovery-continuity` before its
behavioral correction. The governing obligations are
[Execution EX-11, EX-17, EX-22 and EX-25](../contract.md#acceptance-scenarios).
This document changes no contract, ownership or acceptance.

## Current characterization scope: issue #720

This assessment characterizes the existing behavior at captured revision
`fef60bb8d6aec3c2dcbedb06cac13c2cc3ee79b8` for
`prepared-recovery-current-evidence`. Testing observed the existing assertions
passing; no product or fixture correction was needed. The earlier correction intents and run
results below retain their original dates, identities and evidence scope.
They are history, not a claim that their failures remain present or that their
passes apply to this candidate.

The current [public prepared-recovery scenarios](../tests/integration/prepared-recovery.test.ts)
have SHA-256
`6907461fcae8a2cc48efd6aa5a5889b53ad90f26b2c50b2ef22362643631d40e`;
their [shared fixture](../tests/fixtures/prepared-recovery.ts) has SHA-256
`ac3d8564a7de71835902f246ea63ee721b547424d3912c8d2f412cd7f7ed6e3b`.
The fixture uses public Workflow with real Execution admission, preparation,
assembly, Architecture, Agent, Git and reopened Coordination SQLite state.
An explicit deterministic executable invokes LocalMcp to acknowledge checked bytes
and obtain the foreground handler's exact multiline answer before interruption.
The interruption throws through normal cleanup; the separate abrupt-checkpoint
characterization below establishes a different boundary.

| Current criterion | Existing source assertions to characterize |
| --- | --- |
| `prepared-retained-continuity` | Same task, issue, branch, original base and accepted criterion; exact answer and answer artifact; one prompt and original receipt; identical edit replay returns that receipt; a distinct recovered question retains both exact answers. |
| `prepared-current-authority` | New capture revision, owner roots, original and newly declared acceptance check IDs, actual discovered MCP tools and configured executable/model; changed owner or missing pending activity refuses before another provider activation or checkpoint movement. |
| `prepared-conflict-preservation` | Compatible staging and checked contributions retain their Git ancestry and checked blob; conflicting additions retain the task head, checkpoint and both sides' bytes with complete real merge-tree output; another staging advance requires another captured base. |
| `prepared-evidence-accurate` | Associate actual results with these source identities and the assessed candidate/environment; keep controlled gates, historical observations and missing current execution explicit. |

The [caller-consumer scenarios](../tests/integration/caller-scope-recovery.test.ts)
also assert actual MCP/public inbox identity and complete recovered answers,
pending gates, research artifacts and supplier diagnostics. Research and legacy
supplier observations are explicitly seeded records; their assertions do not
establish live research or supplier execution. Current
[HostTask.inboxScope](../src/index.ts) already passes `callerRevision` to
`inboxIdentity`, matching the [recorded correction](caller-scope-recovery.md).
The earlier public-scope rejection therefore motivates retained regression
coverage rather than proving a current defect.

The [authority scenario](../tests/integration/caller-authority-recovery.test.ts)
keeps host decisions bound to the exact proposal, question and capture, and varies
review scope with candidate, owner evidence and acceptance. After staging moves,
the old decision is unavailable and the review scope differs. These are identity
assertions; they do not execute independent assessment or attempt a real merge.

Current [workspace setup](../src/index.ts) observes publication before checkpoint
reconciliation, abandoned-workspace recovery and
[prepared reconciliation](../src/prepared-recovery.ts). The latter verifies local
and remote checkpoint identity and current staging, validates retained owners and
pending activities, and obtains a merge tree before recording a new checkpoint.
These source observations explain the refusal boundary; they are not execution
results.

### Current execution and remaining boundaries

Testing executed the existing prepared and caller recovery scenarios as
expected-pass characterization. The run 145 observations below supersede the
initial documentation position's missing execution evidence. They establish no
new behavioral defect or intended red.

Concrete limits of the existing fixture are visible: its provider publication
lookup always returns no PR, and final Verification and Delivery return controlled
accepted/merged results. It asserts newly declared required check selection but
does not execute those checks at its final gate. Its authority test compares review
identities rather than obtaining an independent verdict. Consequently these
Execution cases cannot establish fresh required checks, stale-verdict refusal at
publication, uncertain PR reconciliation, confirmed prior merge reuse or one actual
hosted PR. Those observations belong to the accepted subsequent
`recovered-acceptance-current-evidence` (Verification) and
`retained-publication-current-evidence` (Delivery) milestones. They remain required
before the host's assembled acceptance and delivery.

Implementation reconciles these passing observations without a behavioral edit.
The current formatting, lint, strict types and build observations below identify
the assessed checkpoint, resolved operation, cwd, exit and complete log;
older quality results remain historical. Native confinement, live inference, hosted CI,
configured review and confirmed staging integration remain distinct observations.

### Simplification ledger

- Reuse the existing prepared fixture, caller policy, journal and checked receipts;
  this assessment introduces no recovery path or durable state.
- Characterize the existing public assertions before choosing a correction; retain
  earlier red and passing observations without manufacturing another defect.
- Keep required-check execution and publication reconciliation with their accepted
  owning milestones and the single later host assessment and delivery.

## Executed prepared recovery characterization: run 145

Issue #720 retains branch `720-task` from staging base
`fef60bb8d6aec3c2dcbedb06cac13c2cc3ee79b8`. Documentation checkpoint
`2d0591cde71cfe0d30bf714d001a4288415218a5` records the initial assessment;
Testing changed no source or fixture. The prepared test and fixture hashes above
therefore identify the exercised sources. The caller-consumer test SHA-256 is
`bd60d3afbc8608e315dfcf30e44704203f867b4b4433c3009aa76091adc87808`;
the caller-authority test SHA-256 is
`f99f7d8f351f6f166d89e1e779ba046f69613ab1bb2cdb7fdc472ccd4afd4d8b`.

Complete evidence is retained outside source under invocation
`ad4f08f02034c389b42ff853b024e7ca2c21db31cd8c725686755a8a0c517664`.
The mapped retained-evidence index and `145-1-run-timeline.jsonl` resolve the
following filenames. Completed MCP observations `145-243`, `145-262`,
`145-265`, `145-268` and `145-271-mcp-observation.json` retain exact
commands, argv, cwd, statuses, durations and full log paths.

| Observation | Resolved command | Exit | Complete log |
| --- | --- | --- | --- |
| Owner characterization | `npm test -- execution` | 0 | `145-242-owner-tests.log` |
| Owner formatting | `npm run format:check -- execution` | 0 | `145-261-owner-format.log` |
| Owner lint | `npm run lint -- execution` | 0 | `145-264-owner-lint.log` |
| Strict repository types | `npm run check` | 0 | `145-267-repository-types.log` |
| Repository build | `npm run build` | 0 | `145-270-repository-build.log` |

These observations ran from the captured `runs/145/worktree` directory.
The owner log SHA-256 is
`be99360a2acb4d847354998be190b663585c7463e92931af84dd8b896482db75`.
It records 268 tests: 252 passed, none failed or cancelled, and 16 skipped.
Prepared cases 161–169, caller-consumer cases 38–42 and caller-authority case 33
all passed without skips. Skipped native cases remain gaps.

For `prepared-retained-continuity`, the executed prepared cases compare the
original task, issue, accepted criterion, historical base and original receipt,
the exact multiline answer and its canonical artifact. They retain one original
prompt and acknowledged edit. Identical MCP edit replay returns the original
receipt after staging moves; a distinct recovered question supplies its complete
new answer while retaining the original. The caller-consumer cases also compare
complete original and recovered answers and readable artifacts through public
hold reconstruction. Dropped, paraphrased, duplicated or transient answers would
fail these assertions.

For `prepared-current-authority`, the resumed executable receives the new
capture revision, original criterion, owner roots and discovered MCP tools;
the captured acceptance includes both original and newly declared check IDs.
Changed ownership and missing pending activity refuse before another provider
activation or checkpoint movement. The authority case retains its original
host decision but cannot retrieve it under the recovered capture; changed
proposal/question and changed review candidate, owner evidence or acceptance
produce distinct scopes. This establishes decision and conversation identity,
not a fresh independent verdict or attempted publication.

For `prepared-conflict-preservation`, compatible recovery retains both Git
ancestries and the checked blob. Conflicting additions preserve the checkpoint,
branch head and both sides' exact bytes; the refusal contains the complete real
`merge-tree` output, including stage entries and messages. Repeated staging
movement requires a second captured base before activation. Abandoned-workspace
coverage reconstructs a clean workspace explicitly and observes its removal
before a fresh attempt; it is not an abrupt process-exit demonstration.

The enclosing owner log embeds complete `controlledRecoveryArtifact` diagnostics
with original paths, SHA-256 and text before temporary cleanup. These preserve
prepared requests, controlled provider events, MCP results and answer artifacts
after the temporary projects disappear. The executable provider reports its
actual argv, cwd, executable and Node runtime in those observations. It is a
deterministic fixture, not a live Codex model. Research and legacy supplier
records in the consumer scenarios are explicitly seeded; actual unanswered
clarification gates retain their required action and evidence.

For `prepared-evidence-accurate`, this is passing characterization of existing
product behavior and a documentation reconciliation. No new production code,
fixture, recovery path or state store was introduced. Earlier run 125 red and
passing results, run 129 rejection and run 136 checkpoint observations retain
their historical scope. Statements of correction intent below describe those
earlier baselines; they do not leave the currently passing caller regression
pending.

Required final-check execution and independent assessment remain with
`recovered-acceptance-current-evidence`; uncertain or outdated PR reconciliation
remains with `retained-publication-current-evidence`. Neither is a prerequisite
for this unchanged Execution characterization's quality checks. Their results
and the later host assessment are required for assembled acceptance. No live
inference, native confinement, hosted CI, configured PR review or confirmed
staging merge is established by this Execution fixture.

## Retain the task and its history

Resume the same task and issue selected by Direction through Collaboration.
Preserve the issue branch, secured checkpoint bytes, successful checked-edit
receipts, complete evidence and verbatim human answers, including meaningful
whitespace and line breaks. The requesting activity receives its complete recorded
answer without another prompt or duplicate acknowledged write. Replaying an
identical acknowledged edit returns its retained receipt.

Keep the original engineering base, accepted requirements and criteria, plan
position, activation authority and review observations traceable in
[Coordination's existing journal](../../coordination/contract.md). Recovery appends
observations; it does not relabel an earlier verdict, overwrite a historical base
or replace the accepted plan to escape an unresolved obligation. A checkpoint push
secures progress; it establishes neither final acceptance nor staging delivery.

## Caller knowledge across recovery

The correction intent for `recovered-caller-knowledge-correction` is to use the
existing [`callerRevision` policy](../src/research.ts) consistently for ordinary
callers, including the public [`HostTask.inboxScope`](../src/index.ts) accessor.
Activation tools, clarification replay, research replay and public inbox consumers
must identify the same actual caller conversation before and after staging moves.
Ordinary caller continuity uses the original recorded task base; it does not
replace the newly captured engineering base or authority.

This includes the consumers that reconstruct
[hold context](../src/hold-context.ts) and
[retained supplier diagnostics](../src/supplier-context.ts). A recovered hold must
retain complete verbatim answered questions, actual unanswered clarification gates,
research results and their evidence under that caller's canonical identity.
An unanswered gate must remain actionable, and a rejected supplier request must
still return its exact diagnostic to its original caller. Keeping those records
in the journal is insufficient if these consumers cannot select them.

Retained knowledge remains task input. Current captured ownership, activities,
operations and applicable acceptance govern continuation; continuity grants no
write permission or approval. Preserve the exact proposal, baseline, actor and
question binding of host-owned approval gates through `requestDecision` and
`decisionRecord`. Preserve independent review's candidate, owner-evidence,
capture and acceptance bindings. Do not apply ordinary original-base continuity
to either boundary in a way that reuses stale authorization or verdicts.

The independent rejection in `129-3-independent-caller-scope-recovery.md` supplies
the distinguishing public Git/SQLite/executable-provider/MCP regression. Its
retained branch is `f3263ec4ee08965bc10691fd09ea6a9c768b7af2`; the relevant
Execution sources matched tested snapshot
`84c010940d1f8d9abafe704f5d4a84bdc1a0c7f3`. The public scope agrees with the actual
MCP question before staging advances, then fails afterward with
`Public caller scope differs from its actual MCP conversation`. This is observed
controlled-provider recovery evidence, with controlled final delivery.

For `recovery-history-preserved` and `recovery-current-capture`, the correction
must verify that public scope matches the actual MCP conversation after recovery
and that the consumers receive complete answers, pending gates, research evidence
and supplier diagnostics. Assert the distinguishable multiline answer exactly,
without another prompt or duplicate acknowledged edit. Also retain assertions
that changed ownership prevents unauthorized continuation and that earlier
host approval or independent review cannot authorize the recovered candidate.
The earlier numeric-check correction remains accepted retained work. This note
records intent before correction; it does not claim the caller regression passes.

## Capture before continuation

Observe current staging and issue-branch state before effects. Reconcile uncertain
checkpoint pushes and the task-owned abandoned worktree before reconstructing a
fresh attempt. Execution owns this setup before stewards begin; loss of a local
directory does not authorize another issue, branch or publication.

Record the newly observed staging base and approved architecture capture, including
Team ownership, available activities, resolved operations and applicable acceptance.
Retain the earlier capture and its association with completed work. Pending requests,
MCP grants and required activity checks must use the new capture coherently.
Candidate declarations cannot authorize themselves.

Preserve the original requirements when reconciling newly applicable acceptance.
Additional applicable requirements do not silently replace earlier criteria.
A required boundary or acceptance change uses the existing architectural authority
route, with an explicit gate and retained decision evidence. Earlier approval of
a candidate, capture or exact protected proposal does not approve the recovered
candidate or a changed proposal baseline. Reuse a human answer as historical task
input without promoting it into current authorization.

Revalidate retained checked ownership and pending activities before continuation.
A changed owner, unavailable activity or unavailable operation produces a concrete
diagnostic and prevents unauthorized work. A supplier contribution is sequenced
through Direction and grants no foreign write scope. Routine owned correction and
authorized staging retry need no additional human approval.

The identities serve different purposes:

| Identity | Recovery use |
| --- | --- |
| Original engineering base | Explains the secured contribution and its history. |
| Newly observed staging base | Defines the recovered contribution's staging parent. |
| Approved architecture capture | Defines current ownership, operations and applicable acceptance. |
| Secured checkpoint | Retains acknowledged bytes and attribution before reconstruction. |
| Final candidate tree | Identifies exactly what checks and independent review assess. |
| Verification checkout | Provides a read-only assessment environment, never a substitute publication source. |

## Preserve compatible work and diagnose conflicts

Use Git's ordinary three-way merge of the secured checkpoint and observed staging.
Compatible changes, including independent changes within one file, retain both
contributions. Overlapping paths or whole-file guidance changes alone do not prove
a conflict; current authority and actual merge results determine whether work can
continue.

A textual conflict retains the secured branch and checked bytes with Git's complete
conflict diagnostic before any overwrite or ref movement. Unexpected local or remote
branch identity is also a refusal, not permission to force replacement. Resolve
conflicts through the normal accountable activity under the current capture, or
retain an explicit authority or external-prerequisite gate with its evidence.
Do not manually repair the journal or discard failed observations.

A compatible recovery records its new base and checkpoint relationship, confirms
the checkpoint through ordinary reconciliation, then reconstructs the worktree.
Another staging advance requires renewed reconciliation; a prior recovery does
not authorize using a stale parent.

## Verification and publication boundaries

[Workflow](../../workflow/contract.md) retains the activity position and routes
repair. [Verification](../../verification/contract.md) must assess the recovered
final candidate against its captured acceptance, preserving original requirements
and historical observations. Required current and affected checks and a fresh
applicable independent verdict precede delivery. Earlier approval is inapplicable
when the required tree, staging base, capture or acceptance identity changes.
Unchanged scoped evidence is reusable only when its relevant inputs and environment
match; historical approval is not refreshed by retaining its artifact.

[Delivery](../../delivery/contract.md) owns final publication reconciliation.
Execution supplies the exact branch, candidate, staging parent and retained evidence.
After a lost provider response or an outdated open PR, observe issue-branch and PR
facts before retrying effects. Reconcile the existing publication with the newly
accepted candidate and reuse its matching PR or confirmed prior merge. Conflicting
or unavailable facts prevent a success claim and preserve work for continuation.
Do not create a second delivery to escape uncertainty or stale approval.
Delivery remains pinned to the newly reviewed tree and staging parent; subsequent
staging movement returns to reconciliation.

## Source baseline and distinguishing evidence

Source inspection at revision `aae84422d50f59311f36cb0cd397c58293fe8c91` shows
[HostTask.setupWorkspace](../src/index.ts) invoking publication observation,
checkpoint reconciliation and [prepared recovery](../src/prepared-recovery.ts).
Recovery validates retained owners and pending activities through
[architecture adoption](../src/architecture-adoption.ts) and uses Git
`merge-tree`, retaining complete conflict output without moving a ref on conflict.
[Checkpoint reconciliation](../src/checkpoint.ts) observes remote heads before
pushes. [Clarifications](../src/clarifications.ts) persist exact answers and replay
them by inbox scope. These source observations do not demonstrate answer continuity
when the capture changes or the complete recovered publication path.

The public regression must secure a checked checkpoint, record a distinguishable
multiline answer, move staging and restart through real Git and Coordination state.
For `recovery-history-preserved`, assert exact resumed answer bytes, no repeated
prompt or acknowledged edit, and traceable task, issue, receipt, original base and
acceptance. For `recovery-current-capture`, assert the new base, ownership,
operations and applicable acceptance reach pending requests, with changed-owner and
unavailable-activity refusals and evidence for any required authority gate.
For `recovery-conflict-retained`, assert compatible contributions survive, conflicts
retain checked bytes and complete diagnostics before overwrite, and another staging
advance requires reconciliation.

These are intended regression observations, not a claim of passing execution.
Controlled external responses, real Git/SQLite recovery, native confinement, live
inference, hosted CI and independent delivery evidence establish different boundaries.
The production provider and single-string Agent request remain on the shared
[inspection and activation path](inspection-parity.md); web access stays at the
provider policy boundary. Native/provider evidence must identify the actual binding,
versions, request, status and complete logs; unavailable prerequisites remain gaps.
Only the host's later assembled verification and delivery can establish the final
reviewed tree, staging parent, required checks, independent verdict and confirmed
staging merge.

## Abrupt interruption and activity checkpoints

For `checkpoint-recovery-evidence` (#708), maintainers must distinguish a secured
file receipt from a completed activity. This intent is recorded against source
revision `7be51bf590b673e5904ef3f17a83354efd81eee7`, before behavioral changes.
It extends the recovery observations above under EX-11, EX-17, EX-22 and EX-27.

[ActivationTools](../src/activation-tools.ts) retains a checked file and its receipt
through [saveCheckpoint](../src/checkpoint.ts) before returning acknowledgment.
That file checkpoint carries no completed activity position. A later activity
checkpoint reconciles remote state before recording completion.
[HostTask.setupWorkspace](../src/index.ts) reconciles retained checkpoints,
recovers the recorded abandoned workspace, and reconstructs the next attempt
before steward activation. Cleanup secures checked contents before removing the
task-owned worktree. These are source observations, not executed crash evidence.

The accepted abrupt boundary is a real subprocess exiting after the actual mapped
checked-edit acknowledgment and before normal termination cleanup. The parent
must observe that receipt and the abandoned workspace before reopening the task.
A thrown exception or cancellation that runs cleanup, or a workspace recreated
after cleanup, does not establish this boundary. Use isolated Git and durable
Coordination state, with a generic committed project and explicit provider
bindings; do not depend on the developer's live repository or credentials.

Reopen through the existing admission, preparation and Workflow lifecycle. Before
another steward activates, recover the same task, issue and issue branch, preserve
the acknowledged bytes and original receipt, and reconcile the recorded abandoned
workspace. Remove it only after securing its contents, then reconstruct a fresh
attempt from the retained checkpoint. Observe that only the current task worktree
is active and that unrelated checkouts survive. Replaying the identical checked
edit must return its original receipt without another write. If the activity was
unfinished, resume it with that receipt and complete recorded answers; if its
completion was checkpointed, resume its successor without replaying completed
edits. The repository checkout and a read-only verification checkout are distinct
from this task workspace.

For the current checkpoint goal, the criterion-linked observations are:

| Criterion | Observation required from execution |
| --- | --- |
| `checkpoint-observe-before-retry` | Lose a checkpoint push response after the controlled remote accepts the head. Record ordered remote observations and mutations across restart. Observe that head before any repeated mutation, reuse task/issue/branch, and do not push the already secured effect again. A total push count alone does not establish ordering. |
| `checkpoint-abrupt-preservation` | Retain the actual child acknowledgment, child exit and pre-restart abandoned-worktree observation. After ordinary reopening, assert exact restored bytes, original receipt identity, reconciliation before activation, one active task worktree and eventual removal of task-owned worktrees after preservation. |
| `checkpoint-pending-successor` | Interrupt after recording a check but before feedback. Recover its original expectation, exact numeric exit and readable original log while the activity remains pending. An omitted recheck cannot clear it. Correct the relevant inputs and satisfy the original expectation; then interrupt after completed checkpoint and observe only the successor on restart, with verification preceding delivery. |
| `checkpoint-current-quality` | Retain applicable formatting, lint, strict types, build and recovery observations for the current candidate, including resolved commands, arguments, directories, exits and complete logs. |

An unresolved check retains its failed observation and acknowledged edits even if
a later attempt fails differently. Neither cleanup nor a completed model response
marks it satisfied. Preserve deliberate expected-red observations separately from
required-pass failures; correction does not rewrite historical exits or logs.
Workflow owns the durable position and repair routing. Final independent
Verification and Delivery retain their gates; a checkpoint push cannot discharge
them.

### Current checkpoint assessment scope: run 183

This section is for Execution maintainers selecting characterization and reviewers
assessing its applicability. It records documentation-only source assessment for
`checkpoint-current-evidence`, issue #726, branch `726-task`, at engineering
base and captured revision `7beffb8f5dcd1e6f971d341101e35e6ef80ddf97`.
Run 183's `183-1-run-timeline.jsonl` records that base, accepted plan and
host-prepared issue branch under invocation
`087b55f1fba63518c4dced8ba8c4f9d83c82670e0f57bfc92344c909672f14df`.
Its complete retained index is
`183-63-retained-evidence-986cb2e8c33711f3f83ae2a8ba9fe9a2e5ddafa54a5e5d73fc2ad376576132d9.json`.
These are identity and planning observations, not current checkpoint execution
or quality results.

The inspected source identities are:

| Source | SHA-256 |
| --- | --- |
| [Checkpoint scenarios](../tests/integration/checkpoint.test.ts) | `5da4127b7f65b26daf41d27d74835191111141a9e2200e32a8d19c297777afff` |
| [Crash scenario](../tests/integration/checkpoint-crash.test.ts) | `7d7c3d196c46f8e35f3604e73b826a874375965031780a760f968f0483da981d` |
| [Interrupted-check scenarios](../tests/integration/interrupted-check.test.ts) | `eb7bcc6da783680d1c6e8adaa2e62ed2551d6987c78ab781e422c7a63cc736b7` |
| [Shared checkpoint fixture](../tests/fixtures/checkpoint.ts) | `8886c07d85e64230e84dfb50cb8a2d75c6ed4df16b4c5e5d12184c453070b0a0` |
| [Crash child entry](../tests/fixtures/checkpoint-crash-child.ts) | `883a6a4d2035eef3bb26b6377a0ec92f53803e20a9459699e316ca6b5211c3f9` |

The three scenario hashes match the run-136 account below. That match alone
does not establish unchanged production dependencies, resolved operation inputs,
authority or environment. Preserve run 136 as historical characterization;
reuse an observation only after establishing all relevant identities match.
Run 175's inspection-parity acceptance does not itself assess these checkpoint
criteria. No new behavioral defect is established by this source reconciliation.

### Existing checkpoint coverage

[Checkpoint scenarios](../tests/integration/checkpoint.test.ts) and their
[shared fixture](../tests/fixtures/checkpoint.ts) contain lost-response,
receipt-replay, cleanup and successor assertions using real local Git and SQLite
Coordination with controlled actors and Collaboration. The lost-response case
records ordered remote observations and pushes, asserts that the first issue-branch
event on retry observes the accepted head, and rejects a repeated push of that
head. The moved-staging abandoned-workspace case recreates a clean workspace after
a prior run; that case alone does not cover an abrupt process exit.

The separate [crash scenario](../tests/integration/checkpoint-crash.test.ts) and
[child entry](../tests/fixtures/checkpoint-crash-child.ts) already implement the
abrupt boundary. The child runs the shared fixture and exits with status 73 after
`ActivationTools.invoke` acknowledges the checked edit, before Workflow cleanup.
It writes the actual receipt, retained artifact path, task, issue, branch,
worktree and Node version to the acknowledgment record. The parent records the
child executable, arguments, inherited cwd, version, status, signal, stdout,
stderr and acknowledgment in test diagnostics.

Before reopening, parent assertions inspect the abandoned checkout, exact
`first.txt` bytes, committed branch bytes, receipt artifact and Git worktree
registration. The existing `beforeRestart` diagnostic retains those bytes,
original acknowledgment and registration before the call that reopens the task. A callback before each resumed controlled activation asserts the
same task, issue and branch, restored bytes, original receipt and artifact,
one original edit intent, removal of the abandoned workspace and only one
active task worktree alongside the repository and unrelated checkout. The resumed
fixture replays the identical checked edit and compares its retained receipt.
Final assertions require task-worktree removal, committed bytes surviving removal,
and preservation of the unrelated checkout.

These are existing source assertions. The crash fixture directly constructs
`HostTask` with a supplied capture and uses real Coordination admission,
Execution preparation and Workflow recovery. Its actor invokes ActivationTools
directly; it does not invoke a provider executable, MCP transport or the full
production admission path. Collaboration and final verification/delivery ports
are controlled. Its simulated `merged` result establishes no hosted staging
merge, live model behavior or native confinement.

[Interrupted-check scenarios](../tests/integration/interrupted-check.test.ts)
contain original-expectation, exact numeric-exit, readable-log, pending-correction
and successor assertions. They interrupt after journaled command observations,
then omit requested checks on retry to require host reconciliation. Required-pass
coverage retains exit 37 and the original log, observes a later exit 43 without
clearing the obligation, then corrects bytes to obtain exit 0. After interruption
at completed checkpoint, only review activates and verification precedes delivery.
The expected-fail variant is separately controlled expectation-recovery coverage;
it is not a demonstrated new behavioral red. Command outcomes, actors and final
verification/delivery are controlled, so these assertions do not establish actual
project-command execution.

### Evidence completion and correction intent

Execute the existing scenarios before deciding whether a behavioral correction is
needed. The remaining work is current observed evidence and any correction it
demonstrates, rather than creation of a missing crash test. Characterize working
behavior with expected-pass evidence. If an execution reaches a relevant missing
behavior, retain its distinguishing failing assertion before correction; no such
new defect is established by this documentation review.

The existing crash diagnostics already retain child cwd and an explicit
pre-restart abandoned-workspace observation. Run 136 records their correction
and passing execution. Do not recreate that correction or describe it as missing.
The remaining gap is current applicability: obtain current executed observations
through the declared owner checks, or establish valid reuse against matching
source dependencies, operation parameters, captured authority and environment.
The inspected run-183 retained index supplies no such completed checkpoint or
quality observation for this milestone.

For `checkpoint-observe-before-retry`, assess the ordered issue-branch
observation before any repeated mutation and rejection of duplicate push of the
secured head. For `checkpoint-abrupt-preservation`, retain child diagnostics,
acknowledgment and the pre-restart observation even if reopening fails; assess
restored exact bytes, original receipt, reconciliation before activation, one
active task worktree and preservation before task-owned cleanup.
For `checkpoint-pending-successor`, assess the original expectation, exits
37 and 43 with both readable logs, pending state despite omitted checks, correction
under the original expectation and successor-only resumption after completion.
These existing assertions are characterization targets, not evidence of a new
failure. The child exit 73 is the deliberate crash boundary; controlled failed
check exits are retained negative observations inside the scenario, distinct
from the enclosing owner's actual operation exit.

Associate executed scenarios and applicable formatting, lint, strict types and
build observations with the actual assessed source/candidate and environment.
Retain resolved commands, arguments, working directories, exact exits and complete
logs in external task evidence. A source file, acknowledgment schema or prior
unmatched result cannot establish that current execution passed. Unresolved
failures retain their original expectation, exact numeric exit and readable log
until correction satisfies that expectation; omitted checks cannot open the
verification or delivery gates.

Production activation continues through the trusted composition and the shared
[single-string Agent request and activity-scoped local MCP path](inspection-parity.md).
Provider web policy remains independent. A controlled executable or provider
proves only its exercised boundary. Native/provider verification under EX-24
must name the actual configured executable, versions, request, confinement,
result and complete diagnostics. Live inference, native confinement, hosted CI,
independent acceptance and observed staging integration remain separate evidence;
unavailable prerequisites and missing observations remain explicit gaps.

### Simplification ledger for the current checkpoint assessment

- Reuse existing checkpoint scenarios, the real child boundary, checked receipts,
  Coordination journal and Workflow cursor; introduce no recovery path or state.
- Retain the diagnostic correction already present and the historical run-136
  observations. Refresh only affected evidence; add behavioral red only for a
  demonstrated new regression before correcting it.
- Keep complete logs outside source and link actual operation provenance here.
  Final independent assessment and staging publication remain host-owned.

### Historical executed checkpoint characterization: run 136

Testing for `checkpoint-current-evidence` executed the existing scenarios against
captured revision `6c2bc586329939deb57ba69366331e4d00680406`, with the crash
diagnostic correction retained by checked edit. The assessed crash-test SHA-256 is
`7d7c3d196c46f8e35f3604e73b826a874375965031780a760f968f0483da981d`.
The unchanged checkpoint-test SHA-256 is
`5da4127b7f65b26daf41d27d74835191111141a9e2200e32a8d19c297777afff`;
the unchanged interrupted-check-test SHA-256 is
`eb7bcc6da783680d1c6e8adaa2e62ed2551d6987c78ab781e422c7a63cc736b7`.
These identify the exercised sources rather than claiming the base revision
alone includes the diagnostic correction.

The complete host observations live outside source under evidence invocation
`9a1c52455e6a6866b778feafae23143d78bf7bd4ccd1d26472282b61951da530`
in run 136's retained evidence directory. Retrieve these filenames through mapped
read-file and the run timeline; retain their complete contents.

| Operation | Command and arguments | Exit | Complete log |
| --- | --- | --- | --- |
| Owner characterization | `npm test -- execution` | 0 | `136-226-owner-tests.log` |
| Owner formatting | `npm run format:check -- execution` | 0 | `136-217-owner-format.log` |
| Owner lint | `npm run lint -- execution` | 0 | `136-220-owner-lint.log` |
| Strict repository types | `npm run check` | 0 | `136-223-repository-types.log` |
| Repository build | `npm run build` | 0 | `136-231-repository-build.log` |

Each operation ran from the captured `runs/136/worktree` directory; the host
receipt retains its full absolute working directory, argv, duration and log path.
The owner test log's SHA-256 is
`a99ea8dabe63390f9487757283f1e74d5e880d770b5ff7a1223adbb2f0adb066`.
It reports 241 passes, no failures and 16 skips. The named checkpoint, abrupt
crash and interrupted-check cases executed and passed without skips; the total
does not turn skipped native cases into evidence.

For `checkpoint-observe-before-retry`, the lost-response case passed with
ordered remote-event assertions: the first retry event on `7-task` observes the
accepted head, no push repeats that secured head, and task identity is unchanged.
The fixture also rejects another issue allocation through its retained count and
checks each push's exact branch and observed lease. Replaying the secured push
or creating a replacement task would fail these assertions.

For `checkpoint-abrupt-preservation`, the log records executable
`/usr/local/bin/node`, Node `v22.23.5`, child argv and cwd, actual exit 73,
null signal and complete empty stdout/stderr. It retains the acknowledged receipt
and a distinct `beforeRestart` diagnostic containing its original artifact
identity, task, issue, branch, abandoned worktree, exact working and committed
bytes and Git worktree registration. This diagnostic precedes reopening.
Before resumed activation, assertions require restored bytes, the same receipt,
one original edit intent, removal of the abandoned workspace and one active task
worktree alongside the repository and unrelated checkout. Final assertions retain
committed bytes after cleanup and leave the unrelated checkout intact. Lost bytes,
a fresh receipt, duplicate writes or cleanup of that unrelated checkout would fail.

For `checkpoint-pending-successor`, both original-expectation cases and both
omitted-recheck cases passed. Required-pass coverage preserves the original exit
37 and readable log, retains the later exit 43 and both log references, and prevents
verification or delivery while unresolved. Correcting checked bytes produces exit
0 under the original expectation. Interruption after completed checkpoint then
resumes only review, with verification before delivery. The separate expected-fail
variant preserves its original expectation and exits without representing a new
behavioral red. Dropping the pending obligation, replacing the original diagnostic
with the latest one, replaying the completed activity or reversing gates would fail.

This is expected-pass characterization and evidence correction, with no observed
new behavioral defect and no production behavior change. The original run-136 inspection identified missing child cwd and pre-restart
diagnostics; that correction is present in the current sources inspected above.
This historical result does not establish current candidate or environment
applicability by itself.
The temporary fixture's original artifact is read and compared during execution;
its exact receipt and abandoned-state contents survive in the retained test log
after the temporary fixture is removed. Fixture command outcomes, actors,
Collaboration and final verification/delivery ports remain controlled as described
above. This does not establish full production admission, MCP transport, native
confinement, live inference, hosted CI or an actual staging merge.
