# Publication recovery

This reference is for Delivery maintainers and host consumers deciding whether a
retained publication can continue after staging moves or a provider response is
lost. It records implementation intent for `retained-publication-reconciliation`
under [DE-2 through DE-6, DE-14 and DE-17](../contract.md).
It consumes [Execution's prepared recovery](../../execution/docs/prepared-checkpoint-recovery.md)
and [Verification's recovered acceptance](../../verification/README.md).
The required scenarios below do not establish passing runtime or live delivery.

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

## Source observations and required evidence

The activation baseline is `aae84422d50f59311f36cb0cd397c58293fe8c91`;
the inspected workspace also contains the preceding recovery and verification
contributions. Current [publication code](../src/publication.ts) observes PR state,
refuses unexpected heads and targets, checks the staging parent after verification,
and confirms returned or observed merges. Current [integration and resume](../src/index.ts)
check candidate/verdict digest equality and recover a retained publication from its
accepted journal events. These observations alone do not establish complete
verification-identity admission or reconciliation of an outdated PR to a newly
accepted candidate. Those are obligations for the subsequent Testing and
Implementation activities.

Extend the [publication suite](../tests/unit/publication.test.ts) and
[production-service recovery regression](../tests/integration/check-recovery.test.ts):

- `publication-observe-before-effects`: lose push, PR and merge responses after
  effects occur, reopen retained state, and assert provider observations precede
  further effects. Include unavailable facts and conflicting identities with no
  prohibited mutation or success claim.
- `publication-fresh-acceptance`: vary tree, parent, capture and acceptance
  independently, including equal-tree cases. Refuse earlier approval, then reuse
  the same PR only after applicable recovered checks and independent acceptance.
  Move staging again during verification and assert no merge.
- `publication-single-delivery`: use real Workflow, Execution, Verification and
  Delivery services with real Git and Coordination state and controlled external
  responses. Secure a checked checkpoint and distinct multiline answer, move
  staging, retain one task, issue and PR, and complete resumed final delivery.
  Assert preserved bytes, exact answer, original history and recovered identities.
  Confirm the resulting tree and reviewed parent, reuse a confirmed prior merge
  without duplicate effects, and retain actionable prerequisite evidence.

Use distinct engineering-base, architecture-source, verification-checkout and
before/after candidate identities. An assignment-shaped fixture or workspace
reconstruction alone cannot prove resumed production delivery. Retain complete
failed observations and canonical evidence references through the existing journal.
Controlled-provider regressions establish interpretation and ordering; they do not
establish live GitHub credentials, hosted CI, configured review or staging integration.
Only later host observations can establish the actual reviewed tree, parent,
required checks, independent verdict, single PR and confirmed staging merge.
