# Publication recovery

This reference is for Delivery maintainers and host consumers deciding whether a
retained publication can continue after staging moves or a provider response is
lost. It records the accepted boundary and current characterization scope for
`retained-publication-current-evidence`
under [DE-2 through DE-6, DE-14 and DE-17](../contract.md).
It consumes [Execution's prepared recovery](../../execution/docs/prepared-checkpoint-recovery.md)
and [Verification's recovered acceptance](../../verification/README.md).
Source assertions, executed owner observations and live delivery have distinct
scopes, identified below.

## Bind the production candidate

Use the actual candidate returned by
[Execution.assemble](../../execution/src/execution.ts), the retained HostTask session
and the independent verdict recorded by
[Workflow](../../workflow/src/assembly.ts). Candidate supplies the assembled tree
`digest`, evidence references and owner-evidence digest; it is not an assignment
carrying a convenient base field. The retained engineering base is
`task.config.capture.source.revision`. The active architecture source is
`task.capture.source.revision`; approved adoption can make these different.
A verification checkout is only an assessment environment.

[VerificationIdentity](../../verification/src/index.ts) identifies `tree`, `base`,
`capture`, `acceptance` and `inputs`. Its
[producer](../../verification/src/identity.ts) binds the goal and complete plan,
resolved check observations and owner evidence to the assessed candidate.
Delivery must require the applicable accepting verdict for that complete identity
before effects. Equal tree bytes or unchanged criterion names cannot make approval
for an earlier base, capture or acceptance applicable. Missing identity evidence
cannot be supplied by a guessed hash or a PR's existence.

[Delivery's public entry](../src/index.ts) obtains the issue branch, issue and
committed head through HostTask and constructs
[Publication](../src/publication.ts): `target`, `branch`, `head`, `issue`,
`candidate` tree digest and reviewed `parent`. Publish the engineering base as
parent, never the architecture source or verification checkout. Keep the recovered
review identity associated with this publication in the existing
[Coordination journal](../../coordination/contract.md); do not introduce a competing
delivery store or duplicate Git object contents.

## Reconcile the retained task before effects

Preserve one task, issue, issue branch and staging PR. Retain secured checked bytes,
receipts, complete evidence and verbatim human answers, including whitespace.
Original bases, acceptance, authority and review observations remain history.
Execution captures the new staging base, ownership, operations and applicable
acceptance before continuation. It enforces changed ownership and retains checked
conflicts and complete diagnostics before overwrite. Delivery cannot resolve those
conflicts by modifying the candidate or widening scope.

Preserve original requirements when reconciling applicable acceptance. A necessary
boundary or acceptance change requires architectural authority with retained decision
evidence. Retaining an earlier human answer does not renew candidate approval.
Required current and affected checks and fresh independent assessment bind the
recovered final candidate before publication. Unchanged scoped evidence is reusable
only under Verification's matching-input and environment rules.

Before retrying a lost push, PR creation or merge response, or continuing an
outdated open PR, observe the authorized provider's PR and issue-branch facts using
the retained task and branch anchors. Record the complete observations and the
reason they permit the next effect. Unavailable facts are not proof of absence.

| Observed facts | Required continuation |
| --- | --- |
| No PR; issue branch absent or already at the accepted head | After current identity and staging-parent validation, perform only the missing publication effects. |
| Matching open PR and expected issue-branch head | Reuse its actual URL and observe gates for the accepted candidate. |
| Retained open PR belongs to the earlier candidate after staging moves | Reconcile its observed head with retained publication and checkpoint history. Return through Execution and Verification for the recovered candidate; reconcile the same PR after fresh acceptance, without blindly pushing or creating another PR. |
| Unexpected issue, branch, PR target or head; closed unmerged PR; divergent checkpoint | Refuse effects and retain the conflicting identities and actionable diagnostic. A known historical head may be reconciled only through its retained task relationship. |
| Provider confirms the retained PR already merged | Verify the matching historical publication and confirm its actual merge tree on staging; report that merge without another push, PR or merge. |
| Required provider observation unavailable | Preserve work and evidence with the named external prerequisite and required action; claim no success. |

A matching prior merge is a historical outcome, not approval for newly recovered
work. Staging may have advanced after that merge; report the provider's confirmed
task merge identity rather than substituting the latest staging head. Conflicting
merged identities remain a refusal.

## Keep gates pinned through integration

Before publication and again after provider verification, require the reviewed
staging parent. A further staging advance prevents integration and returns to
reconciliation. Neither a checkpoint push nor an outdated open PR accepts work.

Observe actual required CI and configured repository review on the verified head.
Pending gates remain pending. Missing credentials, inaccessible facts or another
genuine external prerequisite retain a named hold and its evidence. A required human
architecture decision retains its exact question and answer through the existing
gate. Routine authorized retries add no approval ceremony; general approval cannot
bypass a required gate. Independent engineering review is distinct from GitHub review,
and Delivery cannot approve its own PR.

Merge only the chosen PR with the expected accepted head and reviewed parent still
current. Confirm the returned merge commit contains the accepted tree on staging
before reporting success. If the merge response or confirmation is lost, retain
uncertainty and inspect provider facts before any retry. Record the confirmed merge
identity once, with task, issue, PR, reviewed tree, parent, capture, acceptance,
required evidence and independent verdict references.

Publication-discovered engineering defects return complete diagnostics to Workflow
for accountable correction. Refresh affected checks and independent acceptance
before continuing the same publication. Delivery cannot edit or accept a candidate,
bypass gates or merge main. Release and simulation capabilities remain deferred.

## Current characterization scope: issue #720

This reconciliation inspects captured revision
`fef60bb8d6aec3c2dcbedb06cac13c2cc3ee79b8` and the preceding Execution and
Verification documentation contributions in the workspace. It replaces the
earlier `aae84422d50f59311f36cb0cd397c58293fe8c91` pending-implementation
description. That earlier inspection remains history; it does not establish a
current defect. The accepted boundary above is unchanged.

### Existing production path

[Integration and resume](../src/index.ts) now call
[acceptance validation](../src/acceptance.ts). Initial integration reconstructs the
verification identity from the actual assembled candidate, retained plan and
assessment checks, compares it with the assessment and verdict, validates criterion
coverage and requires the currently declared acceptance check IDs with passing
results before committing the candidate. It retains that identity in Publication.

Resume validates the historical publication against its matching accepted journal
events, then observes PR facts and, for an unmerged publication, issue-branch facts.
A conflicting target, unknown head or disagreement between PR and branch refuses
continuation. A known checkpoint or changed current acceptance returns to engineering
rather than treating historical approval as current. Execution then owns recovery;
fresh verification precedes integration through the same path. A merged publication
instead uses its matching historical acceptance and provider confirmation.

[Publication](../src/publication.ts) observes before missing effects, reuses an open
PR, requests verification of its expected head, rechecks the reviewed staging parent
and confirms the actual returned merge tree. An already merged PR uses explicit
merged-state verification and confirmation without another mutation.
[Provider failure retention](../src/check-failure.ts) preserves complete diagnostics,
stdout and stderr with a publication hold and the required action to resolve the
diagnostic and observe PR/branch facts before retry. These are source observations,
not newly executed Delivery results.

### Characterize the existing scenarios before changing behavior

| Criterion | Existing public assertions and boundary |
| --- | --- |
| `publication-observation-order` | [Retained publication scenarios](../tests/integration/retained-publication.test.ts) lose push, PR and merge acknowledgments after the controlled provider effect, reopen production services and require PR inspection first. Push/PR continuations also require branch observation and do not replay the lost completed effect. |
| `publication-recovered-identity` | The outdated-open-PR case advances staging, requires reassessment and both current check IDs, retains its URL, and checks the final Git tree and staging parent. [Identity scenarios](../tests/integration/acceptance-identity.test.ts) separately refuse changed tree, base, capture, acceptance or inputs before commit/provider access; equal-tree cases change the current base, capture, requirement text or required checks. |
| `publication-retained-outcomes` | Retained-publication assertions compare task, issue, one plan, exact multiline answer, checked bytes, original history and checkpoint ancestry. Conflicting PR head/target, branch divergence and unavailable PR facts stop effects and retain readable evidence. Lost-merge recovery asserts one PR and one merge. |
| `publication-evidence-accurate` | [Engineering-parent coverage](../tests/integration/engineering-parent.test.ts) consumes actual Execution assembly with distinct engineering base, adopted architecture source and verification checkout. [Check recovery](../tests/integration/check-recovery.test.ts) retains complete CI diagnostics and reconstructs a checkpoint, but that reconstruction alone does not establish completed resumed publication. |

The retained-publication test SHA-256 is
`d8975a27ebe746f7f7cdd4127f368e43adf56174b87147642d1398e94c88476b`;
the identity test SHA-256 is
`12b21cb41062eb7af718184d578fb6647e3f3d91c869777cd3a36319d58223aa`.
The [prepared fixture](../tests/fixtures/prepared-publication.ts) uses real Workflow,
Execution admission/preparation/assembly, Architecture, Agent, Verification/Reviewer
validation, Git and reopened Coordination SQLite. A deterministic executable uses
LocalMcp for the checked edit and foreground answer. Check process results and
Reviewer responses are controlled. The [provider fixture](../tests/fixtures/publication-provider.ts)
controls upstream facts/effects and creates real local squash commits; it does not
contact GitHub. Throwing after an effect exercises normal error/cleanup recovery,
not abrupt process death. Its verification stub cannot establish hosted CI or
configured GitHub review.

The [unit publication suite](../tests/unit/publication.test.ts) separately covers
closed PRs, missing/conflicting branches, conflicting merged identities, pending
verification, failed verification and failed confirmation. It checks exact provider
arguments, including merged-state verification and the observed merge identity.

The next Testing activity should first characterize these existing assertions with
expected-pass observations. Current source inspection identifies these remaining
transition distinctions:

- The lost-merge scenario resumes immediately. Add an explicit later staging
  advance before reopening, then require the original confirmed task merge identity
  with no duplicate effects. The unit merged case alone does not prove this
  production-service transition.
- The case named “another staging movement during recovered provider verification”
  starts from prepared work and moves staging inside verification; it does not first
  reconcile an outdated PR. Exercise that additional move after the outdated-PR
  recovery has already obtained fresh acceptance.
- Unavailable retained-provider coverage currently fails PR lookup. Distinguish a
  successful PR read followed by unavailable issue-branch facts, retaining that
  diagnostic and prerequisite without mutation or a success claim.

These are characterization gaps, not demonstrated product failures. Preserve the
existing assertions and use the same fixtures and journal. Observe any relevant
failing public assertion before a behavioral correction; do not manufacture red
for already working behavior or create another recovery lifecycle.

### Consume completed supplier evidence without overstating it

[Execution's run 145 characterization](../../execution/docs/prepared-checkpoint-recovery.md#executed-prepared-recovery-characterization-run-145)
establishes exact answers/receipts, newly captured ownership refusal, compatible
recovery and retained conflict diagnostics through real Git/SQLite and LocalMcp.
Its final Verification and Delivery ports are controlled.
[Verification's run 145 characterization](../../verification/README.md#executed-public-characterization-run-145)
establishes identity refusal, current check selection, complete assessment inputs
and rejection/hold boundaries through its public gate. Its check processes and
independent verdict responses are controlled; setup seeds its checkpoint/history.

Under retained invocation
`ad4f08f02034c389b42ff853b024e7ca2c21db31cd8c725686755a8a0c517664`,
complete observations `145-392-mcp-observation.json` and
`145-799-mcp-observation.json` record the later Execution and Verification owner
runs, respectively, with status 0. Logs `145-391-owner-tests.log` (SHA-256
`90a05e7480dd888ebf2ffc301e220786c034c922368721b025635cfc85865f44`)
and `145-798-owner-tests.log` (SHA-256
`1b0c6d410430862769d23c40e97b4289ca9899c3175b2efb7f36bcb7b7c3897b`)
report 252 passes/16 skips and 18 passes/no skips, respectively, with no failures.
The retained evidence index and `145-1-run-timeline.jsonl` locate the complete
artifacts and applicable owner formatting, lint, strict types and build observations.
Their scope does not supply a current Delivery owner result.

This documentation activity changes no executable behavior. Current Delivery
characterization and applicable quality observations remain for its subsequent
activities; the README's older owner result is historical. No live inference,
native confinement, hosted CI, configured review or actual staging integration is
established here. Later host assessment and delivery must identify the reviewed
final tree, recovered parent, capture, acceptance, required evidence, independent
verdict, single PR and confirmed provider merge. Only the host performs assembled
verification and delivery.
