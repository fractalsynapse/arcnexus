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

## Pending executed-check evidence: issue #720 continuation

For milestone `recovered-publication-executed-checks`, this intent is recorded
at captured architecture revision `650b1a356e1525862717cff8f194ff99e628f214`
before changing the recovery scenarios. The run 145 results below remain
historical evidence with their original limitations.

The current [prepared fixture](../tests/fixtures/prepared-publication.ts),
SHA-256 `97276456b9a73d771a805b8c357ec0288811e5d1d83d5f14f111908ec98ae8ed`,
calls `controlChecks` on each admitted HostTask. That method replaces
`HostTask.check`, resolves the operation and candidate inputs, then records status
0 and a “Controlled process result” log without executing the declared command.
The retained-publication assertions inspect both `fixture-check` and
`current-check` results and the recovered identity. They establish selection and
binding under controlled results, not actual passing check processes. This is a
fixture evidence gap; it does not demonstrate a defect in production checks.

The intended extension uses the existing public recovery journey: secure checked
bytes and the exact answer, retain an uncertain/open publication, advance staging
and its required-check mapping, then reopen services for the same task and issue.
Execute the applicable original and newly required commands through
[Verification's checklist](../../verification/src/native.ts) and the unmodified
HostTask check path:
[runCheck](../../execution/src/run-check.ts) resolves inputs and reuse, and
[check](../../execution/src/check.ts) executes the captured command in its confined
environment. Assert the actual executable, complete arguments, resolved working
directory, numeric exit, complete log and check-input identity before assessment.
Changed relevant inputs must produce executions rather than reuse of historical
synthetic passes. An unavailable executable, dependency or confinement prerequisite
is retained as unavailable evidence, not a successful check or the intended
command failure.

| Accepted measure | Intended distinguishing evidence |
| --- | --- |
| `recovered-check-process-evidence` | Original and newly captured required commands actually run on the recovered candidate. Assessment receives their complete observations; tree, staging base, capture, acceptance and input identities match the final candidate. |
| `recovered-check-failure-refusal` | The newly required command actually exits nonzero with a distinctive diagnostic retained verbatim. Even a controlled favorable reviewer response cannot authorize successful publication or merge while that required check fails. After accountable correction through the normal workflow, applicable passing checks and fresh assessment permit continuation of the same retained publication. |
| `recovered-publication-continuity` | Preserve the existing exact-answer, receipt, checkpoint-byte, original acceptance/history and single issue/PR assertions. Keep stale approval refusal, changed ownership, checked conflicts, conflicting/unavailable provider facts and further staging movement covered by their applicable existing regressions. |
| `recovered-evidence-scope` | Map each measure to inspected assertions and complete executed observations with source revision/file digests and recovered candidate identities. Record applicable owner quality results, skipped/unavailable cases and remaining evidence gaps. |

The failure and corrected continuation must retain the original task, issue,
requirements, acceptance and publication, along with the failed observation.
Correction cannot weaken the required check or substitute an earlier tree, base
or capture approval. The successful result identifies the newly assessed tree,
reviewed staging parent, required process results, independent verdict and
provider-confirmed merge identity for the same PR.

These are pending scenario requirements, not new execution results. Reviewer
responses and provider facts may remain controlled to isolate deterministic
recovery; label them separately from actual local check processes and local Git
merge observations. They do not establish live independent inference, hosted CI,
configured GitHub review or an actual upstream staging merge. Preserve the run 145
observations below unchanged and append later evidence with its own source and
candidate identities; only the host performs assembled verification and delivery.

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
diagnostic and observe PR/branch facts before retry. The executed owner observations
below exercise these boundaries with controlled provider responses.

### Executed production-service characterization

| Criterion | Existing public assertions and boundary |
| --- | --- |
| `publication-observation-order` | [Retained publication scenarios](../tests/integration/retained-publication.test.ts) lose push, PR and merge acknowledgments after the controlled provider effect, reopen production services and require PR inspection first. Push/PR continuations also require branch observation and do not replay the lost completed effect. |
| `publication-recovered-identity` | The outdated-open-PR case advances staging, requires reassessment and both current check IDs, retains its URL, and checks the final Git tree and staging parent. [Identity scenarios](../tests/integration/acceptance-identity.test.ts) separately refuse changed tree, base, capture, acceptance or inputs before commit/provider access; equal-tree cases change the current base, capture, requirement text or required checks. |
| `publication-retained-outcomes` | Retained-publication assertions compare task, issue, one plan, exact multiline answer, checked bytes, original history and checkpoint ancestry. Conflicting PR head/target, branch divergence and unavailable PR facts stop effects and retain readable evidence. Lost-merge recovery asserts one PR and one merge. |
| `publication-evidence-accurate` | [Engineering-parent coverage](../tests/integration/engineering-parent.test.ts) consumes actual Execution assembly with distinct engineering base, adopted architecture source and verification checkout. [Check recovery](../tests/integration/check-recovery.test.ts) retains complete CI diagnostics and reconstructs a checkpoint, but that reconstruction alone does not establish completed resumed publication. |

The retained-publication test SHA-256 is
`a0597c5e5195f61f61921f48c20612459d07008dff2787c77de0a120ff3f4155`;
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

Testing completed the three transition distinctions identified by the earlier
documentation assessment, preserving the existing assertions:

- After a lost merge acknowledgment, staging advances again before services reopen.
  Recovery returns the original task merge, confirms its ancestry on staging and
  performs only PR observation, merged-state verification and confirmation.
- An outdated PR first survives staging movement and obtains fresh checks and
  independent assessment through the production gate. A further staging move during
  provider verification then prevents merge, retaining the same PR and checked work.
- A successful PR lookup followed by unavailable issue-branch facts retains the
  actual PR observation, complete diagnostic artifact and explicit required action.
  It performs no publication effect and claims no success.

Under retained invocation
`ad4f08f02034c389b42ff853b024e7ca2c21db31cd8c725686755a8a0c517664`,
`145-1172-mcp-observation.json` records `npm test -- delivery` with status 0.
Its complete log `145-1171-owner-tests.log` has SHA-256
`79294cd273c4c3d7cc76f1ca4978d40b276fb2f9490f0d8b890bc1d2e4f5240d`
and reports 49 passes with no failures, cancellations or skips across the five
Delivery suites. It retains controlled native source artifacts before temporary
fixture cleanup; these embedded artifacts are deterministic fixture evidence.

The applicable owner quality observations also returned status 0:

| Operation | Complete observation | Log |
| --- | --- | --- |
| Owner formatting | `145-1160-mcp-observation.json` | `145-1159-owner-format.log` |
| Owner lint | `145-1163-mcp-observation.json` | `145-1162-owner-lint.log` |
| Repository strict types | `145-1166-mcp-observation.json` | `145-1165-repository-types.log` |
| Repository build | `145-1169-mcp-observation.json` | `145-1168-repository-build.log` |

The retained evidence index and `145-1-run-timeline.jsonl` locate these complete
artifacts. Formatting and lint select Delivery TypeScript source and fixtures;
they do not validate Markdown claims. Implementation inspected this reference
against the current assertions and complete results. Only documentation changed
after these observations, so their executable inputs remain applicable. Earlier
fixture and quality failures remain retained history; they are not current
production defects or intended behavioral red.

No demonstrated production defect required a behavioral correction. The existing
publication path and Coordination journal satisfy the exercised cases. This
contribution updates stale evidence descriptions and reuses completed Testing;
it adds no orchestrator, store, delivery identity or candidate mutation.

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
Their scope complements the Delivery owner result above without replacing it.

This Implementation reconciliation changes no executable behavior. The current
Delivery characterization and quality observations above supersede the README's
older owner result for this contribution. No live inference, native confinement,
hosted CI, configured review or actual staging integration is established here.
Later host assessment and delivery must identify the reviewed final tree, recovered
parent, capture, acceptance, required evidence, independent
verdict, single PR and confirmed provider merge. Only the host performs assembled
verification and delivery.
